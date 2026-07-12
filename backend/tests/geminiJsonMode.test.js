// M6: every Gemini call uses structured output (responseMimeType +
// responseSchema) and validates the payload before anything downstream sees
// it. The Gemini client is mocked at the SDK boundary — geminiService's real
// prompt-building, parsing, and validation all run.

jest.mock('@google/generative-ai', () => {
  const generateContent = jest.fn();
  return {
    __generateContent: generateContent,
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn(() => ({ generateContent })),
    })),
    SchemaType: {
      STRING: 'string',
      NUMBER: 'number',
      INTEGER: 'integer',
      BOOLEAN: 'boolean',
      ARRAY: 'array',
      OBJECT: 'object',
    },
  };
});
jest.mock('../utils/trackUsage', () => ({ trackUsage: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/quotaService', () => ({ refundReservation: jest.fn().mockResolvedValue(undefined) }));

const { __generateContent } = require('@google/generative-ai');
const { trackUsage } = require('../utils/trackUsage');
const { refundReservation } = require('../services/quotaService');
const { AiError } = require('../utils/aiError');
const gemini = require('../services/geminiService');

const respondWith = (payload) => {
  __generateContent.mockResolvedValue({
    response: { text: () => (typeof payload === 'string' ? payload : JSON.stringify(payload)) },
  });
};

// Every top-level key and every per-item field is required by the schema, so
// the fixture is complete rather than minimal.
const validResumeContent = () => ({
  user: {
    name: 'Ada Lovelace', email: 'ada@example.com', phone: '', linkedin: '',
    github: '', website: '', location: 'London', address: '',
  },
  experience: [{
    company: 'Analytical Engines Ltd', role: 'Engineer', startDate: 'May 2021',
    endDate: 'Present', isCurrent: true, location: 'London',
    bulletPoints: ['Designed the first algorithm'], keywords: ['computation'],
  }],
  education: [{
    institution: 'Home Tutoring', degree: 'Mathematics', fieldOfStudy: 'Math',
    startDate: '', endDate: '', gpa: '', coursework: [],
  }],
  projects: [],
  skills: { languages: ['Ada'], frameworks: [], tools: [], other: [] },
  certificates: [],
  achievements: [],
  publications: [],
  volunteering: [],
  patents: [],
  hobbies: [],
  customSections: [],
});

const validRecommendations = () => ({
  matchScore: 78,
  missingSkills: ['Kubernetes'],
  missingKeywords: ['CI/CD'],
  improvements: ['Add metrics to bullets'],
  gapAnalysis: 'Strong core fit.',
});

const sixQuestions = () => ({
  questions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'],
});

const validLinkedin = () => ({
  headline: 'Engineer',
  about: 'I build things.',
  experienceHighlights: ['a', 'b', 'c', 'd', 'e'],
});

const expectAiBadResponse = async (promise, detailPattern) => {
  const err = await promise.then(
    () => { throw new Error('expected the call to reject'); },
    (e) => e
  );
  expect(err).toBeInstanceOf(AiError);
  expect(err.code).toBe('AI_BAD_RESPONSE');
  expect(err.status).toBe(502);
  expect(err.message).toMatch(/try again/i);
  if (detailPattern) expect(err.detail).toMatch(detailPattern);
  return err;
};

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => {
  console.error.mockRestore();
});
beforeEach(() => {
  jest.clearAllMocks();
});

// [name, invoke, valid payload] for every structured Gemini call.
const CALL_TABLE = [
  ['parseResumeData', () => gemini.parseResumeData('resume text'), validResumeContent()],
  ['tailorResume', () => gemini.tailorResume({}, 'JD'), validResumeContent()],
  ['rewriteBullet', () => gemini.rewriteBullet('Did stuff', 'SWE', 'JD'), { rewrites: ['a', 'b', 'c'] }],
  ['suggestTitles', () => gemini.suggestTitles('Engineer', 'JD'), { titles: ['a', 'b', 'c'] }],
  ['bulletCoach (question)', () => gemini.bulletCoach({ bullet: 'Did stuff' }), { question: 'How many?' }],
  ['bulletCoach (bullet)', () => gemini.bulletCoach({ bullet: 'Did stuff', answer: '3 services' }), { bullet: 'Shipped 3 services' }],
  ['getRecommendations', () => gemini.getRecommendations({}, 'JD'), validRecommendations()],
  ['generateCoverLetter', () => gemini.generateCoverLetter({}, 'JD', {}), { body: 'Dear Hiring Manager, ...' }],
  ['generateInterviewQuestions', () => gemini.generateInterviewQuestions('JD', {}), sixQuestions()],
  ['evaluateInterviewAnswer', () => gemini.evaluateInterviewAnswer('Q', 'A', 'JD'), { score: 80, feedback: 'Solid.' }],
  ['generateLinkedInContent', () => gemini.generateLinkedInContent({}), validLinkedin()],
];

describe('wire schemas contain only fields the Gemini API accepts', () => {
  // The real API 400s on unknown schema fields (caught live: a description
  // string spread into an arr() extra became {"0":"S","1":"e",...}). Walk
  // every call's schema and assert each level only carries fields from this
  // SDK version's typed Schema surface.
  const ALLOWED_BY_TYPE = {
    string: ['type', 'description', 'nullable', 'enum', 'format'],
    number: ['type', 'description', 'nullable', 'format'],
    integer: ['type', 'description', 'nullable', 'format'],
    boolean: ['type', 'description', 'nullable'],
    array: ['type', 'description', 'nullable', 'items', 'minItems', 'maxItems'],
    object: ['type', 'description', 'nullable', 'properties', 'required'],
  };

  const assertClean = (schema, path) => {
    const allowed = ALLOWED_BY_TYPE[schema.type];
    expect({ path, type: schema.type, known: Boolean(allowed) }).toEqual(
      { path, type: schema.type, known: true }
    );
    for (const key of Object.keys(schema)) {
      expect({ path, unexpectedField: allowed.includes(key) ? null : key }).toEqual(
        { path, unexpectedField: null }
      );
    }
    if (schema.type === 'array') assertClean(schema.items, `${path}.items`);
    if (schema.type === 'object') {
      for (const [key, prop] of Object.entries(schema.properties)) {
        assertClean(prop, `${path}.${key}`);
      }
    }
  };

  it('every GEMINI_CALLS schema is wire-clean', () => {
    const { GEMINI_CALLS } = require('../services/geminiSchemas');
    for (const [name, { schema }] of Object.entries(GEMINI_CALLS)) {
      assertClean(schema, name);
    }
  });
});

describe('every Gemini call requests structured JSON output', () => {
  it.each(CALL_TABLE)('%s sends responseMimeType + responseSchema', async (_name, invoke, payload) => {
    respondWith(payload);
    await invoke();
    expect(__generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        generationConfig: expect.objectContaining({
          responseMimeType: 'application/json',
          responseSchema: expect.objectContaining({ type: 'object' }),
        }),
      })
    );
  });

  it.each(CALL_TABLE)('%s resolves on a schema-conformant response', async (_name, invoke, payload) => {
    respondWith(payload);
    await expect(invoke()).resolves.toBeDefined();
  });
});

