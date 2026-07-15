// Timeout + retry behavior of the Gemini boundary. The real SDK runs here —
// its AbortController/timeout plumbing is exactly what's under test — with
// the network stubbed at global.fetch.
//
// Env knobs must be set before geminiService is required (read at load).
process.env.GEMINI_TIMEOUT_MS = '300';
process.env.GEMINI_RETRY_BACKOFF_MS = '25';

const { AiError } = require('../utils/aiError');
const gemini = require('../services/geminiService');

const VALID_REWRITES = { rewrites: ['tighter', 'metric-driven', 'impact-focused'] };

const geminiHttpResponse = (payload) => new Response(JSON.stringify({
  candidates: [{
    content: { role: 'model', parts: [{ text: JSON.stringify(payload) }] },
    finishReason: 'STOP',
    index: 0,
  }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

const errorHttpResponse = (status, statusText, message) => new Response(
  JSON.stringify({ error: { message } }),
  { status, statusText, headers: { 'Content-Type': 'application/json' } }
);

// A fetch that never resolves on its own — it only rejects when the SDK's
// timeout fires its AbortSignal, mimicking a wedged upstream connection.
const hangingFetch = () => jest.fn((url, opts) => new Promise((resolve, reject) => {
  if (opts && opts.signal) {
    opts.signal.addEventListener('abort', () => {
      const err = new Error('This operation was aborted');
      err.name = 'AbortError';
      reject(err);
    });
  }
}));

describe('Gemini timeout + retry', () => {
  const realFetch = global.fetch;

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterAll(() => {
    console.error.mockRestore();
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('a hanging Gemini call fails within the timeout window with AI_UNAVAILABLE (no retry of timeouts)', async () => {
    global.fetch = hangingFetch();

    const started = Date.now();
    const err = await gemini.rewriteBullet('b', 'r', 'jd').then(
      () => { throw new Error('expected the call to reject'); },
      (e) => e
    );
    const elapsed = Date.now() - started;

    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe('AI_UNAVAILABLE');
    // One 300ms timeout window plus slack — nowhere near the minutes-long
    // hang this guards against, and proof the timeout itself is not retried
    // (a retry would double the elapsed time past 600ms).
    expect(elapsed).toBeGreaterThanOrEqual(250);
    expect(elapsed).toBeLessThan(600);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('a single 503 recovers via one retry instead of surfacing an error', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(errorHttpResponse(503, 'Service Unavailable',
        'The model is overloaded due to high demand. This is usually temporary.'))
      .mockResolvedValueOnce(geminiHttpResponse(VALID_REWRITES));

    await expect(gemini.rewriteBullet('b', 'r', 'jd')).resolves.toEqual(VALID_REWRITES.rewrites);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('a transient network failure recovers via one retry', async () => {
    const netErr = new TypeError('fetch failed');
    netErr.cause = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    global.fetch = jest.fn()
      .mockRejectedValueOnce(netErr)
      .mockResolvedValueOnce(geminiHttpResponse(VALID_REWRITES));

    await expect(gemini.rewriteBullet('b', 'r', 'jd')).resolves.toEqual(VALID_REWRITES.rewrites);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-transient upstream failures (4xx burns quota for nothing)', async () => {
    global.fetch = jest.fn()
      .mockResolvedValue(errorHttpResponse(400, 'Bad Request', 'Invalid request'));

    const err = await gemini.rewriteBullet('b', 'r', 'jd').then(
      () => { throw new Error('expected the call to reject'); },
      (e) => e
    );
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe('AI_UNAVAILABLE');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('a request that exhausts the retry still refunds the outstanding reservation', async () => {
    global.fetch = jest.fn()
      .mockResolvedValue(errorHttpResponse(503, 'Service Unavailable', 'still overloaded'));

    // Isolated copies so the real quotaService/trackUsage can be spied on
    // without touching the shared module registry used above.
    let isolated;
    jest.isolateModules(() => {
      jest.doMock('../utils/trackUsage', () => ({ trackUsage: jest.fn().mockResolvedValue(undefined) }));
      jest.doMock('../services/quotaService', () => ({ refundReservation: jest.fn().mockResolvedValue(undefined) }));
      isolated = {
        gemini: require('../services/geminiService'),
        refundReservation: require('../services/quotaService').refundReservation,
        trackUsage: require('../utils/trackUsage').trackUsage,
      };
    });

    const req = { user: { id: 'u1' }, quotaReserved: true };
    // The isolated registry has its own AiError class, so match on shape
    // (code) rather than instanceof.
    await expect(isolated.gemini.rewriteBullet('b', 'r', 'jd', null, req))
      .rejects.toMatchObject({ name: 'AiError', code: 'AI_UNAVAILABLE' });
    expect(global.fetch).toHaveBeenCalledTimes(2); // original + one retry, no more
    expect(isolated.refundReservation).toHaveBeenCalledWith(req);
    expect(isolated.trackUsage).not.toHaveBeenCalled();
  });
});
