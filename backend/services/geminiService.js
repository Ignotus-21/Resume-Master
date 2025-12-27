const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Using gemini-1.5-flash for speed and reliability
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const parseResumeData = async (text) => {
  const prompt = `
    You are an expert Resume Parser. 
    Parse the following resume text into a structured JSON format compatible with the following schema keys:
    user (name, email, phone, linkedin, github, website, location, address),
    experience (array of objects with company, role, startDate, endDate, isCurrent, bulletPoints, keywords),
    education (array of objects with institution, degree, fieldOfStudy, startDate, endDate, gpa, coursework),
    projects (array of objects with title, techStack, description, link, bulletPoints),
    skills (languages, frameworks, tools),
    certificates, achievements, hobbies, publications, volunteering.
    
    Return ONLY the JSON. Do not include markdown formatting.
    
    Text to parse:
    ${text}
  `;

  try {
    const result = await model.generateContent(prompt);
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
    1. Select the most relevant experience, projects, and skills from the Master Resume that match the Job Description.
    2. Rewrite bullet points to include keywords from the Job Description, improving the ATS score.
    3. Keep the structure JSON compatible.
    
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
    Use a modern, clean template (like Deedy or ModernCV style but simplified).
    Ensure all special characters are escaped properly for LaTeX.
    
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