describe('parseResumeData / tailorResume (resume content schema)', () => {
  it('rejects a section of the wrong type', async () => {
    respondWith({ ...validResumeContent(), experience: { company: 'not an array' } });
    await expectAiBadResponse(gemini.parseResumeData('text'), /experience.*expected array/);
  });

  it('rejects an experience item missing a required field', async () => {
    const content = validResumeContent();
    delete content.experience[0].company;
    respondWith(content);
    await expectAiBadResponse(gemini.tailorResume({}, 'JD'), /experience\[0\]\.company.*missing/);
  });

  it('rejects structurally valid but completely empty content', async () => {
    const content = validResumeContent();
    content.user.name = '';
    content.experience = [];
    content.education = [];
    content.skills = { languages: [], frameworks: [], tools: [], other: [] };
    respondWith(content);
    await expectAiBadResponse(gemini.tailorResume({}, 'JD'), /empty/);
  });

  it('returns the parsed content object on success', async () => {
    respondWith(validResumeContent());
    const data = await gemini.parseResumeData('text');
    expect(data.user.name).toBe('Ada Lovelace');
    expect(data.experience).toHaveLength(1);
  });
});

describe('rewriteBullet', () => {
  it('returns the rewrites array on success', async () => {
    respondWith({ rewrites: ['tighter', 'metric-driven', 'impact-focused'] });
    await expect(gemini.rewriteBullet('b', 'r', 'jd')).resolves.toEqual([
      'tighter', 'metric-driven', 'impact-focused',
    ]);
  });

  it('rejects too few rewrites instead of silently returning them', async () => {
    respondWith({ rewrites: ['only', 'two'] });
    await expectAiBadResponse(gemini.rewriteBullet('b', 'r', 'jd'), /at least 3 items, got 2/);
  });

  it('rejects a non-array rewrites value', async () => {
    respondWith({ rewrites: 'one big string' });
    await expectAiBadResponse(gemini.rewriteBullet('b', 'r', 'jd'), /expected array, got string/);
  });

  it('rejects empty-string rewrites (schema-conformant but useless)', async () => {
    respondWith({ rewrites: ['a', '   ', 'c'] });
    await expectAiBadResponse(gemini.rewriteBullet('b', 'r', 'jd'), /non-empty/);
  });
});

describe('suggestTitles', () => {
  it('rejects an empty titles array instead of returning []', async () => {
    respondWith({ titles: [] });
    await expectAiBadResponse(gemini.suggestTitles('role', 'jd'), /at least 3 items, got 0/);
  });
});

