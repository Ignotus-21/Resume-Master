const mongoose = require('mongoose');

const masterProfileSchema = new mongoose.Schema({
  user: {
    name: String,
    email: String,
    phone: String,
    linkedin: String,
    github: String,
    website: String,
    location: String,
    address: String,
    dob: String,
  },
  experience: [{
    company: String,
    role: String,
    startDate: String,
    endDate: String,
    isCurrent: Boolean,
    bulletPoints: [String],
    keywords: [String],
    location: String,
  }],
  education: [{
    institution: String,
    degree: String,
    fieldOfStudy: String,
    startDate: String,
    endDate: String,
    gpa: String,
    coursework: [String],
  }],
  projects: [{
    title: String,
    techStack: [String],
    description: String,
    link: String,
    bulletPoints: [String],
  }],
  skills: {
    languages: [String],
    frameworks: [String],
    tools: [String],
    other: [String]
  },
  certificates: [{
    name: String,
    issuer: String,
    date: String,
    link: String,
  }],
  achievements: [{
    title: String,
    description: String,
    date: String,
  }],
  hobbies: [String],
  publications: [{
    title: String,
    link: String,
    date: String,
    description: String
  }],
  volunteering: [{
    organization: String,
    role: String,
    startDate: String,
    endDate: String,
    description: String
  }],
  patents: [{
    title: String,
    number: String,
    date: String,
    link: String,
    description: String
  }],
  customSections: [{
    title: String,
    items: [{
      title: String,
      subtitle: String,
      date: String,
      link: String,
      description: String,
      bullets: [String]
    }]
  }],
  rawText: String, // For initial raw dump
}, {
  timestamps: true,
});

const MasterProfile = mongoose.model('MasterProfile', masterProfileSchema);

module.exports = MasterProfile;
