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
    let lastStatus;
    for (let i = 0; i < 11; i++) {
      mockAuthLookups();
      getQuotaStatus.mockResolvedValue({ limit: 15000, remaining: 12000, isByok: false });
      sendContactNotification.mockResolvedValue({ delivered: true });
      const res = await request(app)
        .post('/api/support/contact')
        .set('Cookie', `token=${sign()}`)
        .send({ subject: 'General', message: 'hi' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  }, 30000);
});
