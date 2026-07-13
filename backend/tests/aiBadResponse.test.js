// M6 end-to-end (route level): a Gemini response that violates the schema
// must reach the user as a clean 502 with a friendly message — not a raw
// 500 — and the quota reservation taken at admission must be refunded.
// Only the SDK and the DB models are mocked; middleware, quota gate,
// geminiService, and validation are all real.
const request = require('supertest');

jest.mock('@google/generative-ai', () => {
  const generateContent = jest.fn();
  return {
    __generateContent: generateContent,
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn(() => ({ generateContent })),
    })),
    SchemaType: {
      STRING: 'string',
      NUMBER: 'number',
      INTEGER: 'integer',
      BOOLEAN: 'boolean',
      ARRAY: 'array',
      OBJECT: 'object',
    },
  };
});
jest.mock('../models/ApiUsage');
jest.mock('../models/AppConfig');

const { __generateContent } = require('@google/generative-ai');
const ApiUsage = require('../models/ApiUsage');
const AppConfig = require('../models/AppConfig');
const { RESERVE_ESTIMATE } = require('../services/quotaService');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

describe('malformed Gemini output surfaces as a clean error, not a 500', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    // Allow the shared-key quota gate (atomic flow).
    ApiUsage.updateOne.mockResolvedValue({});
    ApiUsage.findOneAndUpdate.mockResolvedValue({ count: 1, windowStart: new Date(), usedTokens: 0 });
    AppConfig.findOneAndUpdate.mockResolvedValue({ defaultTokenLimit: 15000, guestTokenLimit: 5000 });
  });

  it('returns 502 AI_BAD_RESPONSE with a user-facing message on a schema violation', async () => {
    __generateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ rewrites: 'not-an-array' }) },
    });

    const res = await request(app).post('/api/ai/rewrite-bullet').send({ bullet: 'Did stuff' });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_BAD_RESPONSE');
    expect(res.body.message).toMatch(/try again/i);
    expect(res.body.message).not.toBe('Something went wrong');
  });

  it('refunds the quota reservation on the bad-response branch', async () => {
    __generateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ rewrites: 'not-an-array' }) },
    });

    await request(app).post('/api/ai/rewrite-bullet').send({ bullet: 'Did stuff' });

    // Admission reserved +RESERVE_ESTIMATE; the failure branch must credit
    // the same amount back to the guest identity's usage record.
    const refundCall = ApiUsage.findOneAndUpdate.mock.calls.find(
      ([, update]) => update && update.$inc && update.$inc.usedTokens < 0
    );
    expect(refundCall).toBeTruthy();
    expect(refundCall[1].$inc.usedTokens).toBe(-RESERVE_ESTIMATE);
  });

  it('returns 502 AI_UNAVAILABLE when the Gemini call itself fails', async () => {
    __generateContent.mockRejectedValue(new Error('ECONNRESET'));

    const res = await request(app).post('/api/ai/rewrite-bullet').send({ bullet: 'Did stuff' });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('AI_UNAVAILABLE');
    expect(res.body.message).toMatch(/try again/i);
  });

  it('still returns the parsed result when the response honors the schema', async () => {
    __generateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ rewrites: ['a', 'b', 'c'] }) },
    });

    const res = await request(app).post('/api/ai/rewrite-bullet').send({ bullet: 'Did stuff' });

    expect(res.status).toBe(200);
    expect(res.body.rewrites).toEqual(['a', 'b', 'c']);
  });
});
