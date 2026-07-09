const request = require('supertest');

jest.mock('../models/InterviewSession');
jest.mock('../models/MasterProfile');
jest.mock('../models/Job');
jest.mock('../models/ApiUsage');
jest.mock('../services/geminiService', () => ({
  generateInterviewQuestions: jest.fn().mockResolvedValue(['Tell me about yourself', 'Why this role?']),
  evaluateInterviewAnswer: jest.fn().mockResolvedValue({ score: 80, feedback: 'Solid answer.' }),
  parseResumeData: jest.fn(),
  tailorResume: jest.fn(),
  generateLatex: jest.fn(),
  getRecommendations: jest.fn(),
  generateCoverLetter: jest.fn(),
  generateLinkedInContent: jest.fn(),
}));

const InterviewSession = require('../models/InterviewSession');
const MasterProfile = require('../models/MasterProfile');
const ApiUsage = require('../models/ApiUsage');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

describe('mock interview endpoints', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    // Allow the shared-key quota gate (atomic flow).
    ApiUsage.updateOne.mockResolvedValue({});
    ApiUsage.findOneAndUpdate.mockResolvedValue({ count: 1, windowStart: new Date() });
  });

  it('start generates questions and scopes the session to the owner', async () => {
    MasterProfile.findOne.mockResolvedValue({ user: { name: 'A' } });
    InterviewSession.create.mockImplementation((doc) => Promise.resolve({ _id: 's1', ...doc }));

    const res = await request(app).post('/api/interview/start').send({ jdText: 'Frontend engineer' });
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(2);
    expect(InterviewSession.create).toHaveBeenCalledWith(expect.objectContaining({ owner: expect.any(String) }));
  });

  it('start rejects when no job/JD is provided', async () => {
    const res = await request(app).post('/api/interview/start').send({});
    expect(res.status).toBe(400);
  });

  it('answer is scoped to the owner and 404s for a session you do not own', async () => {
    InterviewSession.findOne.mockReturnValue({ populate: () => Promise.resolve(null) });
    const res = await request(app).post('/api/interview/answer').send({ sessionId: 'x', question: 'Q', answer: 'A' });
    expect(res.status).toBe(404);
    expect(InterviewSession.findOne).toHaveBeenCalledWith({ _id: 'x', owner: expect.any(String) });
  });
});
