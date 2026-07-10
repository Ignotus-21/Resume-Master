jest.mock('../models/ApiUsage');
jest.mock('../models/AppConfig');
jest.mock('../models/User');
const ApiUsage = require('../models/ApiUsage');
const AppConfig = require('../models/AppConfig');
const User = require('../models/User');
const { consumeQuota } = require('../services/quotaService');

const GUEST_LIMIT = 5000;

describe('quotaService.consumeQuota (guest, IP-based)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AppConfig.findOneAndUpdate.mockResolvedValue({ defaultTokenLimit: 15000, guestTokenLimit: GUEST_LIMIT });
  });

  const guestReq = () => ({ user: null, quotaIdentity: 'ip:1.2.3.4', identity: 'ip:1.2.3.4' });

  it('allows and returns remaining quota when under the limit', async () => {
    ApiUsage.findOneAndUpdate.mockResolvedValue({
      identity: 'ip:1.2.3.4', usedTokens: 100, windowStart: new Date(),
    });

    const result = await consumeQuota(guestReq());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(GUEST_LIMIT - 100);
  });

  it('rejects when usage is at or above the guest token limit', async () => {
    ApiUsage.findOneAndUpdate.mockResolvedValue({
      identity: 'ip:1.2.3.4', usedTokens: GUEST_LIMIT, windowStart: new Date(),
    });

    const result = await consumeQuota(guestReq());
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBeInstanceOf(Date);
  });

  it('ignores a benign duplicate-key race on the upsert', async () => {
    ApiUsage.findOneAndUpdate.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));
    ApiUsage.findOne.mockResolvedValue({ identity: 'ip:1.2.3.4', usedTokens: 100, windowStart: new Date() });

    const result = await consumeQuota(guestReq());
    expect(result.allowed).toBe(true);
  });

  it('propagates non-duplicate errors from the upsert', async () => {
    ApiUsage.findOneAndUpdate.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 99 }));
    await expect(consumeQuota(guestReq())).rejects.toThrow('boom');
  });

  it('re-fetches usage if a concurrent request already reset the expired window', async () => {
    const windowStart = new Date(Date.now() - 7 * 60 * 60 * 1000); // expired (default 6h window)
    ApiUsage.findOneAndUpdate
      .mockResolvedValueOnce({ identity: 'ip:1.2.3.4', usedTokens: 100, windowStart })
      // Reset attempt loses the race; another request already reset it.
      .mockResolvedValueOnce(null);
    ApiUsage.findOne.mockResolvedValue({ identity: 'ip:1.2.3.4', usedTokens: 0, windowStart: new Date() });

    const result = await consumeQuota(guestReq());
    expect(result.allowed).toBe(true);
    expect(ApiUsage.findOne).toHaveBeenCalledWith({ identity: 'ip:1.2.3.4' });
  });
});

describe('quotaService.consumeQuota (logged-in user)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AppConfig.findOneAndUpdate.mockResolvedValue({ defaultTokenLimit: 15000, guestTokenLimit: GUEST_LIMIT });
  });

  const userReq = (overrides = {}) => ({ user: { id: 'u1' }, ...overrides });

  it('allows and returns remaining quota when under the lifetime limit', async () => {
    User.findById.mockResolvedValue({ usedTokens: 1000, extraTokens: 0 });

    const result = await consumeQuota(userReq());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(15000 - 1000);
  });

  it('rejects when the lifetime token limit is reached', async () => {
    User.findById.mockResolvedValue({ usedTokens: 15000, extraTokens: 0 });

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
  });

  it('does not bypass quota when the stored key exists but failed to decrypt for this request', async () => {
    User.findById.mockResolvedValue({ geminiApiKeyEncrypted: 'encrypted-key', usedTokens: 1000, extraTokens: 0 });

    const result = await consumeQuota(userReq());
    expect(result.isByok).toBeUndefined();
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(15000 - 1000);
  });
});
