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
jest.mock('../models/AppConfig');

process.env.CORS_ORIGIN = 'http://localhost:3000';
const ApiUsage = require('../models/ApiUsage');
const AppConfig = require('../models/AppConfig');
const createApp = require('../app');

describe('POST /api/master/upload-resume', () => {
  let app;
  beforeEach(() => {
    app = createApp();
    // Allow the shared-key quota gate (atomic flow: upsert + conditional inc).
    ApiUsage.updateOne.mockResolvedValue({});
    ApiUsage.findOneAndUpdate.mockResolvedValue({ identity: 'guest', count: 1, windowStart: new Date(), usedTokens: 0 });
    AppConfig.findOneAndUpdate.mockResolvedValue({ defaultTokenLimit: 15000, guestTokenLimit: 5000 });
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
    // fixtures/minimal.pdf is a real one-page PDF (compiled once with
    // Tectonic). The previous inline fixture only had the %PDF- magic bytes
    // and made pdf-parse throw InvalidPDFException, so this test always
    // failed; pdf-parse also rejects hand-rolled minimal xref tables.
    const realPdf = require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'minimal.pdf'));
    const res = await request(app)
      .post('/api/master/upload-resume')
      .attach('resume', realPdf, { filename: 'resume.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
  });

  const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  it('accepts a genuine DOCX (M9: multiple import formats)', async () => {
    // fixtures/minimal.docx is a real minimal OOXML package (built with
    // jszip; Compress-Archive is unusable — it writes backslash entry names).
    const realDocx = require('fs').readFileSync(require('path').join(__dirname, 'fixtures', 'minimal.docx'));
    const res = await request(app)
      .post('/api/master/upload-resume')
      .attach('resume', realDocx, { filename: 'resume.docx', contentType: DOCX_MIME });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Test');
  });

  it('rejects a DOCX-labelled file that is not really a ZIP container (magic bytes)', async () => {
    const fakeDocx = Buffer.from('plain text pretending to be a docx');
    const res = await request(app)
      .post('/api/master/upload-resume')
      .attach('resume', fakeDocx, { filename: 'resume.docx', contentType: DOCX_MIME });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid DOCX/i);
  });
});
