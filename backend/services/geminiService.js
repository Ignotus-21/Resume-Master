const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Using gemini-1.5-flash-001 for specific version reliability
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

const parseResumeData = async (input) => {
  const isBuffer = Buffer.isBuffer(input);
  
  const systemInstruction = `
    You are an expert Resume Parser. 
    Parse the provided resume (text or PDF) into a structured JSON format compatible with the following schema keys:
    user (name, email, phone, linkedin, github, website, location, address),
    experience (array of objects with company, role, startDate, endDate, isCurrent, bulletPoints, keywords),
    education (array of objects with institution, degree, fieldOfStudy, startDate, endDate, gpa, coursework),
    projects (array of objects with title, techStack, description, link, bulletPoints),
    skills (languages, frameworks, tools),
    certificates, achievements, hobbies, publications, volunteering, patents.
    
    If the resume contains other sections like "Awards", "Leadership", "Speaking", or "Research" that don't fit above, put them in a 'customSections' array.
    Each custom section should have: { title: string, items: [{ title, subtitle, date, link, description, bullets }] }.
    
    Return ONLY the JSON. Do not include markdown formatting.
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
    Your task is to:
    1. Select ALL relevant experience, projects, and skills. Do NOT omit core sections (Education, Skills, Experience, Projects) unless they are completely irrelevant. Ensure the resume is comprehensive.
    2. Rewrite bullet points to include keywords from the Job Description, improving the ATS score.
    3. Maintain a professional tone and ensure no critical details (like dates, companies, degrees) are lost.
    4. Keep the structure JSON compatible.
    
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
