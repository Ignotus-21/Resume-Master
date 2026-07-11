const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/User');
const User = require('../models/User');
const createApp = require('../app');

const sign = (payload) =>
  jwt.sign({ sub: 'u1', email: 'a@b.com', name: 'A', ...payload }, process.env.JWT_SECRET, { expiresIn: '1h' });

// User.findById is called up to three times per authenticated request, in
// order: identify() [.select('tokenVersion').lean()], loadGeminiKey()
// [.select(...)], then the route handler. Mock them in sequence.
const mockVersionLookup = (tokenVersion) =>
  User.findById.mockReturnValueOnce({ select: () => ({ lean: async () => ({ tokenVersion }) }) });
const mockGeminiKeyLookup = () =>
  User.findById.mockReturnValueOnce({
    select: async () => ({ geminiApiKeyEncrypted: null, emailVerified: true, passwordHash: 'h', googleId: null }),
  });
const mockMeLookup = () =>
  User.findById.mockResolvedValueOnce({ _id: 'u1', email: 'a@b.com', name: 'A', geminiApiKeyEncrypted: null });

describe('JWT revocation via tokenVersion', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('rejects a token minted before a version bump (falls back to guest)', async () => {
    mockVersionLookup(1); // user bumped to v1, token still carries v0
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${sign({ v: 0 })}`);
    expect(res.status).toBe(200);
    expect(res.body.guest).toBe(true);
  });

  it('accepts a token whose version matches the user record', async () => {
    mockVersionLookup(1);
    mockGeminiKeyLookup();
    mockMeLookup();
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${sign({ v: 1 })}`);
    expect(res.body.guest).toBe(false);
    expect(res.body.user.email).toBe('a@b.com');
  });

  it('treats legacy tokens without v as version 0', async () => {
    mockVersionLookup(0);
    mockGeminiKeyLookup();
    mockMeLookup();
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${sign({})}`);
    expect(res.body.guest).toBe(false);
  });

  it('fails open when the version lookup errors, instead of logging users out', async () => {
    User.findById.mockImplementationOnce(() => { throw new Error('db down'); });
    mockGeminiKeyLookup();
    mockMeLookup();
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${sign({ v: 0 })}`);
    expect(res.body.guest).toBe(false);
  });

  it('resetPassword bumps tokenVersion so old sessions die', async () => {
    const user = {
      passwordHash: 'old',
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockResolvedValue(user);
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'raw-reset-token', password: 'longenough1' });
    expect(res.status).toBe(200);
    expect(user.tokenVersion).toBe(1);
    expect(user.save).toHaveBeenCalled();
  });
});
