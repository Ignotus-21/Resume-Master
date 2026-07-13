// M7: PUT /api/resumes/:id detects concurrent edits via baseUpdatedAt.
// When baseUpdatedAt is present the save is atomic: the Mongo filter itself
// requires updatedAt to still match, so a stale save is rejected with 409
// *before* any mutation instead of being applied and merely flagged after
// the fact. Clients that omit baseUpdatedAt keep the old unconditional save.
const request = require('supertest');

jest.mock('../models/Resume');
const Resume = require('../models/Resume');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

const STORED_UPDATED_AT = new Date('2026-07-12T10:00:00.000Z');

const withMongooseDocShape = (doc) => {
  doc.populate = jest.fn().mockResolvedValue(undefined);
  doc.toObject = () => {
    const { populate, toObject, save, ...rest } = doc;
    return rest;
  };
  return doc;
};

const makeResume = () => {
  const resume = withMongooseDocShape({
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
  });
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
    // Simulates the atomic filter: only "matches" (returns a doc) when the
    // filter's updatedAt still equals what's on the (unmutated) resume.
    Resume.findOneAndUpdate = jest.fn().mockImplementation(async (filter, update) => {
      if (filter.updatedAt.getTime() !== resume.updatedAt.getTime()) return null;
      const merged = { ...resume, ...(update.$set || {}) };
      for (const key of Object.keys(update.$unset || {})) delete merged[key];
      merged.updatedAt = new Date();
      return withMongooseDocShape(merged);
    });
  });

  const put = (body) =>
    request(app).put('/api/resumes/000000000000000000000001').send(body);

  it('rejects with 409 and does not mutate when baseUpdatedAt is stale', async () => {
    const res = await put({
      content: { user: { name: 'Ada (tab B)' } },
      baseUpdatedAt: '2026-07-12T09:00:00.000Z', // loaded before the 10:00 write
    });
    expect(res.status).toBe(409);
    expect(res.body.conflict).toBe(true);
    expect(resume.save).not.toHaveBeenCalled();
    expect(resume.content.user.name).toBe('Ada'); // unchanged
  });

  it('saves atomically and returns no conflict when baseUpdatedAt matches the stored doc', async () => {
    const res = await put({
      content: { user: { name: 'Ada v2' } },
      baseUpdatedAt: STORED_UPDATED_AT.toISOString(),
    });
    expect(res.status).toBe(200);
    expect(res.body.conflict).toBeUndefined();
    expect(Resume.findOneAndUpdate).toHaveBeenCalled();
    expect(resume.save).not.toHaveBeenCalled();
    expect(res.body.content.user.name).toBe('Ada v2');
  });

  it('legacy clients that send no baseUpdatedAt fall back to the unconditional save', async () => {
    const res = await put({ content: { user: { name: 'Ada v2' } } });
    expect(res.status).toBe(200);
    expect(res.body.conflict).toBeUndefined();
    expect(resume.save).toHaveBeenCalled();
    expect(Resume.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('an unparseable baseUpdatedAt falls back to the unconditional save', async () => {
    const res = await put({
      content: { user: { name: 'Ada v2' } },
      baseUpdatedAt: 'not-a-date',
    });
    expect(res.status).toBe(200);
    expect(res.body.conflict).toBeUndefined();
    expect(resume.save).toHaveBeenCalled();
    expect(Resume.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
