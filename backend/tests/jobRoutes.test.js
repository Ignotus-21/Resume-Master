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
    expect(savedPayload).toEqual({ company: 'Acme', role: 'Engineer' });
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
