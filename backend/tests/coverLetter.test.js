const request = require('supertest');

jest.mock('../models/CoverLetter');
jest.mock('../models/MasterProfile');
jest.mock('../models/Job');
jest.mock('../models/ApiUsage');
jest.mock('../services/geminiService', () => ({
  generateCoverLetter: jest.fn().mockResolvedValue('Dear Hiring Manager, ...'),
  parseResumeData: jest.fn(),
  tailorResume: jest.fn(),
  generateLatex: jest.fn(),
  getRecommendations: jest.fn(),
  generateInterviewQuestions: jest.fn(),
  evaluateInterviewAnswer: jest.fn(),
  generateLinkedInContent: jest.fn(),
}));

const CoverLetter = require('../models/CoverLetter');
const MasterProfile = require('../models/MasterProfile');
const ApiUsage = require('../models/ApiUsage');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

describe('cover letters are owner-scoped', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    // Allow the shared-key quota gate (atomic flow).
    ApiUsage.updateOne.mockResolvedValue({});
    ApiUsage.findOneAndUpdate.mockResolvedValue({ count: 1, windowStart: new Date() });
  });

  it('scopes the list query to the caller identity', async () => {
    CoverLetter.find.mockReturnValue({ populate: () => ({ sort: () => Promise.resolve([]) }) });
    await request(app).get('/api/cover-letters');
    expect(CoverLetter.find).toHaveBeenCalledWith({ owner: expect.any(String) });
  });

  it('returns 404 (not another user\'s letter) when fetching an id you do not own', async () => {
    CoverLetter.findOne.mockReturnValue({ populate: () => Promise.resolve(null) });
    const res = await request(app).get('/api/cover-letters/000000000000000000000000');
    expect(res.status).toBe(404);
    expect(CoverLetter.findOne).toHaveBeenCalledWith({ _id: '000000000000000000000000', owner: expect.any(String) });
  });

  it('generate requires a master profile and scopes the created letter to the owner', async () => {
    MasterProfile.findOne.mockResolvedValue({ user: { name: 'A' } });
    CoverLetter.create.mockImplementation((doc) => Promise.resolve({ _id: 'c1', ...doc }));

    const res = await request(app).post('/api/cover-letters/generate').send({ jdText: 'Build things', tone: 'Professional' });
    expect(res.status).toBe(200);
    expect(CoverLetter.create).toHaveBeenCalledWith(expect.objectContaining({ owner: expect.any(String), body: expect.any(String) }));
  });
});
