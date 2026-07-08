const request = require('supertest');

jest.mock('../models/Job');
const Job = require('../models/Job');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const createApp = require('../app');

describe('POST /api/jobs (mass-assignment whitelist)', () => {
  let app;
  let savedPayload;

  beforeEach(() => {
    app = createApp();
    savedPayload = null;
    Job.mockImplementation(function (data) {
      savedPayload = data;
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(this);
    });
  });

  it('strips fields that are not in the allow-list', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({
        company: 'Acme',
        role: 'Engineer',
        isAdmin: true,
        __proto__: { polluted: true },
        someInternalField: 'hack',
      });

    expect(res.status).toBe(201);
    expect(savedPayload).toEqual({ company: 'Acme', role: 'Engineer', owner: expect.any(String) });
    expect(savedPayload.isAdmin).toBeUndefined();
    expect(savedPayload.someInternalField).toBeUndefined();
  });
});

describe('CORS allow-list', () => {
  it('rejects requests from a disallowed origin', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/jobs')
      .set('Origin', 'http://evil.example.com');
    expect(res.status).toBe(403);
  });

  it('allows requests from the configured origin', async () => {
    Job.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    const app = createApp();
    const res = await request(app)
      .get('/api/jobs')
      .set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(200);
  });
});

describe('ownership scoping', () => {
  let app;
  beforeEach(() => {
    app = createApp();
  });

  it('scopes GET /api/jobs to the caller\'s own identity', async () => {
    Job.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    await request(app).get('/api/jobs');
    expect(Job.find).toHaveBeenCalledWith({ owner: expect.any(String) });
  });

  it('gives two different guest sessions two different owner identities', async () => {
    Job.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    const first = await request(app).get('/api/jobs');
    const second = await request(app).get('/api/jobs'); // no cookie sent, so a fresh guestId is issued

    const ownerA = Job.find.mock.calls[0][0].owner;
    const ownerB = Job.find.mock.calls[1][0].owner;
    expect(ownerA).not.toEqual(ownerB);
  });

  it('scopes update/delete so one identity cannot touch another identity\'s job', async () => {
    Job.findOneAndUpdate.mockResolvedValue(null);
    const res = await request(app).put('/api/jobs/000000000000000000000000').send({ status: 'Applied' });
    expect(Job.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '000000000000000000000000', owner: expect.any(String) },
      expect.any(Object),
      expect.any(Object)
    );
    expect(res.status).toBe(404); // not found because it belongs to someone else / doesn't exist
  });
});
