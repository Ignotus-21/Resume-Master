const { trackUsage } = require('../utils/trackUsage');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL_NAME = "gemini-3.5-flash";

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

const parseResumeData = async (input, apiKey, req = null) => {
  const model = getModel(apiKey);
  const isBuffer = Buffer.isBuffer(input);
  
  const systemInstruction = `
    You are a strict Resume Parsing Agent. Your ONLY task is to extract data from the resume into the EXACT JSON format below.
    
    RULES:
    1. Output MUST be valid JSON. No markdown, no code blocks, no intro/outro text.
    2. If a field is missing, use "" (empty string) or [] (empty array). DO NOT use null or undefined.
    3. Standardize dates to "Month YYYY" format if possible.
    4. "skills" must be an object with keys: languages, frameworks, tools, other. Categorize intelligently.
    5. UNKNOWN SECTIONS: If you find sections not listed below (e.g. "Awards", "Speaking", "Leadership"), put them in 'customSections'.
    
    REQUIRED JSON STRUCTURE:
    {
      "user": {
        "name": "", "email": "", "phone": "", "linkedin": "", "github": "", "website": "", "location": "", "address": ""
      },
      "experience": [{
        "company": "", "role": "", "startDate": "", "endDate": "", "isCurrent": false, "location": "",
        "bulletPoints": [], "keywords": []
      }],
      "education": [{
        "institution": "", "degree": "", "fieldOfStudy": "", "startDate": "", "endDate": "", "gpa": "",
        "coursework": [] 
      }],
      "projects": [{
        "title": "", "techStack": [], "description": "", "link": "", "bulletPoints": []
      }],
      "skills": {
        "languages": [], "frameworks": [], "tools": [], "other": []
      },
      "certificates": [{ "name": "", "issuer": "", "date": "", "link": "" }],
      "achievements": [{ "title": "", "description": "", "date": "" }],
      "hobbies": [],
      "publications": [{ "title": "", "link": "", "date": "", "description": "" }],
      "volunteering": [{ "organization": "", "role": "", "startDate": "", "endDate": "", "description": "" }],
      "patents": [{ "title": "", "number": "", "date": "", "link": "", "description": "" }],
      "customSections": [{
        "title": "Section Name",
        "items": [{
          "title": "", "subtitle": "", "date": "", "link": "", "description": "", "bullets": []
        }]
      }]
    }
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

  try {
    const result = await model.generateContent(parts);
    if (req) await trackUsage(req, 'resume-parser', result);
    const response = await result.response;
    const text = response.text();
    // Clean up if markdown code blocks are present
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Parse Error:", error);
    throw new Error("Failed to parse resume data");
  }
};

const tailorResume = async (masterData, jobDescription, apiKey, req = null) => {
  const model = getModel(apiKey);
  const prompt = `
    You are an ATS Resume Optimizer.
    I have a Master Resume Data (JSON) and a Job Description.
    
    CRITICAL INSTRUCTIONS:
    1. **INCLUDE ALL SECTIONS**: You MUST include 'skills', 'certificates', 'achievements', 'projects', 'education', 'experience' if present in the master data.
    2. **DO NOT DROP SKILLS**: Include ALL technical skills from the master profile. Do not filter them out.
    3. **DO NOT DROP CERTIFICATES**: Include all certificates.
    4. **Tailor Descriptions**: Rewrite bullet points in 'experience' and 'projects' to highlight keywords from the Job Description.
    5. **Structure**: Return valid JSON matching the Master Resume schema exactly.
    
    Master Resume: ${JSON.stringify(masterData)}
    
    Job Description: ${jobDescription}
    
    Return ONLY the tailored JSON.
  `;
  
  try {
    const result = await model.generateContent(prompt);
    if (req) await trackUsage(req, 'resume-tailor', result);
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Tailor Error:", error);
    throw new Error("Failed to tailor resume");
  }
};

const generateLatex = async (resumeData, apiKey, req = null) => {
  const model = getModel(apiKey);
  const prompt = `
    You are a LaTeX Resume Architect.
    Convert the following JSON resume data into a professional, clean LaTeX resume code.
    
    Design Requirements:
    1. Use a modern, clean, and professional layout (e.g., modified 'article' class).
    2. **MULTI-PAGE SUPPORT**: Do NOT try to squeeze everything onto one page.
    3. Use readable font sizes (10pt-12pt) and standard margins (0.5in - 0.75in).
    4. Ensure ALL sections from the JSON are included. Do not drop content.
    5. Ensure all special characters are escaped properly.
    6. **CRITICAL: DO NOT use the 'fullpage' package. Use '\\usepackage[margin=0.5in]{geometry}' instead, as 'fullpage' is not installed on this system.**
    
    Resume Data: ${JSON.stringify(resumeData)}
    
    Return ONLY the LaTeX code. Start with \\documentclass.
  `;
  
  try {
    const result = await model.generateContent(prompt);
    if (req) await trackUsage(req, 'latex-generator', result);
    const response = await result.response;
    return response.text().replace(/```latex/g, '').replace(/```/g, '');
  } catch (error) {
    console.error("Gemini LaTeX Error:", error);
    throw new Error("Failed to generate LaTeX");
  }
};

const getRecommendations = async (masterData, jobDescription, apiKey, req = null) => {
  const model = getModel(apiKey);
  const prompt = `
    You are an expert Career Coach and ATS Analyst.
    Analyze the Candidate's Master Profile against the provided Job Description.
    
    Job Description:
    ${jobDescription}
    
    Candidate Profile:
    ${JSON.stringify(masterData)}
    
    Provide a detailed JSON response with the following structure:
    {
      "matchScore": number (0-100),
      "missingSkills": [string],
      "missingKeywords": [string],
      "improvements": [string] (specific advice on what to add or change),
      "gapAnalysis": string (summary of fit)
    }
    Return ONLY valid JSON. Do not include markdown formatting.
  `;
  
  try {
    const result = await model.generateContent(prompt);
    if (req) await trackUsage(req, 'other', result);
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Recommendation Error:", error);
    throw new Error("Failed to get recommendations");
  }
};

const generateCoverLetter = async (masterData, jobDescription, options, apiKey, req = null) => {
  const model = getModel(apiKey);
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
    6. Return ONLY the cover letter text. No markdown, no commentary, no placeholders like [Company] unless the info is genuinely missing.

    Candidate Profile: ${JSON.stringify(masterData)}

    Job Description: ${jobDescription}
  `;

  try {
    const result = await model.generateContent(prompt);
    if (req) await trackUsage(req, 'cover-letter', result);
    const response = await result.response;
    return response.text().replace(/```/g, '').trim();
  } catch (error) {
    console.error("Gemini Cover Letter Error:", error);
    throw new Error("Failed to generate cover letter");
  }
};

const generateInterviewQuestions = async (jobDescription, masterData, apiKey, req = null) => {
  const model = getModel(apiKey);
  const prompt = `
    You are an experienced technical and behavioral interviewer.
    Based on the job description (and candidate background if provided), produce a set of realistic interview questions.

    RULES:
    1. Return 6 questions: a mix of behavioral, role-specific technical, and situational.
    2. Order them from warm-up to more challenging.
    3. Return ONLY valid JSON: { "questions": ["...", "..."] }. No markdown.

    Job Description: ${jobDescription}

    Candidate Background (optional): ${JSON.stringify(masterData || {})}
  `;

  try {
    const result = await model.generateContent(prompt);
    if (req) await trackUsage(req, 'interview-prep', result);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '');
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.questions) ? parsed.questions : [];
  } catch (error) {
    console.error("Gemini Interview Questions Error:", error);
    throw new Error("Failed to generate interview questions");
  }
};

const evaluateInterviewAnswer = async (question, answer, jobDescription, apiKey, req = null) => {
  const model = getModel(apiKey);
  const prompt = `
    You are an interview coach. Evaluate the candidate's answer to an interview question.

    Question: ${question}
    Candidate's Answer: ${answer}
    Job Context: ${jobDescription || 'General role'}

    Return ONLY valid JSON with this structure:
    {
      "score": number (0-100),
      "feedback": string (2-4 sentences: what was strong, what to improve, and a concrete tip)
    }
    No markdown.
  `;

  try {
    const result = await model.generateContent(prompt);
    if (req) await trackUsage(req, 'interview-prep', result);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Interview Eval Error:", error);
    throw new Error("Failed to evaluate answer");
  }
};

const generateLinkedInContent = async (masterData, apiKey, req = null) => {
  const model = getModel(apiKey);
  const prompt = `
    You are a LinkedIn personal-branding expert.
    Using the candidate's profile, write optimized LinkedIn content.

    Return ONLY valid JSON with this structure:
    {
      "headline": string (max 220 chars, keyword-rich, punchy),
      "about": string (first-person "About" section, 3-5 short paragraphs),
      "experienceHighlights": [string] (5-7 achievement-oriented bullet points suitable for LinkedIn experience entries)
    }
    Do NOT invent facts not present in the profile. No markdown.

    Candidate Profile: ${JSON.stringify(masterData)}
  `;

  try {
    const result = await model.generateContent(prompt);
    if (req) await trackUsage(req, 'linkedin-optimizer', result);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini LinkedIn Error:", error);
    throw new Error("Failed to generate LinkedIn content");
  }
};

module.exports = {
  parseResumeData,
  tailorResume,
  generateLatex,
  getRecommendations,
  generateCoverLetter,
  generateInterviewQuestions,
  evaluateInterviewAnswer,
  generateLinkedInContent,
};
