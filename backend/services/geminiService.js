const { trackUsage } = require('../utils/trackUsage');
const { refundReservation } = require('./quotaService');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { AiError } = require('../utils/aiError');
const { GEMINI_CALLS, parseAndValidate } = require('./geminiSchemas');

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.5-flash";

// Per-attempt cap on how long a single Gemini request may run. emailService
// and turnstileService already bound their upstream calls this way; without
// it a wedged Gemini request held the client's HTTP response open for 1-2
// minutes until the client gave up (HTTP 499). The SDK turns this into an
// AbortController deadline on its fetch.
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 28000;
const GEMINI_RETRY_BACKOFF_MS = Number(process.env.GEMINI_RETRY_BACKOFF_MS) || 1000;
const GEMINI_REQUEST_OPTIONS = { timeout: GEMINI_TIMEOUT_MS };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry only failures a second attempt can plausibly fix: Google-side 503
// ("high demand... usually temporary") and network-level failures (fetch
// failed / ECONNRESET and friends). Everything else is not retried:
//  - other HTTP statuses (400/safety/etc.) fail identically on retry and
//    would just burn quota;
//  - our own timeout abort — an attempt that already ran GEMINI_TIMEOUT_MS
//    is unlikely to finish in another, and retrying it would double the
//    worst-case wait the timeout exists to bound.
const isRetryableGeminiError = (error) => {
  if (!error) return false;
  // GoogleGenerativeAIFetchError carries the upstream HTTP status.
  if (typeof error.status === 'number') return error.status === 503;
  const text = [
    error.message,
    error.cause && error.cause.message,
    error.cause && error.cause.code,
  ].filter(Boolean).join(' ');
  if (/abort/i.test(text)) return false;
  return /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|EAI_AGAIN|socket hang up|network/i.test(text);
};

const callGeminiWithRetry = async (attempt) => {
  try {
    return await attempt();
  } catch (error) {
    if (!isRetryableGeminiError(error)) throw error;
    await sleep(GEMINI_RETRY_BACKOFF_MS);
    return attempt();
  }
};

let defaultClient = null;
const getModel = (apiKey) => {
  if (apiKey) {
    return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL_NAME });
  }
  if (!defaultClient) {
    defaultClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return defaultClient.getGenerativeModel({ model: MODEL_NAME });
};

// Every Gemini call goes through here. Structured output (responseMimeType +
// responseSchema) means the model decodes straight into the call's schema —
// no prose, no markdown fences, so nothing here ever strips ``` from a
// response; a payload that still needs that is a schema bug to chase, not a
// case to handle. parseAndValidate then rejects anything schema-adjacent but
// wrong (see geminiSchemas.js).
//
// trackUsage — which trues up the quota reservation to real cost — runs only
// AFTER the payload is proven usable. Any failure before that (upstream
// error, unreadable JSON, schema violation) lands in the catch with the
// reservation still outstanding, so refundReservation gives it back and the
// user isn't charged for a response they never got to use.
const generateJson = async ({ apiKey, req, service, call, label, parts }) => {
  const model = getModel(apiKey);
  let tracked = false;
  try {
    const result = await callGeminiWithRetry(() => model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: call.schema,
      },
    }, GEMINI_REQUEST_OPTIONS));
    const response = await result.response;
    const data = parseAndValidate(response.text(), call, label);
    if (req) { await trackUsage(req, service, result); tracked = true; }
    return data;
  } catch (error) {
    console.error(`Gemini ${label} error:`, error.detail || error);
    if (req && !tracked) await refundReservation(req).catch(() => {});
    if (error instanceof AiError) throw error;
    throw new AiError('The AI service is currently unavailable. Please try again shortly.', {
      code: 'AI_UNAVAILABLE',
      cause: error,
    });
  }
};

const parseResumeData = async (input, apiKey, req = null) => {
  const isBuffer = Buffer.isBuffer(input);

  // The output shape is enforced by the response schema; the prompt only has
  // to carry the semantic rules the schema can't express.
  const systemInstruction = `
    You are a strict Resume Parsing Agent. Extract data from the resume into the required JSON structure.

    RULES:
    1. If a field is missing, use "" (empty string) or [] (empty array). DO NOT invent data.
    2. Standardize dates to "Month YYYY" format if possible.
    3. Categorize skills intelligently across languages, frameworks, tools, other.
    4. UNKNOWN SECTIONS: If you find sections that fit none of the named ones (e.g. "Awards", "Speaking", "Leadership"), put them in 'customSections'.
  `;

  let parts = [];
  if (isBuffer) {
      parts = [
          { text: systemInstruction },
          {
              inlineData: {
                  mimeType: "application/pdf",
                  data: input.toString("base64")
              }
          }
      ];
  } else {
      parts = [{ text: `${systemInstruction}\n\nText to parse:\n${input}` }];
  }

  return generateJson({
    apiKey,
    req,
    service: 'resume-parser',
    call: GEMINI_CALLS.resumeContent,
    label: 'resume parse',
    parts,
  });
};

