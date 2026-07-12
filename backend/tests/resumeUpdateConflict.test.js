// M7: PUT /api/resumes/:id detects concurrent edits via baseUpdatedAt.
// Last-write-wins stays the behavior — the save always applies — but a stale
// baseline must be flagged with conflict:true so the client can warn instead
// of clobbering silently.
const request = require('supertest');

jest.mock('../models/Resume');
const Resume = require('../models/Resume');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

const STORED_UPDATED_AT = new Date('2026-07-12T10:00:00.000Z');

const makeResume = () => {
  const resume = {
    _id: '000000000000000000000001',
    owner: 'someone',
    mode: 'structured',
    content: { user: { name: 'Ada' } },
    design: {},
    templateId: 'sheets',
    versionName: 'V1',
    updatedAt: new Date(STORED_UPDATED_AT),
    save: jest.fn().mockImplementation(() => {
      resume.updatedAt = new Date(); // mongoose bumps updatedAt on save
      return Promise.resolve(resume);
    }),
    populate: jest.fn().mockResolvedValue(undefined),
  };
  resume.toObject = () => {
    const { save, populate, toObject, ...rest } = resume;
    return rest;
  };
  return resume;
};

describe('updateResume concurrent-edit detection', () => {
  let app;
  let resume;
  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
    resume = makeResume();
    Resume.findOne.mockResolvedValue(resume);
  });

  const put = (body) =>
    request(app).put('/api/resumes/000000000000000000000001').send(body);

  it('flags conflict:true when baseUpdatedAt is older than the stored doc, but still saves', async () => {
    const res = await put({
      content: { user: { name: 'Ada (tab B)' } },
      baseUpdatedAt: '2026-07-12T09:00:00.000Z', // loaded before the 10:00 write
    });
    expect(res.status).toBe(200);
    expect(res.body.conflict).toBe(true);
    expect(resume.save).toHaveBeenCalled(); // last-write-wins: the save applied
    expect(res.body.content.user.name).toBe('Ada (tab B)');
  });

  it('does not flag a conflict when baseUpdatedAt matches the stored doc', async () => {
    const res = await put({
      content: { user: { name: 'Ada v2' } },
      baseUpdatedAt: STORED_UPDATED_AT.toISOString(),
    });
    expect(res.status).toBe(200);
    expect(res.body.conflict).toBeUndefined();
    expect(resume.save).toHaveBeenCalled();
  });

  it('legacy clients that send no baseUpdatedAt are unaffected', async () => {
    const res = await put({ content: { user: { name: 'Ada v2' } } });
    expect(res.status).toBe(200);
    expect(res.body.conflict).toBeUndefined();
    expect(resume.save).toHaveBeenCalled();
  });

  it('an unparseable baseUpdatedAt never flags a conflict or breaks the save', async () => {
    const res = await put({
      content: { user: { name: 'Ada v2' } },
      baseUpdatedAt: 'not-a-date',
    });
    expect(res.status).toBe(200);
    expect(res.body.conflict).toBeUndefined();
    expect(resume.save).toHaveBeenCalled();
  });
});
