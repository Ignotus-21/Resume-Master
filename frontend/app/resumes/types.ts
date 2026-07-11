export interface ResumeData {
  user?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  experience?: Array<{
    role: string;
    company: string;
    startDate: string;
    endDate?: string;
    bulletPoints?: string[];
    location?: string;
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    gpa?: string;
    coursework?: string[];
  }>;
  skills?: {
    languages?: string[];
    frameworks?: string[];
    tools?: string[];
    other?: string[];
  } | string[]; // Skills can be object or array
  projects?: Array<{
    title: string;
    techStack?: string[];
    description: string;
    link?: string;
    bulletPoints?: string[];
  }>;
  certificates?: Array<{
    name: string;
    issuer?: string;
    date?: string;
    link?: string;
  }>;
  achievements?: Array<{
    title: string;
    date?: string;
    description?: string;
  }>;
  patents?: Array<{
    title: string;
    number?: string;
    date?: string;
    description?: string;
  }>;
  volunteering?: Array<{
    organization: string;
    role: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  customSections?: Array<{
    title: string;
    items: Array<{
      title: string;
      subtitle?: string;
      date?: string;
      description?: string;
    }>;
  }>;
}
