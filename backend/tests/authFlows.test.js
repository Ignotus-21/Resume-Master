const request = require('supertest');

jest.mock('../models/User');
jest.mock('../models/ApiUsage');
jest.mock('../models/AppConfig');
jest.mock('../services/emailService');

const User = require('../models/User');
const ApiUsage = require('../models/ApiUsage');
const AppConfig = require('../models/AppConfig');
const emailService = require('../services/emailService');
const { enforceGeminiQuota } = require('../utils/geminiGate');

beforeEach(() => {
  AppConfig.findOneAndUpdate.mockResolvedValue({ defaultTokenLimit: 15000, guestTokenLimit: 5000 });
});

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

describe('enforceGeminiQuota — verified-email gate', () => {
  it('blocks an unverified email/password account with 403', async () => {
    const rejection = await enforceGeminiQuota({ user: { isEmailAccount: true, emailVerified: false } });
    expect(rejection).toMatchObject({ status: 403 });
  });

  it('lets a verified account through (BYOK short-circuits quota)', async () => {
    const rejection = await enforceGeminiQuota({ user: { isEmailAccount: true, emailVerified: true }, geminiApiKey: 'k' });
    expect(rejection).toBeNull();
  });

  it('does not apply the email gate to guests', async () => {
    // Guest has no req.user; with a BYOK key short-circuit it returns null.
    const rejection = await enforceGeminiQuota({ geminiApiKey: 'k' });
    expect(rejection).toBeNull();
  });

  it('consumes quota for a guest without a BYOK key (allowed path)', async () => {
    ApiUsage.updateOne.mockResolvedValue({});
    ApiUsage.findOneAndUpdate.mockResolvedValue({ count: 1, windowStart: new Date() });
    const rejection = await enforceGeminiQuota({ identity: 'ip:1.2.3.4', quotaIdentity: 'ip:1.2.3.4' });
    expect(rejection).toBeNull();
    expect(ApiUsage.findOneAndUpdate).toHaveBeenCalled();
  });

  it('returns a 429 payload when the guest quota is exhausted', async () => {
    ApiUsage.updateOne.mockResolvedValue({});
    // Token-based quota: the guest's usage doc already has usedTokens at the
    // configured limit (5000, per the AppConfig mock above), windowStart
    // recent enough that the window isn't expired/reset. The atomic reserve
    // step's filter (usedTokens <= limit - RESERVE_ESTIMATE) then can't
    // match, so it returns null.
    ApiUsage.findOneAndUpdate
      .mockResolvedValueOnce({ identity: 'ip:1.2.3.4', usedTokens: 5000, windowStart: new Date() }) // upsert-if-missing
      .mockResolvedValueOnce(null); // reserve: already at limit
    const rejection = await enforceGeminiQuota({ identity: 'ip:1.2.3.4', quotaIdentity: 'ip:1.2.3.4' });
    expect(rejection).toMatchObject({ status: 429 });
  });
});

describe('POST /api/auth/verify-email', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('rejects a missing token with 400', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({});
    expect(res.status).toBe(400);
  });

  it('rejects an invalid/expired token with 400', async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/i);
  });

  it('verifies a valid token, leaving it valid for idempotent replays', async () => {
    User.findOneAndUpdate.mockResolvedValue({ _id: 'u1', email: 'a@b.com', emailVerified: true });
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'valid' });
    expect(res.status).toBe(200);
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: false }),
      { $set: { emailVerified: true } },
      { new: true }
    );
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('sends the welcome email once on first verification, not on a repeat call with the same token', async () => {
    // First call: the atomic false -> true update matches and claims the transition.
    User.findOneAndUpdate.mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', name: 'Ada', emailVerified: true });

    const first = await request(app).post('/api/auth/verify-email').send({ token: 'valid' });
    expect(first.status).toBe(200);
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith('a@b.com', 'Ada');

    // Re-verifying with the same token: the user is already verified, so the
    // atomic update (which requires emailVerified: false) matches nothing —
    // mimicking two independent reads/documents rather than a shared mutable
    // object — and the handler falls back to a plain findOne of the same user.
    User.findOneAndUpdate.mockResolvedValueOnce(null);
    User.findOne.mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', name: 'Ada', emailVerified: true });

    const second = await request(app).post('/api/auth/verify-email').send({ token: 'valid' });
    expect(second.status).toBe(200);
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it('sends exactly one welcome email when the same token is verified concurrently', async () => {
    // Simulate two concurrent requests racing on the same atomic update: only
    // one can match the emailVerified: false filter and claim the transition.
    User.findOneAndUpdate
      .mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', name: 'Ada', emailVerified: true })
      .mockResolvedValueOnce(null);
    User.findOne.mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', name: 'Ada', emailVerified: true });

    const [first, second] = await Promise.all([
      request(app).post('/api/auth/verify-email').send({ token: 'valid' }),
      request(app).post('/api/auth/verify-email').send({ token: 'valid' }),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/auth/request-password-reset (no enumeration)', () => {
  it('responds generically whether or not the account exists', async () => {
    jest.clearAllMocks();
    const app = createApp();
    User.findOne.mockResolvedValue(null);
    const res = await request(app).post('/api/auth/request-password-reset').send({ email: 'ghost@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
  });
});

describe('POST /api/auth/reset-password', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('rejects a short password with 400', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'x', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid/expired token with 400', async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'bad', password: 'longenough1' });
    expect(res.status).toBe(400);
  });

  it('resets the password with a valid token', async () => {
    const save = jest.fn().mockResolvedValue(true);
    User.findOne.mockResolvedValue({
      _id: 'u1', email: 'a@b.com',
      passwordResetTokenHash: 'hash',
      passwordResetExpires: new Date(Date.now() + 3600000),
      save,
    });
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'valid', password: 'newpassword1' });
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalled();
  });
});
