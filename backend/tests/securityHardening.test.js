const request = require('supertest');

jest.mock('../models/ApiUsage');
jest.mock('../models/MasterProfile');
jest.mock('../models/Resume');

const ApiUsage = require('../models/ApiUsage');
const MasterProfile = require('../models/MasterProfile');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

describe('guest AI quota is keyed on IP, not the rotatable guestId cookie', () => {
  it('uses the same quota key across two different guestId cookies from the same IP', async () => {
    const app = createApp();
    ApiUsage.findOne.mockResolvedValue(null);
    ApiUsage.create.mockResolvedValue({ identity: 'ip', count: 1, windowStart: new Date() });

    await request(app).get('/api/auth/quota').set('Cookie', 'guestId=aaaaaaaa-1111');
    await request(app).get('/api/auth/quota').set('Cookie', 'guestId=bbbbbbbb-2222');

    const keyA = ApiUsage.findOne.mock.calls[0][0].identity;
    const keyB = ApiUsage.findOne.mock.calls[1][0].identity;
    // Both look up the SAME key (ip:...) even though the guest cookie differs,
    // so rotating the cookie cannot reset the free quota.
    expect(keyA).toBe(keyB);
    expect(keyA).toMatch(/^ip:/);
  });
});

describe('master profile update rejects body-supplied owner (mass assignment)', () => {
  it('never lets the client set owner via the request body', async () => {
    const app = createApp();
    let capturedUpdate;
    MasterProfile.findOne.mockResolvedValue({ _id: 'p1' });
    MasterProfile.findByIdAndUpdate.mockImplementation((id, update) => {
      capturedUpdate = update;
      return Promise.resolve({ _id: 'p1', ...update.$set });
    });

    const res = await request(app)
      .post('/api/master')
      .send({ owner: 'someone-elses-id', user: { name: 'Legit' }, rawText: 'x' });

    expect(res.status).toBe(200);
    // owner must be stripped; only allow-listed fields survive.
    expect(capturedUpdate.$set.owner).toBeUndefined();
    expect(capturedUpdate.$set.user).toEqual({ name: 'Legit' });
  });
});

describe('query-string NoSQL operator injection is neutralized', () => {
  const { stripOperators } = require('../middleware/sanitize');

  it('strips $-operators and dotted keys from arbitrary query-shaped objects', () => {
    // Whatever a client tries to smuggle through the query string, the sanitizer
    // removes operator/dotted keys before it can reach a Mongoose filter.
    expect(stripOperators({ jobId: { $ne: '' } })).toEqual({ jobId: {} });
    expect(stripOperators({ jobId: { $gt: '', 'a.b': 1 }, ok: 'x' })).toEqual({ jobId: {}, ok: 'x' });
  });

  it('never lets a query operator reach Resume.find as a filter value', async () => {
    const Resume = require('../models/Resume');
    Resume.find = jest.fn().mockReturnValue({ populate: () => ({ sort: () => Promise.resolve([]) }) });
    const app = createApp();

    await request(app).get('/api/resumes?jobId[$ne]=');

    const queryArg = Resume.find.mock.calls[0][0];
    // job is either absent or a plain (operator-free) value — never { $ne: ... }.
    if (queryArg.job && typeof queryArg.job === 'object') {
      expect(Object.keys(queryArg.job).some((k) => k.startsWith('$'))).toBe(false);
    }
  });
});
