const request = require('supertest');

jest.mock('../models/ChatSession');
const ChatSession = require('../models/ChatSession');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

describe('AI route rate limiting', () => {
  it('returns 429 after exceeding the strict AI rate limit', async () => {
    ChatSession.create.mockResolvedValue({ id: '1', history: [] });
    const app = createApp();

    let lastStatus;
    for (let i = 0; i < 61; i++) {
      const res = await request(app)
        .post('/api/ai/start')
        .send({ contextType: 'job', contextId: 'abc' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  }, 30000);
});