describe('bulletCoach', () => {
  it('question mode rejects a bullet-shaped (schema-adjacent) response', async () => {
    respondWith({ bullet: 'a drafted bullet' });
    await expectAiBadResponse(gemini.bulletCoach({ bullet: 'thin' }), /question.*missing/);
  });

  it('bullet mode rejects a question-shaped (schema-adjacent) response', async () => {
    respondWith({ question: 'what scale?' });
    await expectAiBadResponse(gemini.bulletCoach({ bullet: 'thin', answer: '3 services' }), /bullet.*missing/);
  });
});

describe('getRecommendations (JD match scoring)', () => {
  it('rejects a stringified matchScore', async () => {
    respondWith({ ...validRecommendations(), matchScore: '85' });
    await expectAiBadResponse(gemini.getRecommendations({}, 'jd'), /matchScore.*expected number, got string/);
  });

  it('rejects an out-of-range matchScore', async () => {
    respondWith({ ...validRecommendations(), matchScore: 150 });
    await expectAiBadResponse(gemini.getRecommendations({}, 'jd'), /matchScore must be between 0 and 100/);
  });
});

describe('interview calls', () => {
  it('rejects an empty questions array', async () => {
    respondWith({ questions: [] });
    await expectAiBadResponse(gemini.generateInterviewQuestions('jd', {}), /at least 6 items, got 0/);
  });

  it('rejects a non-numeric answer score', async () => {
    respondWith({ score: 'high', feedback: 'nice' });
    await expectAiBadResponse(gemini.evaluateInterviewAnswer('q', 'a', 'jd'), /score.*expected number/);
  });
});

describe('generateLinkedInContent', () => {
  it('rejects a response missing experienceHighlights', async () => {
    const { experienceHighlights, ...rest } = validLinkedin();
    respondWith(rest);
    await expectAiBadResponse(gemini.generateLinkedInContent({}), /experienceHighlights.*missing/);
  });
});

describe('generateCoverLetter', () => {
  it('returns the letter body string on success', async () => {
    respondWith({ body: '  Dear Hiring Manager,\n\nI am writing...  ' });
    await expect(gemini.generateCoverLetter({}, 'jd', {})).resolves.toBe(
      'Dear Hiring Manager,\n\nI am writing...'
    );
  });

  it('rejects a whitespace-only body', async () => {
    respondWith({ body: '   ' });
    await expectAiBadResponse(gemini.generateCoverLetter({}, 'jd', {}), /non-empty/);
  });

  it('rejects raw prose that is not JSON', async () => {
    respondWith('Dear Hiring Manager, here is your letter.');
    await expectAiBadResponse(gemini.generateCoverLetter({}, 'jd', {}), /not valid JSON/);
  });
});

describe('markdown fences are a hard failure, not something to strip', () => {
  // With responseMimeType: application/json the model cannot emit fences; if
  // one ever shows up the schema isn't being honored and that must surface
  // as a bug, not be papered over by string manipulation.
  it('rejects fenced-but-otherwise-valid JSON', async () => {
    respondWith('```json\n' + JSON.stringify({ rewrites: ['a', 'b', 'c'] }) + '\n```');
    await expectAiBadResponse(gemini.rewriteBullet('b', 'r', 'jd'), /not valid JSON/);
  });
});

describe('quota reservation handling', () => {
  const req = { user: { id: 'u1' }, quotaReserved: true };

  it('refunds the reservation and never tracks usage on a malformed response', async () => {
    respondWith({ rewrites: [] });
    await expect(gemini.rewriteBullet('b', 'r', 'jd', null, req)).rejects.toBeInstanceOf(AiError);
    expect(refundReservation).toHaveBeenCalledWith(req);
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('refunds the reservation when the Gemini call itself fails', async () => {
    __generateContent.mockRejectedValue(new Error('ECONNRESET'));
    const err = await gemini.suggestTitles('r', 'jd', null, req).then(
      () => { throw new Error('expected rejection'); },
      (e) => e
    );
    expect(err).toBeInstanceOf(AiError);
    expect(err.code).toBe('AI_UNAVAILABLE');
    expect(err.status).toBe(502);
    expect(refundReservation).toHaveBeenCalledWith(req);
    expect(trackUsage).not.toHaveBeenCalled();
  });

  it('tracks usage and does not refund on a valid response', async () => {
    respondWith({ rewrites: ['a', 'b', 'c'] });
    await gemini.rewriteBullet('b', 'r', 'jd', null, req);
    expect(trackUsage).toHaveBeenCalledWith(req, 'bullet-rewrite', expect.anything());
    expect(refundReservation).not.toHaveBeenCalled();
  });

  it('does not touch quota when no req is passed (internal/keyless usage)', async () => {
    respondWith({ rewrites: [] });
    await expect(gemini.rewriteBullet('b', 'r', 'jd')).rejects.toBeInstanceOf(AiError);
    expect(refundReservation).not.toHaveBeenCalled();
  });
});
