const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../models/User');
jest.mock('../models/MasterProfile');
jest.mock('../models/Job');
jest.mock('../models/Resume');
jest.mock('../models/ChatSession');
jest.mock('../models/ApiUsage');

const User = require('../models/User');
const createApp = require('../app');

describe('POST /api/auth/signup', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('rejects a short password', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'a@b.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects signup when the email already exists', async () => {
    User.findOne.mockResolvedValue({ _id: '1', email: 'a@b.com' });
    const res = await request(app).post('/api/auth/signup').send({ email: 'a@b.com', password: 'longenough1' });
    expect(res.status).toBe(409);
  });

  it('creates a user, hashes the password, and sets a session cookie', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ _id: 'newid', email: 'new@b.com', name: 'New', geminiApiKeyEncrypted: null });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'new@b.com', password: 'longenough1', name: 'New' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@b.com', hasOwnKey: false });
    expect(res.body.user.passwordHash).toBeUndefined();

    const createArgs = User.create.mock.calls[0][0];
    expect(createArgs.passwordHash).not.toBe('longenough1'); // never store plaintext
    expect(await bcrypt.compare('longenough1', createArgs.passwordHash)).toBe(true);

    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => c.startsWith('token='))).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('rejects an unknown email', async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app).post('/api/auth/login').send({ email: 'nope@b.com', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    User.findOne.mockResolvedValue({ _id: '1', email: 'a@b.com', passwordHash });

    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in with correct credentials and sets a session cookie', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    User.findOne.mockResolvedValue({ _id: '1', email: 'a@b.com', name: 'A', passwordHash, geminiApiKeyEncrypted: null });

    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'correct-password' });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => c.startsWith('token='))).toBe(true);
  });
});

describe('BYOK gemini-key endpoints require auth', () => {
  it('rejects PUT /api/auth/gemini-key without a session', async () => {
    const app = createApp();
    const res = await request(app).put('/api/auth/gemini-key').send({ apiKey: 'AIzaSomeKeyValue' });
    expect(res.status).toBe(401);
  });

  it('rejects DELETE /api/auth/gemini-key without a session', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/auth/gemini-key');
    expect(res.status).toBe(401);
  });
});
