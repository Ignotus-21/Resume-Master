const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/User');
jest.mock('../services/quotaService');
jest.mock('../services/emailService');

const User = require('../models/User');
const { getQuotaStatus } = require('../services/quotaService');
const { sendContactNotification } = require('../services/emailService');
const createApp = require('../app');

const sign = (payload) =>
  jwt.sign({ sub: 'u1', email: 'a@b.com', name: 'A', v: 0, ...payload }, process.env.JWT_SECRET, { expiresIn: '1h' });

// Mirrors tokenRevocation.test.js: User.findById is called by identify()
// [.select('tokenVersion').lean()] then loadGeminiKey() [.select(...)]
// before the route handler runs.
const mockAuthLookups = () => {
  User.findById.mockReturnValueOnce({ select: () => ({ lean: async () => ({ tokenVersion: 0 }) }) });
  User.findById.mockReturnValueOnce({
    select: async () => ({ geminiApiKeyEncrypted: null, emailVerified: true, passwordHash: 'h', googleId: null }),
  });
};

describe('POST /api/support/contact', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/support/contact').send({ subject: 'General', message: 'hi' });
    expect(res.status).toBe(401);
    expect(sendContactNotification).not.toHaveBeenCalled();
  });

  it('rejects an invalid subject with 400', async () => {
    mockAuthLookups();
    const res = await request(app)
      .post('/api/support/contact')
      .set('Cookie', `token=${sign()}`)
      .send({ subject: 'Not a real subject', message: 'hi' });
    expect(res.status).toBe(400);
  });

  it('sends an email containing the user usage context on a valid submission', async () => {
    mockAuthLookups();
    getQuotaStatus.mockResolvedValue({ limit: 15000, remaining: 12000, isByok: false });
    sendContactNotification.mockResolvedValue({ delivered: true });

    const res = await request(app)
      .post('/api/support/contact')
      .set('Cookie', `token=${sign()}`)
      .send({ subject: 'More tokens', message: 'Please bump my limit' });

    expect(res.status).toBe(200);
    expect(sendContactNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        fromEmail: 'a@b.com',
        subject: 'More tokens',
        message: 'Please bump my limit',
        usage: { limit: 15000, remaining: 12000, isByok: false },
      })
    );
  });

  it('rate-limits after exceeding the contact route ceiling', async () => {
    // The route's rate limiter is instantiated once at module load and its
    // in-memory counter persists across tests in this file (createApp() re-runs
    // the app factory, not the route module). Reset modules so this test gets
    // its own limiter starting from zero, otherwise the boundary below would
    // shift by however many /contact requests earlier tests already made.
    jest.resetModules();
    const freshUser = require('../models/User');
    const freshQuota = require('../services/quotaService');
    const freshEmail = require('../services/emailService');
    const freshApp = require('../app')();

    const statuses = [];
    for (let i = 0; i < 11; i++) {
      freshUser.findById.mockReturnValueOnce({ select: () => ({ lean: async () => ({ tokenVersion: 0 }) }) });
      freshUser.findById.mockReturnValueOnce({
        select: async () => ({ geminiApiKeyEncrypted: null, emailVerified: true, passwordHash: 'h', googleId: null }),
      });
      freshQuota.getQuotaStatus.mockResolvedValue({ limit: 15000, remaining: 12000, isByok: false });
      freshEmail.sendContactNotification.mockResolvedValue({ delivered: true });
      const res = await request(freshApp)
        .post('/api/support/contact')
        .set('Cookie', `token=${sign()}`)
        .send({ subject: 'General', message: 'hi' });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([...Array(10).fill(200), 429]);
  }, 30000);
});
