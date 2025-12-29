const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Using gemini-1.5-flash-001 for specific version reliability
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const parseResumeData = async (input) => {
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

const tailorResume = async (masterData, jobDescription) => {
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
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Tailor Error:", error);
    throw new Error("Failed to tailor resume");
  }
};

const generateLatex = async (resumeData) => {
  const prompt = `
    You are a LaTeX Resume Architect.
    Convert the following JSON resume data into a professional, clean LaTeX resume code.
    
    Design Requirements:
    1. Use a modern, clean, and professional layout (e.g., modified 'article' class or a clean resume class).
    2. **MULTI-PAGE SUPPORT IS ESSENTIAL**: Do NOT try to squeeze everything onto one page. If the content is long, let it flow naturally to a second page.
    3. Use readable font sizes (10pt-12pt) and standard margins (0.5in - 0.75in).
    4. Ensure ALL sections from the JSON (Education, Experience, Projects, Skills, etc.) are included. Do not drop content.
    5. Ensure all special characters are escaped properly for LaTeX.
    6. **SKILLS HANDLING**: The 'skills' field is likely an object with categories (e.g., { languages: [...], frameworks: [...] }). You MUST iterate through each category key and list the items (e.g., "**Languages:** JavaScript, Python"). Do NOT output an empty Skills section.
    
    Resume Data: ${JSON.stringify(resumeData)}
    
    Return ONLY the LaTeX code. Start with \\documentclass.
  `;
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().replace(/```latex/g, '').replace(/```/g, '');
  } catch (error) {
    console.error("Gemini LaTeX Error:", error);
    throw new Error("Failed to generate LaTeX");
  }
};

const getRecommendations = async (masterData, jobDescription) => {
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
    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Recommendation Error:", error);
    throw new Error("Failed to get recommendations");
  }
};

module.exports = {
  parseResumeData,
  tailorResume,
  generateLatex,
  getRecommendations
};
