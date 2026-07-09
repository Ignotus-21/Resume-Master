const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/User');
const createApp = require('../app');

describe('identify middleware', () => {
  it('issues a guestId cookie on first visit when unauthenticated', async () => {
    const app = createApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null, guest: true });
    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => c.startsWith('guestId='))).toBe(true);
  });

  it('reuses the same guestId across requests when the cookie is sent back', async () => {
    const app = createApp();
    const first = await request(app).get('/api/auth/me');
    const guestCookie = first.headers['set-cookie'].find((c) => c.startsWith('guestId='));

    const second = await request(app).get('/api/auth/me').set('Cookie', guestCookie);
    // No new guestId should be issued since one was already sent.
    const setCookie = second.headers['set-cookie'] || [];
    expect(setCookie.some((c) => c.startsWith('guestId='))).toBe(false);
  });

  it('identifies a user from a valid JWT cookie instead of issuing a guest id', async () => {
    const User = require('../models/User');
    User.findById.mockResolvedValue({ _id: 'u1', email: 'a@b.com', name: 'A', geminiApiKeyEncrypted: null });

    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', name: 'A' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const app = createApp();
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'a@b.com' });
    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => c.startsWith('guestId='))).toBe(false);
  });

  it('falls back to a guest identity when the JWT is invalid/expired', async () => {
    const app = createApp();
    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=not-a-real-jwt');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null, guest: true });
    const setCookie = res.headers['set-cookie'] || [];
    expect(setCookie.some((c) => c.startsWith('guestId='))).toBe(true);
  });
});
