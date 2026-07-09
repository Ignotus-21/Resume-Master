jest.mock('../models/ApiUsage');
const ApiUsage = require('../models/ApiUsage');
const { consumeQuota, LIMIT } = require('../services/quotaService');

describe('quotaService.consumeQuota (atomic)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ApiUsage.updateOne.mockResolvedValue({});
  });

  it('allows and returns remaining quota when under the limit', async () => {
    // Conditional increment succeeds (doc was under the limit).
    ApiUsage.findOneAndUpdate.mockResolvedValue({ identity: 'u1', count: 1, windowStart: new Date() });

    const result = await consumeQuota('u1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(LIMIT - 1);
    // Upsert (create-if-missing) and window-reset are attempted atomically.
    expect(ApiUsage.updateOne).toHaveBeenCalledTimes(2);
  });

  it('rejects when the conditional increment matches nothing (at limit)', async () => {
    // findOneAndUpdate returns null because count is already >= LIMIT.
    ApiUsage.findOneAndUpdate.mockResolvedValue(null);
    ApiUsage.findOne.mockResolvedValue({ identity: 'u1', count: LIMIT, windowStart: new Date() });

    const result = await consumeQuota('u1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBeInstanceOf(Date);
  });

  it('ignores a benign duplicate-key race on the upsert', async () => {
    ApiUsage.updateOne.mockReset();
    // First call (upsert) throws E11000; must be swallowed. Second (reset) ok.
    ApiUsage.updateOne
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }))
      .mockResolvedValueOnce({});
    ApiUsage.findOneAndUpdate.mockResolvedValue({ identity: 'u1', count: 1, windowStart: new Date() });

    const result = await consumeQuota('u1');
    expect(result.allowed).toBe(true);
  });

  it('propagates non-duplicate errors from the upsert', async () => {
    ApiUsage.updateOne.mockReset();
    ApiUsage.updateOne.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 99 }));
    await expect(consumeQuota('u1')).rejects.toThrow('boom');
  });
});
