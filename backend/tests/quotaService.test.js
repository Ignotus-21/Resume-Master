jest.mock('../models/ApiUsage');
jest.mock('../models/AppConfig');
jest.mock('../models/User');
const ApiUsage = require('../models/ApiUsage');
const AppConfig = require('../models/AppConfig');
const User = require('../models/User');
const { consumeQuota, refundReservation, RESERVE_ESTIMATE } = require('../services/quotaService');

const GUEST_LIMIT = 5000;
const DEFAULT_LIMIT = 15000;

describe('quotaService.consumeQuota (guest, IP-based)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AppConfig.findOneAndUpdate.mockResolvedValue({ defaultTokenLimit: DEFAULT_LIMIT, guestTokenLimit: GUEST_LIMIT });
  });

  const guestReq = () => ({ user: null, quotaIdentity: 'ip:1.2.3.4', identity: 'ip:1.2.3.4' });

  it('allows, atomically reserves the estimate, and returns remaining quota when under the limit', async () => {
    ApiUsage.findOneAndUpdate
      .mockResolvedValueOnce({ identity: 'ip:1.2.3.4', usedTokens: 100, windowStart: new Date() }) // upsert-if-missing
      .mockResolvedValueOnce({ identity: 'ip:1.2.3.4', usedTokens: 100 + RESERVE_ESTIMATE, windowStart: new Date() }); // reserve

    const result = await consumeQuota(guestReq());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(GUEST_LIMIT - 100 - RESERVE_ESTIMATE);
  });

  it('rejects (without incrementing) when reserving the estimate would exceed the guest token limit', async () => {
    ApiUsage.findOneAndUpdate
      .mockResolvedValueOnce({ identity: 'ip:1.2.3.4', usedTokens: GUEST_LIMIT, windowStart: new Date() }) // upsert-if-missing
      .mockResolvedValueOnce(null); // reserve: filter doesn't match, already at limit

    const result = await consumeQuota(guestReq());
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBeInstanceOf(Date);
  });

  it('ignores a benign duplicate-key race on the upsert', async () => {
    ApiUsage.findOneAndUpdate
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 })) // upsert loses the race
      .mockResolvedValueOnce({ identity: 'ip:1.2.3.4', usedTokens: 100 + RESERVE_ESTIMATE, windowStart: new Date() }); // reserve
    ApiUsage.findOne.mockResolvedValue({ identity: 'ip:1.2.3.4', usedTokens: 100, windowStart: new Date() });

    const result = await consumeQuota(guestReq());
    expect(result.allowed).toBe(true);
  });

  it('propagates non-duplicate errors from the upsert', async () => {
    ApiUsage.findOneAndUpdate.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 99 }));
    await expect(consumeQuota(guestReq())).rejects.toThrow('boom');
  });

  it('re-fetches usage if a concurrent request already reset the expired window', async () => {
    const windowStart = new Date(Date.now() - 7 * 60 * 60 * 1000); // expired (default 4h window)
    ApiUsage.findOneAndUpdate
      .mockResolvedValueOnce({ identity: 'ip:1.2.3.4', usedTokens: 100, windowStart }) // upsert-if-missing
      .mockResolvedValueOnce(null) // reset attempt loses the race; another request already reset it
      .mockResolvedValueOnce({ identity: 'ip:1.2.3.4', usedTokens: RESERVE_ESTIMATE, windowStart: new Date() }); // reserve
    ApiUsage.findOne.mockResolvedValue({ identity: 'ip:1.2.3.4', usedTokens: 0, windowStart: new Date() });

    const result = await consumeQuota(guestReq());
    expect(result.allowed).toBe(true);
    expect(ApiUsage.findOne).toHaveBeenCalledWith({ identity: 'ip:1.2.3.4' });
  });
});

