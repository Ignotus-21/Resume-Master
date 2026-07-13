// PUT /api/resumes/:id with mode:'latex' (eject) commonly carries
// content/design/templateId in the SAME request (see useWorkspace.ts
// eject()) — the frozen latexSource must render from those just-submitted
// values, not from the resume's pre-update fields, or a content/design edit
// made right before ejecting would silently be dropped from the freeze.
const request = require('supertest');

jest.mock('../models/Resume');
const Resume = require('../models/Resume');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

const withMongooseDocShape = (doc) => {
  doc.populate = jest.fn().mockResolvedValue(undefined);
  doc.toObject = () => {
    const { populate, toObject, save, ...rest } = doc;
    return rest;
  };
  return doc;
};

describe('updateResume eject uses this request\'s content/design/templateId', () => {
  let app;
  let resume;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    resume = withMongooseDocShape({
      _id: '000000000000000000000001',
      owner: 'someone',
      mode: 'structured',
      content: { user: { name: 'Old Name' } },
      design: {},
      templateId: 'sheets',
      versionName: 'V1',
      updatedAt: new Date('2026-07-12T10:00:00.000Z'),
      save: jest.fn().mockImplementation(() => Promise.resolve(resume)),
    });
    Resume.findOne.mockResolvedValue(resume);
  });

  it('freezes latexSource from the new content sent alongside mode:latex, not the stale doc', async () => {
    const res = await request(app)
      .put('/api/resumes/000000000000000000000001')
      .send({
        content: { user: { name: 'New Name' } },
        design: {},
        templateId: 'sheets',
        mode: 'latex',
      });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('latex');
    expect(res.body.latexSource).toContain('New Name');
    expect(res.body.latexSource).not.toContain('Old Name');
  });
});
