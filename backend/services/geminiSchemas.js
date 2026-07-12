// Response schemas for every structured Gemini call, in the SDK's
// OpenAPI-subset Schema format (see `Schema` in @google/generative-ai).
//
// Each GEMINI_CALLS entry is the single source of truth for that call's
// output shape: the same `schema` object is sent to Gemini as
// generationConfig.responseSchema AND walked locally by parseAndValidate(),
// so there is no second hand-authored definition to drift. `check` holds the
// semantic constraints a structural schema can't express (non-empty strings,
// numeric ranges) and lives adjacent to its schema for the same reason.
//
// Only fields in this SDK version's typed Schema surface are used here
// (type, description, nullable, enum, format, items, minItems, maxItems,
// properties, required) — anything richer belongs in `check`.
const { SchemaType } = require('@google/generative-ai');
const { AiError } = require('../utils/aiError');
const { SECTION_KEYS } = require('../shared/resume');

const str = (description) => ({
  type: SchemaType.STRING,
  ...(description ? { description } : {}),
});
const num = (description) => ({
  type: SchemaType.NUMBER,
  ...(description ? { description } : {}),
});
const bool = () => ({ type: SchemaType.BOOLEAN });
const arr = (items, extra = {}) => ({ type: SchemaType.ARRAY, items, ...extra });
// Every property is required by default: with responseSchema, Gemini then
// always emits the key (empty string/array when absent in the source), which
// matches the ""-not-null convention the IR and Mongoose models already use.
const obj = (properties, description) => ({
  type: SchemaType.OBJECT,
  properties,
  required: Object.keys(properties),
  ...(description ? { description } : {}),
});

const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
const allNonEmpty = (list, label) =>
  list.every(nonEmpty) ? null : `${label} must all be non-empty strings`;
const inRange = (n, lo, hi, label) =>
  n >= lo && n <= hi ? null : `${label} must be between ${lo} and ${hi}`;

// --- Resume content (the IR) -------------------------------------------------
// Field shapes mirror the MasterProfile/Resume models; the section list is
// derived from shared/resume.js SECTION_KEYS so a section added there without
// a schema here fails at module load, not mid-request in production.

const SECTION_SCHEMAS = {
  experience: arr(obj({
    company: str(),
    role: str(),
    startDate: str('"Month YYYY" format when possible'),
    endDate: str('"Month YYYY" or "Present"'),
    isCurrent: bool(),
    location: str(),
    bulletPoints: arr(str()),
    keywords: arr(str()),
  })),
  education: arr(obj({
    institution: str(),
    degree: str(),
    fieldOfStudy: str(),
    startDate: str(),
    endDate: str(),
    gpa: str(),
    coursework: arr(str()),
  })),
  projects: arr(obj({
    title: str(),
    techStack: arr(str()),
    description: str(),
    link: str(),
    bulletPoints: arr(str()),
  })),
  skills: obj({
    languages: arr(str()),
    frameworks: arr(str()),
    tools: arr(str()),
    other: arr(str()),
  }, 'Categorize skills intelligently across these four buckets'),
  certificates: arr(obj({ name: str(), issuer: str(), date: str(), link: str() })),
  achievements: arr(obj({ title: str(), description: str(), date: str() })),
  publications: arr(obj({ title: str(), link: str(), date: str(), description: str() })),
  volunteering: arr(obj({
    organization: str(),
    role: str(),
    startDate: str(),
    endDate: str(),
    description: str(),
  })),
  patents: arr(obj({
    title: str(),
    number: str(),
    date: str(),
    link: str(),
    description: str(),
  })),
  hobbies: arr(str()),
  customSections: arr(obj({
    title: str('Name of the section, e.g. "Awards"'),
    items: arr(obj({
      title: str(),
      subtitle: str(),
      date: str(),
      link: str(),
      description: str(),
      bullets: arr(str()),
    })),
  }), { description: 'Sections that fit none of the named ones (e.g. Awards, Speaking, Leadership)' }),
};

const contentProperties = {
  user: obj({
    name: str(),
    email: str(),
    phone: str(),
    linkedin: str(),
    github: str(),
    website: str(),
    location: str(),
    address: str(),
  }),
};
for (const key of SECTION_KEYS) {
  if (!SECTION_SCHEMAS[key]) {
    throw new Error(
      `No Gemini response schema for resume section "${key}" — ` +
      'shared/resume.js SECTION_KEYS and services/geminiSchemas.js are out of sync'
    );
  }
  contentProperties[key] = SECTION_SCHEMAS[key];
}

const RESUME_CONTENT_SCHEMA = obj(contentProperties);

// A structurally valid but entirely empty resume renders a blank document;
// fail loudly here instead.
const checkResumeContent = (content) => {
  const hasSkills = Object.values(content.skills || {}).some(
    (v) => Array.isArray(v) && v.length > 0
  );
  const hasSection = SECTION_KEYS.some((key) => {
    if (key === 'skills') return hasSkills;
    const v = content[key];
    return Array.isArray(v) && v.length > 0;
  });
  return nonEmpty(content.user && content.user.name) || hasSection
    ? null
    : 'resume content is completely empty';
};

// --- One entry per Gemini call ----------------------------------------------