const tailorResume = async (masterData, jobDescription, apiKey, req = null) => {
  const prompt = `
    You are an ATS Resume Optimizer.
    I have a Master Resume Data (JSON) and a Job Description.

    CRITICAL INSTRUCTIONS:
    1. **INCLUDE ALL SECTIONS**: You MUST include 'skills', 'certificates', 'achievements', 'projects', 'education', 'experience' if present in the master data.
    2. **DO NOT DROP SKILLS**: Include ALL technical skills from the master profile. Do not filter them out.
    3. **DO NOT DROP CERTIFICATES**: Include all certificates.
    4. **Tailor Descriptions**: Rewrite bullet points in 'experience' and 'projects' to highlight keywords from the Job Description.

    Master Resume: ${JSON.stringify(masterData)}

    Job Description: ${jobDescription}
  `;

  return generateJson({
    apiKey,
    req,
    service: 'resume-tailor',
    call: GEMINI_CALLS.resumeContent,
    label: 'resume tailor',
    parts: [{ text: prompt }],
  });
};

// Paste-a-JD fast path: same tailoring as tailorResume, but the response also
// carries the job's role/company so the caller can create the Job record
// without a second Gemini call. Returns { job: { role, company }, resume }.
const tailorResumeWithJobMeta = async (masterData, jobDescription, apiKey, req = null) => {
  const prompt = `
    You are an ATS Resume Optimizer.
    I have a Master Resume Data (JSON) and a Job Description.

    CRITICAL INSTRUCTIONS:
    1. **INCLUDE ALL SECTIONS**: You MUST include 'skills', 'certificates', 'achievements', 'projects', 'education', 'experience' if present in the master data.
    2. **DO NOT DROP SKILLS**: Include ALL technical skills from the master profile. Do not filter them out.
    3. **DO NOT DROP CERTIFICATES**: Include all certificates.
    4. **Tailor Descriptions**: Rewrite bullet points in 'experience' and 'projects' to highlight keywords from the Job Description.
    5. **Name the job**: In 'job', report the job title and company name stated in the Job Description. Use "" for the company if it is never named; never invent one.

    Master Resume: ${JSON.stringify(masterData)}

    Job Description: ${jobDescription}
  `;

  return generateJson({
    apiKey,
    req,
    service: 'resume-tailor',
    call: GEMINI_CALLS.resumeContentWithJobMeta,
    label: 'resume tailor with job meta',
    parts: [{ text: prompt }],
  });
};

// v2 invariant: Gemini NEVER emits LaTeX. It does JSON->JSON content
// operations only; rendering is backend/services/latex/render.js. The old
// generateLatex() lived here — do not reintroduce anything like it.

const rewriteBullet = async (bullet, roleContext, jobDescription, apiKey, req = null) => {
  const prompt = `
    You are a resume writing coach. Rewrite the resume bullet point below.

    RULES:
    1. Produce exactly 3 alternative rewrites: one tighter, one more metric-driven, one more impact-focused.
    2. Keep every rewrite truthful to the original — never invent metrics, tools, or scope that are not stated or clearly implied.
    3. Strong action verb first, no first person, no trailing period unless the original had one.

    Role context: ${roleContext || 'not specified'}
    ${jobDescription ? `Target job description (optimize keyword relevance): ${jobDescription}` : ''}

    Bullet: ${bullet}
  `;

  const data = await generateJson({
    apiKey,
    req,
    service: 'bullet-rewrite',
    call: GEMINI_CALLS.rewriteBullet,
    label: 'bullet rewrite',
    parts: [{ text: prompt }],
  });
  return data.rewrites;
};

const suggestTitles = async (role, jobDescription, apiKey, req = null) => {
  const prompt = `
    You are a resume coach. Suggest 3-5 job title variants for the candidate's
    role that better match the target job description.

    HONESTY GUARDRAIL: suggest only truthful variants of the SAME role — you may
    modernize wording or align vocabulary with the JD, but NEVER inflate
    seniority, scope, or responsibilities.

    Candidate's actual role: ${JSON.stringify(role)}
    Target job description: ${jobDescription}
  `;

  const data = await generateJson({
    apiKey,
    req,
    service: 'title-suggest',
    call: GEMINI_CALLS.suggestTitles,
    label: 'title suggest',
    parts: [{ text: prompt }],
  });
  return data.titles;
};

