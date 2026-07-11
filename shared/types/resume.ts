// TypeScript view of the resume IR. The runtime values (DEFAULT_DESIGN,
// validateDesign, SECTION_KEYS, ...) live in shared/resume.js so the plain-JS
// backend can require them; this file declares the shapes.

export type SectionKey =
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'certificates'
  | 'achievements'
  | 'publications'
  | 'volunteering'
  | 'patents'
  | 'hobbies'
  | 'customSections';

export type TemplateId = 'sheets' | 'jake' | 'compact' | 'modern';
export type RenderMode = 'structured' | 'latex';

export interface DesignTokens {
  font:
    | 'Garamond'
    | 'TimesNewRoman'
    | 'Arial'
    | 'Georgia'
    | 'Verdana'
    | 'Charter'
    | 'FiraSans'
    | 'SourceSansPro';
  fontSize: 10 | 10.5 | 11 | 12;
  margin: number; // 0.4 – 1.0 in
  lineSpacing: number; // 0.9 – 1.3
  sectionSpacing: 'tight' | 'normal' | 'airy';
  sectionOrder: SectionKey[];
  hiddenSections: SectionKey[];
  sectionTitles: Partial<Record<SectionKey, string>>;
  accentColor: string | null; // #rrggbb or null = pure B/W
  headerStyle: 'centered' | 'left' | 'two-column';
  sectionRule: 'line' | 'none';
  bulletChar: '•' | '–' | '▪';
  dateFormat: 'MMM YYYY' | 'MM/YYYY' | 'YYYY';
  links: 'hyperlink' | 'plaintext' | 'icons';
  columns: 1 | 2;
  showPhoto: boolean;
}

export interface ExperienceItem {
  company?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  location?: string;
  bulletPoints?: string[];
  keywords?: string[];
}

export interface EducationItem {
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  coursework?: string[];
}

export interface ProjectItem {
  title?: string;
  techStack?: string[];
  description?: string;
  link?: string;
  bulletPoints?: string[];
}

export interface CertificateItem {
  name?: string;
  issuer?: string;
  date?: string;
  link?: string;
}

export interface AchievementItem {
  title?: string;
  description?: string;
  date?: string;
}

export interface PublicationItem {
  title?: string;
  link?: string;
  date?: string;
  description?: string;
}

export interface VolunteeringItem {
  organization?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface PatentItem {
  title?: string;
  number?: string;
  date?: string;
  link?: string;
  description?: string;
}

export interface CustomSectionItem {
  title?: string;
  subtitle?: string;
  date?: string;
  link?: string;
  description?: string;
  bullets?: string[];
}

export interface CustomSection {
  title?: string;
  items?: CustomSectionItem[];
}

export interface Skills {
  languages?: string[];
  frameworks?: string[];
  tools?: string[];
  other?: string[];
}

// Mirrors MasterProfile minus owner/timestamps. This is the IR every
// renderer (LaTeX/PDF, DOCX) consumes.
export interface ResumeContent {
  user?: {
    name?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    github?: string;
    website?: string;
    location?: string;
    address?: string;
  };
  experience?: ExperienceItem[];
  education?: EducationItem[];
  projects?: ProjectItem[];
  skills?: Skills;
  certificates?: CertificateItem[];
  achievements?: AchievementItem[];
  publications?: PublicationItem[];
  volunteering?: VolunteeringItem[];
  patents?: PatentItem[];
  hobbies?: string[];
  customSections?: CustomSection[];
}

export interface ResumeDocument {
  _id?: string;
  owner?: string;
  job?: unknown;
  versionName?: string;
  content?: ResumeContent;
  design?: DesignTokens;
  templateId?: TemplateId;
  mode?: RenderMode;
  latexSource?: string; // only meaningful when mode === 'latex'
  parentResumeId?: string;
  /** @deprecated pre-v2 rows only */
  latexCode?: string;
  /** @deprecated pre-v2 rows only */
  tailoredData?: ResumeContent;
  createdAt?: string;
  updatedAt?: string;
}
