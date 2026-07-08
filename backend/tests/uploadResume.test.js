const request = require('supertest');

jest.mock('../services/geminiService', () => ({
  parseResumeData: jest.fn().mockResolvedValue({ user: { name: 'Test' } }),
  tailorResume: jest.fn(),
  generateLatex: jest.fn(),
  getRecommendations: jest.fn(),
}));
jest.mock('../models/MasterProfile');
jest.mock('../models/Job');
jest.mock('../models/Resume');
jest.mock('../models/ApiUsage');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const ApiUsage = require('../models/ApiUsage');
const createApp = require('../app');

describe('POST /api/master/upload-resume', () => {
  let app;
  beforeEach(() => {
    app = createApp();
    ApiUsage.findOne.mockResolvedValue(null);
    ApiUsage.create.mockResolvedValue({ identity: 'guest', count: 1, windowStart: new Date() });
  });

  it('rejects non-PDF mimetypes', async () => {
    const res = await request(app)
      .post('/api/master/upload-resume')
      .attach('resume', Buffer.from('<html>not a pdf</html>'), {
        filename: 'resume.html',
        contentType: 'text/html',
      });
    expect(res.status).toBe(400);
  });

  it('rejects files that exceed the size limit', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 'a'); // 6MB > 5MB limit
    const res = await request(app)
      .post('/api/master/upload-resume')
      .attach('resume', big, { filename: 'resume.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });

  it('rejects a PDF-labelled file whose content is not really a PDF (magic bytes)', async () => {
    const fakePdf = Buffer.from('this is not really a pdf');
    const res = await request(app)
      .post('/api/master/upload-resume')
      .attach('resume', fakePdf, { filename: 'resume.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid PDF/i);
  });

  it('accepts a genuine small PDF', async () => {
    const realPdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('minimal pdf body')]);
    const res = await request(app)
      .post('/api/master/upload-resume')
      .attach('resume', realPdf, { filename: 'resume.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
  });
});
