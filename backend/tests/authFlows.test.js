const request = require('supertest');

jest.mock('../models/User');
jest.mock('../models/ApiUsage');

const User = require('../models/User');
const ApiUsage = require('../models/ApiUsage');
const { enforceGeminiQuota } = require('../utils/geminiGate');

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
    ApiUsage.findOneAndUpdate.mockResolvedValue(null); // over the limit
    ApiUsage.findOne.mockResolvedValue({ count: 15, windowStart: new Date() });
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

  it('verifies a valid token and clears it', async () => {
    const save = jest.fn().mockResolvedValue(true);
    User.findOne.mockResolvedValue({ _id: 'u1', email: 'a@b.com', emailVerified: false, save });
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'valid' });
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalled();
    expect(res.body.user.emailVerified).toBe(true);
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