// The "Work Experience Assistant": with no answer, asks ONE follow-up
// question to extract scale/outcome/tools; with the user's answer, drafts a
// STAR-style bullet from it.
const bulletCoach = async ({ bullet, roleContext, answer }, apiKey, req = null) => {
  const prompt = answer
    ? `
    You are a resume coach. The candidate had this weak bullet: ${JSON.stringify(bullet)}
    (role: ${roleContext || 'not specified'}).
    You asked for more detail and they answered: ${JSON.stringify(answer)}

    Draft ONE strong STAR-style resume bullet using only facts from the bullet
    and their answer. Never invent metrics.
  `
    : `
    You are a resume coach. This bullet is thin: ${JSON.stringify(bullet)}
    (role: ${roleContext || 'not specified'}).

    Ask ONE short follow-up question that would extract the most valuable
    missing detail (scale, measurable outcome, or tools used).
  `;

  return generateJson({
    apiKey,
    req,
    service: 'bullet-coach',
    call: answer ? GEMINI_CALLS.coachBullet : GEMINI_CALLS.coachQuestion,
    label: 'bullet coach',
    parts: [{ text: prompt }],
  });
};

const getRecommendations = async (masterData, jobDescription, apiKey, req = null) => {
  const prompt = `
    You are an expert Career Coach and ATS Analyst.
    Analyze the Candidate's Master Profile against the provided Job Description.

    Job Description:
    ${jobDescription}

    Candidate Profile:
    ${JSON.stringify(masterData)}

    Report: a matchScore from 0-100, the skills and keywords missing from the
    profile, specific improvements to make, and a gapAnalysis summarizing fit.
  `;

  return generateJson({
    apiKey,
    req,
    service: 'other',
    call: GEMINI_CALLS.recommendations,
    label: 'recommendations',
    parts: [{ text: prompt }],
  });
};

const generateCoverLetter = async (masterData, jobDescription, options, apiKey, req = null) => {
  const tone = options?.tone || 'Professional';
  const length = options?.length || 'Medium';

  const prompt = `
    You are an expert cover letter writer.
    Write a compelling, personalized cover letter for the candidate below, tailored to the job description.

    REQUIREMENTS:
    1. Tone: ${tone}.
    2. Length: ${length} (Short = ~200 words, Medium = ~320 words, Long = ~450 words).
    3. Use concrete achievements from the candidate profile that match the job's requirements.
    4. Do NOT invent facts, employers, or metrics that are not in the profile.
    5. Structure: greeting, a strong opening hook, 1-2 body paragraphs mapping experience to the role, and a confident closing with a call to action.
    6. Write plain prose — no markdown, no commentary, no placeholders like [Company] unless the info is genuinely missing.

    Candidate Profile: ${JSON.stringify(masterData)}

    Job Description: ${jobDescription}
  `;

  const data = await generateJson({
    apiKey,
    req,
    service: 'cover-letter',
    call: GEMINI_CALLS.coverLetter,
    label: 'cover letter',
    parts: [{ text: prompt }],
  });
  return data.body.trim();
};

const generateInterviewQuestions = async (jobDescription, masterData, apiKey, req = null) => {
  const prompt = `
    You are an experienced technical and behavioral interviewer.
    Based on the job description (and candidate background if provided), produce a set of realistic interview questions.

    RULES:
    1. Return 6 questions: a mix of behavioral, role-specific technical, and situational.
    2. Order them from warm-up to more challenging.

    Job Description: ${jobDescription}

    Candidate Background (optional): ${JSON.stringify(masterData || {})}
  `;

  const data = await generateJson({
    apiKey,
    req,
    service: 'interview-prep',
    call: GEMINI_CALLS.interviewQuestions,
    label: 'interview questions',
    parts: [{ text: prompt }],
  });
  return data.questions;
};

const evaluateInterviewAnswer = async (question, answer, jobDescription, apiKey, req = null) => {
  const prompt = `
    You are an interview coach. Evaluate the candidate's answer to an interview question.
    Give a score from 0-100 and 2-4 sentences of feedback: what was strong,
    what to improve, and a concrete tip.

    Question: ${question}
    Candidate's Answer: ${answer}
    Job Context: ${jobDescription || 'General role'}
  `;

  return generateJson({
    apiKey,
    req,
    service: 'interview-prep',
    call: GEMINI_CALLS.interviewEvaluation,
    label: 'interview evaluation',
    parts: [{ text: prompt }],
  });
};

const generateLinkedInContent = async (masterData, apiKey, req = null) => {
  const prompt = `
    You are a LinkedIn personal-branding expert.
    Using the candidate's profile, write optimized LinkedIn content: a punchy
    keyword-rich headline (max 220 chars), a first-person "About" section of
    3-5 short paragraphs, and 5-7 achievement-oriented experience highlights.
    Do NOT invent facts not present in the profile.

    Candidate Profile: ${JSON.stringify(masterData)}
  `;

  return generateJson({
    apiKey,
    req,
    service: 'linkedin-optimizer',
    call: GEMINI_CALLS.linkedin,
    label: 'linkedin content',
    parts: [{ text: prompt }],
  });
};

module.exports = {
  GEMINI_REQUEST_OPTIONS,
  callGeminiWithRetry,
  parseResumeData,
  tailorResume,
  tailorResumeWithJobMeta,
  rewriteBullet,
  suggestTitles,
  bulletCoach,
  getRecommendations,
  generateCoverLetter,
  generateInterviewQuestions,
  evaluateInterviewAnswer,
  generateLinkedInContent,
};
