// The unguarded general-purpose chatbot is disabled (see routes/aiRoutes.js:
// no system instruction, topic scoping, or output moderation). These tests
// pin the routes to 404 so an unrelated refactor can't silently re-enable
// them without someone noticing.
const request = require('supertest');

const createApp = require('../app');

describe('disabled chatbot routes', () => {
  const app = createApp();

  it('POST /api/ai/start returns 404', async () => {
    const res = await request(app)
      .post('/api/ai/start')
      .send({ contextType: 'General' });
    expect(res.status).toBe(404);
  });

  it('POST /api/ai/send returns 404', async () => {
    const res = await request(app)
      .post('/api/ai/send')
      .send({ sessionId: 'abc', message: 'hi' });
    expect(res.status).toBe(404);
  });

  it('GET /api/ai/:sessionId (chat history) returns 404', async () => {
    const res = await request(app).get('/api/ai/507f1f77bcf86cd799439011');
    expect(res.status).toBe(404);
  });
});
