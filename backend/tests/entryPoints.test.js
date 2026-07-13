// M9: POST /api/resumes/generate is the single generation endpoint with three
// entry paths — saved job (jobId), pasted JD (jdText, Job auto-created from
// the tailor call's job meta), and neither (instant base resume from the
// MasterProfile, no AI call and no quota charge).
const request = require('supertest');

jest.mock('../services/geminiService', () => ({
  tailorResume: jest.fn(),
  tailorResumeWithJobMeta: jest.fn(),
  getRecommendations: jest.fn(),
  parseResumeData: jest.fn(),
}));
jest.mock('../utils/geminiGate', () => ({
  enforceGeminiQuota: jest.fn().mockResolvedValue(null),
}));
jest.mock('../models/MasterProfile');
jest.mock('../models/Job');
// Manual Resume mock: the controller does `new Resume(fields)` then
// `withLatex(resume)`, so instances must carry their fields and a working
// toObject() — jest's automock provides neither.
jest.mock('../models/Resume', () =>
  jest.fn().mockImplementation(function (doc) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
    this.toObject = () => {
      const { save, toObject, ...rest } = this;
      return rest;
    };
  })
);

const { tailorResume, tailorResumeWithJobMeta } = require('../services/geminiService');
const { enforceGeminiQuota } = require('../utils/geminiGate');
const MasterProfile = require('../models/MasterProfile');
const Job = require('../models/Job');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

const makeProfile = () => {
  const profile = {
    _id: 'p1',
    owner: 'someone',
    user: { name: 'Ada Lovelace', email: 'ada@example.com' },
    experience: [
      {
        _id: 'sub1', // must be stripped from base-resume content
        company: 'Analytical Engines Ltd',
        role: 'Engineer',
        bulletPoints: ['Designed the first algorithm'],
      },
    ],
    education: [],
    skills: { languages: ['Ada'], frameworks: [], tools: [], other: [] },
  };
  profile.toObject = () => {
    const { toObject, ...rest } = profile;
    return rest;
  };
  return profile;
};

const tailoredContent = () => ({
  user: { name: 'Ada Lovelace' },
  experience: [{ company: 'Analytical Engines Ltd', role: 'Engineer', bulletPoints: ['Tailored bullet'] }],
});

describe('POST /api/resumes/generate entry paths', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    MasterProfile.findOne.mockResolvedValue(makeProfile());
  });

  const generate = (body) => request(app).post('/api/resumes/generate').send(body);

  describe('pasted JD (jdText only)', () => {
    beforeEach(() => {
      tailorResumeWithJobMeta.mockResolvedValue({
        job: { role: 'Senior Backend Engineer', company: 'Acme Corp' },
        resume: tailoredContent(),
      });
      Job.create.mockImplementation(async (fields) => ({ _id: 'job-new', ...fields }));
    });

    it('creates the Job record behind the scenes and links the resume to it', async () => {
      const res = await generate({ jdText: 'We are hiring a Senior Backend Engineer at Acme Corp...' });
      expect(res.status).toBe(200);
      expect(Job.create).toHaveBeenCalledWith({
        owner: expect.any(String),
        role: 'Senior Backend Engineer',
        company: 'Acme Corp',
        jdText: 'We are hiring a Senior Backend Engineer at Acme Corp...',
        status: 'Wishlist',
      });
      // The response carries the populated job so the workspace's Match
      // panel works immediately, without a refetch.
      expect(res.body.job.role).toBe('Senior Backend Engineer');
      expect(res.body.versionName).toMatch(/Acme_Corp/);
      expect(res.body.content.experience[0].bulletPoints).toEqual(['Tailored bullet']);
      expect(tailorResume).not.toHaveBeenCalled();
    });

    it('falls back to a placeholder company when the JD never names one', async () => {
      tailorResumeWithJobMeta.mockResolvedValue({
        job: { role: 'Data Analyst', company: '' },
        resume: tailoredContent(),
      });
      const res = await generate({ jdText: 'Looking for a data analyst...' });
      expect(res.status).toBe(200);
      expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({ company: 'Unknown Company' }));
    });

    it('rejects an oversized jdText before doing any work', async () => {
      const res = await generate({ jdText: 'x'.repeat(20001) });
      expect(res.status).toBe(400);
      expect(tailorResumeWithJobMeta).not.toHaveBeenCalled();
      expect(enforceGeminiQuota).not.toHaveBeenCalled();
    });
  });

  describe('base resume (no jobId, no jdText)', () => {
    it('builds the resume straight from the profile with no AI call and no quota charge', async () => {
      const res = await generate({});
      expect(res.status).toBe(200);
      expect(tailorResume).not.toHaveBeenCalled();
      expect(tailorResumeWithJobMeta).not.toHaveBeenCalled();
      expect(enforceGeminiQuota).not.toHaveBeenCalled();
      expect(Job.create).not.toHaveBeenCalled();
      expect(res.body.job).toBeUndefined();
      expect(res.body.content.user.name).toBe('Ada Lovelace');
      expect(res.body.content.experience[0].company).toBe('Analytical Engines Ltd');
      // Mongo bookkeeping must not leak into the IR content.
      expect(res.body.content.experience[0]._id).toBeUndefined();
      expect(res.body.versionName).toMatch(/^Ada_Base_Resume_/);
      // Derived LaTeX is present, i.e. the doc is immediately renderable.
      expect(typeof res.body.latex).toBe('string');
      expect(res.body.latex).toContain('Analytical Engines Ltd');
    });

    it('404s with a helpful message when the profile is empty', async () => {
      const empty = makeProfile();
      empty.user = {};
      empty.experience = [];
      empty.skills = { languages: [], frameworks: [], tools: [], other: [] };
      MasterProfile.findOne.mockResolvedValue(empty);
      const res = await generate({});
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/profile is empty/i);
    });
  });

  describe('saved job (jobId)', () => {
    it('still tailors against the stored job and links it', async () => {
      Job.findOne.mockResolvedValue({
        _id: 'job1',
        role: 'Engineer',
        company: 'ExistingCo',
        jdText: 'stored jd',
      });
      tailorResume.mockResolvedValue(tailoredContent());
      const res = await generate({ jobId: 'job1' });
      expect(res.status).toBe(200);
      expect(tailorResume).toHaveBeenCalledWith(
        expect.anything(), 'stored jd', undefined, expect.anything()
      );
      expect(tailorResumeWithJobMeta).not.toHaveBeenCalled();
      expect(Job.create).not.toHaveBeenCalled();
      expect(res.body.versionName).toMatch(/ExistingCo/);
    });
  });
});