const GEMINI_CALLS = {
  resumeContent: {
    schema: RESUME_CONTENT_SCHEMA,
    check: checkResumeContent,
  },
  rewriteBullet: {
    schema: obj({
      rewrites: arr(str(), {
        minItems: 3,
        maxItems: 3,
        description: 'Exactly 3 rewrites: tighter, metric-driven, impact-focused',
      }),
    }),
    check: (d) => allNonEmpty(d.rewrites, 'rewrites'),
  },
  suggestTitles: {
    schema: obj({ titles: arr(str(), { minItems: 3, maxItems: 5 }) }),
    check: (d) => allNonEmpty(d.titles, 'titles'),
  },
  coachQuestion: {
    schema: obj({ question: str('One short follow-up question') }),
    check: (d) => (nonEmpty(d.question) ? null : 'question must be a non-empty string'),
  },
  coachBullet: {
    schema: obj({ bullet: str('One strong STAR-style resume bullet') }),
    check: (d) => (nonEmpty(d.bullet) ? null : 'bullet must be a non-empty string'),
  },
  recommendations: {
    schema: obj({
      matchScore: num('Overall match score from 0 to 100'),
      missingSkills: arr(str()),
      missingKeywords: arr(str()),
      improvements: arr(str('Specific advice on what to add or change')),
      gapAnalysis: str('Summary of fit'),
    }),
    check: (d) => inRange(d.matchScore, 0, 100, 'matchScore'),
  },
  interviewQuestions: {
    schema: obj({
      questions: arr(str(), {
        minItems: 6,
        maxItems: 6,
        description: 'Six questions ordered from warm-up to challenging',
      }),
    }),
    check: (d) => allNonEmpty(d.questions, 'questions'),
  },
  interviewEvaluation: {
    schema: obj({
      score: num('Answer score from 0 to 100'),
      feedback: str('2-4 sentences of feedback'),
    }),
    check: (d) =>
      inRange(d.score, 0, 100, 'score') ||
      (nonEmpty(d.feedback) ? null : 'feedback must be a non-empty string'),
  },
  linkedin: {
    schema: obj({
      headline: str('Max 220 characters, keyword-rich'),
      about: str('First-person About section, 3-5 short paragraphs'),
      experienceHighlights: arr(str(), { minItems: 5, maxItems: 7 }),
    }),
    check: (d) =>
      nonEmpty(d.headline) && nonEmpty(d.about)
        ? allNonEmpty(d.experienceHighlights, 'experienceHighlights')
        : 'headline and about must be non-empty strings',
  },
  coverLetter: {
    schema: obj({
      body: str('The complete cover letter as plain text, paragraphs separated by blank lines'),
    }),
    check: (d) => (nonEmpty(d.body) ? null : 'body must be a non-empty string'),
  },
};

// --- Validation ---------------------------------------------------------------

const describeValue = (v) =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;

const walk = (value, schema, path, errors) => {
  if (errors.length >= 20) return; // a garbage payload doesn't need 400 errors
  if (value === null || value === undefined) {
    if (!(schema.nullable && value === null)) {
      errors.push(`${path}: expected ${schema.type}, got ${describeValue(value)}`);
    }
    return;
  }
  switch (schema.type) {
    case SchemaType.STRING:
      if (typeof value !== 'string') {
        errors.push(`${path}: expected string, got ${describeValue(value)}`);
      } else if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: "${value}" is not one of ${schema.enum.join(', ')}`);
      }
      break;
    case SchemaType.NUMBER:
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${path}: expected number, got ${describeValue(value)}`);
      }
      break;
    case SchemaType.INTEGER:
      if (!Number.isInteger(value)) {
        errors.push(`${path}: expected integer, got ${describeValue(value)}`);
      }
      break;
    case SchemaType.BOOLEAN:
      if (typeof value !== 'boolean') {
        errors.push(`${path}: expected boolean, got ${describeValue(value)}`);
      }
      break;
    case SchemaType.ARRAY: {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${describeValue(value)}`);
        return;
      }
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push(`${path}: expected at least ${schema.minItems} items, got ${value.length}`);
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push(`${path}: expected at most ${schema.maxItems} items, got ${value.length}`);
      }
      value.forEach((item, i) => walk(item, schema.items, `${path}[${i}]`, errors));
      break;
    }
    case SchemaType.OBJECT: {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path}: expected object, got ${describeValue(value)}`);
        return;
      }
      for (const key of schema.required || []) {
        if (value[key] === undefined) {
          errors.push(`${path}.${key}: missing required property`);
        }
      }
      for (const [key, propSchema] of Object.entries(schema.properties || {})) {
        if (value[key] !== undefined) {
          walk(value[key], propSchema, `${path}.${key}`, errors);
        }
      }
      break;
    }
    default:
      errors.push(`${path}: schema has unknown type "${schema.type}"`);
  }
};

// JSON.parse + structural walk against `schema` + the call's semantic `check`.
// Throws AiError (AI_BAD_RESPONSE) with the offending paths on `detail`;
// never returns a value that doesn't conform.
const parseAndValidate = (text, { schema, check }, label) => {
  let data;
  try {
    data = JSON.parse(text);
  } catch (cause) {
    throw new AiError('The AI returned an unreadable response. Please try again.', {
      code: 'AI_BAD_RESPONSE',
      detail: `${label}: response is not valid JSON: ${String(text).slice(0, 200)}`,
      cause,
    });
  }
  const errors = [];
  walk(data, schema, label, errors);
  if (errors.length === 0 && check) {
    const problem = check(data);
    if (problem) errors.push(`${label}: ${problem}`);
  }
  if (errors.length > 0) {
    throw new AiError('The AI returned an unexpected response. Please try again.', {
      code: 'AI_BAD_RESPONSE',
      detail: errors.slice(0, 5).join('; ') + (errors.length > 5 ? ` (+${errors.length - 5} more)` : ''),
    });
  }
  return data;
};

module.exports = { GEMINI_CALLS, parseAndValidate };