describe('quotaService.consumeQuota (logged-in user)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AppConfig.findOneAndUpdate.mockResolvedValue({ defaultTokenLimit: DEFAULT_LIMIT, guestTokenLimit: GUEST_LIMIT });
  });

  const userReq = (overrides = {}) => ({ user: { id: 'u1' }, ...overrides });

  it('allows, atomically reserves the estimate, and returns remaining quota when under the lifetime limit', async () => {
    User.findById.mockResolvedValue({ usedTokens: 1000, extraTokens: 0 });
    User.findOneAndUpdate.mockResolvedValue({ usedTokens: 1000 + RESERVE_ESTIMATE, extraTokens: 0 });

    const result = await consumeQuota(userReq());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(DEFAULT_LIMIT - 1000 - RESERVE_ESTIMATE);
  });

  it('rejects (without incrementing) when reserving the estimate would exceed the lifetime limit', async () => {
    User.findById.mockResolvedValue({ usedTokens: DEFAULT_LIMIT, extraTokens: 0 });
    User.findOneAndUpdate.mockResolvedValue(null); // filter doesn't match, already at limit

    const result = await consumeQuota(userReq());
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBeNull();
  });

  it('bypasses quota entirely when a usable BYOK key is attached to the request', async () => {
    // The bypass checks req.geminiApiKey (the key actually usable this
    // request, set by loadGeminiKey after a successful decrypt) rather than
    // just whether the user has one stored — a stored key that fails to
    // decrypt must still be quota-checked since the call falls back to the
    // shared key.
    User.findById.mockResolvedValue({ geminiApiKeyEncrypted: 'encrypted-key' });

    const result = await consumeQuota(userReq({ geminiApiKey: 'decrypted-key' }));
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Infinity);
    expect(result.isByok).toBe(true);
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not bypass quota when the stored key exists but failed to decrypt for this request', async () => {
    User.findById.mockResolvedValue({ geminiApiKeyEncrypted: 'encrypted-key', usedTokens: 1000, extraTokens: 0 });
    User.findOneAndUpdate.mockResolvedValue({ usedTokens: 1000 + RESERVE_ESTIMATE, extraTokens: 0 });

    const result = await consumeQuota(userReq());
    expect(result.isByok).toBeUndefined();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(DEFAULT_LIMIT - 1000 - RESERVE_ESTIMATE);
  });
});

describe('quotaService.refundReservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('decrements the reserved estimate for a logged-in user', async () => {
    User.findByIdAndUpdate.mockResolvedValue({});
    await refundReservation({ user: { id: 'u1' }, quotaReserved: true });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('u1', { $inc: { usedTokens: -RESERVE_ESTIMATE } });
  });

  it('decrements the reserved estimate for a guest by identity', async () => {
    ApiUsage.findOneAndUpdate.mockResolvedValue({});
    await refundReservation({ quotaIdentity: 'ip:1.2.3.4', quotaReserved: true });
    expect(ApiUsage.findOneAndUpdate).toHaveBeenCalledWith(
      { identity: 'ip:1.2.3.4' },
      { $inc: { usedTokens: -RESERVE_ESTIMATE } }
    );
  });

  it('is a no-op for BYOK requests, which never reserved anything', async () => {
    await refundReservation({ user: { id: 'u1' }, geminiApiKey: 'k', quotaReserved: true });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('is a no-op when the reservation was already consumed by trackUsage', async () => {
    // e.g. the request's SECOND Gemini call failed after the first call's
    // true-up already spent the reservation — nothing is outstanding.
    await refundReservation({ user: { id: 'u1' } });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('swallows its own errors rather than throwing (best-effort)', async () => {
    User.findByIdAndUpdate.mockRejectedValue(new Error('db down'));
    await expect(refundReservation({ user: { id: 'u1' }, quotaReserved: true })).resolves.toBeUndefined();
  });
});

describe('trackUsage reservation true-up across multiple calls in one request', () => {
  const { trackUsage } = require('../utils/trackUsage');
  jest.mock('../models/TokenUsage');
  const TokenUsage = require('../models/TokenUsage');

  const geminiResult = (input, output) => ({
    response: Promise.resolve({ usageMetadata: { promptTokenCount: input, candidatesTokenCount: output } }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    TokenUsage.create.mockResolvedValue({});
    User.findByIdAndUpdate.mockResolvedValue({});
  });

  it('trues up against the reservation once, then charges later calls in full', async () => {
    const req = { user: { id: 'u1' }, quotaReserved: true };

    // First call (e.g. tailor): actual 800 → adjustment 800 - RESERVE.
    await trackUsage(req, 'resume-tailor', geminiResult(500, 300));
    expect(User.findByIdAndUpdate).toHaveBeenLastCalledWith('u1', { $inc: { usedTokens: 800 - RESERVE_ESTIMATE } });
    expect(req.quotaReserved).toBe(false);

    // Second call (e.g. LaTeX): full cost, no reservation left to subtract.
    await trackUsage(req, 'latex-generator', geminiResult(400, 200));
    expect(User.findByIdAndUpdate).toHaveBeenLastCalledWith('u1', { $inc: { usedTokens: 600 } });
  });
});
