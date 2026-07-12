// Typed MIRROR of backend/shared/resume.js — the canonical definition of the
// resume IR lives there and the server clamps every value on write, so a
// stale copy here degrades UX only, never correctness. Keep the two in sync.
// (They can't literally share a file: Railway deploys backend/ and Vercel
// deploys frontend/ as isolated roots — see DEPLOY.md.)

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
  font: 'Garamond' | 'TimesNewRoman' | 'Arial' | 'Georgia' | 'Verdana' | 'Charter' | 'FiraSans' | 'SourceSansPro';
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

export const SECTION_KEYS: SectionKey[] = [
  'experience', 'education', 'projects', 'skills', 'certificates',
  'achievements', 'publications', 'volunteering', 'patents', 'hobbies', 'customSections',
];

export const DEFAULT_SECTION_TITLES: Record<SectionKey, string> = {
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Technical Skills',
  certificates: 'Certifications',
  achievements: 'Achievements',
  publications: 'Publications',
  volunteering: 'Volunteering',
  patents: 'Patents',
  hobbies: 'Interests',
  customSections: '',
};

export const TEMPLATE_IDS: TemplateId[] = ['sheets', 'jake', 'compact', 'modern'];

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  sheets: 'Sheets — single column, ATS-safest',
  jake: "Jake's — the classic CS resume",
  compact: 'Compact — dense, fits more',
  modern: 'Modern — accent color, bolder headings',
};

export const FONTS: DesignTokens['font'][] = [
  'Garamond', 'TimesNewRoman', 'Arial', 'Georgia', 'Verdana', 'Charter', 'FiraSans', 'SourceSansPro',
];

export const FONT_SIZES: DesignTokens['fontSize'][] = [10, 10.5, 11, 12];
export const SECTION_SPACINGS: DesignTokens['sectionSpacing'][] = ['tight', 'normal', 'airy'];
export const HEADER_STYLES: DesignTokens['headerStyle'][] = ['centered', 'left', 'two-column'];
export const BULLET_CHARS: DesignTokens['bulletChar'][] = ['•', '–', '▪'];
export const DATE_FORMATS: DesignTokens['dateFormat'][] = ['MMM YYYY', 'MM/YYYY', 'YYYY'];
export const LINK_STYLES: DesignTokens['links'][] = ['hyperlink', 'plaintext', 'icons'];

export const DEFAULT_DESIGN: DesignTokens = {
  font: 'Garamond',
  fontSize: 11,
  margin: 0.7,
  lineSpacing: 1.0,
  sectionSpacing: 'normal',
  sectionOrder: SECTION_KEYS,
  hiddenSections: [],
  sectionTitles: {},
  accentColor: null,
  headerStyle: 'centered',
  sectionRule: 'line',
  bulletChar: '•',
  dateFormat: 'MMM YYYY',
  links: 'hyperlink',
  columns: 1,
  showPhoto: false,
};

export const sectionTitle = (key: SectionKey, design: DesignTokens): string =>
  design.sectionTitles?.[key] || DEFAULT_SECTION_TITLES[key] || key;

// ---------------------------------------------------------------------------
// Content shapes (mirror MasterProfile minus owner/timestamps)

export interface ExperienceItem {
  company?: string; role?: string; startDate?: string; endDate?: string;
  isCurrent?: boolean; location?: string; bulletPoints?: string[]; keywords?: string[];
}
export interface EducationItem {
  institution?: string; degree?: string; fieldOfStudy?: string;
  startDate?: string; endDate?: string; gpa?: string; coursework?: string[];
}
export interface ProjectItem {
  title?: string; techStack?: string[]; description?: string; link?: string; bulletPoints?: string[];
}
export interface CertificateItem { name?: string; issuer?: string; date?: string; link?: string }
export interface AchievementItem { title?: string; description?: string; date?: string }
export interface PublicationItem { title?: string; link?: string; date?: string; description?: string }
export interface VolunteeringItem {
  organization?: string; role?: string; startDate?: string; endDate?: string; description?: string;
}
export interface PatentItem { title?: string; number?: string; date?: string; link?: string; description?: string }
export interface CustomSectionItem {
  title?: string; subtitle?: string; date?: string; link?: string; description?: string; bullets?: string[];
}
export interface CustomSection { title?: string; items?: CustomSectionItem[] }
export interface Skills { languages?: string[]; frameworks?: string[]; tools?: string[]; other?: string[] }

export interface ResumeContent {
  user?: {
    name?: string; email?: string; phone?: string; linkedin?: string;
    github?: string; website?: string; location?: string; address?: string;
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
  _id: string;
  owner?: string;
  job?: { _id: string; role?: string; company?: string } | null;
  versionName?: string;
  content?: ResumeContent;
  design?: DesignTokens;
  templateId?: TemplateId;
  mode?: RenderMode;
  latexSource?: string; // only meaningful when mode === 'latex'
  parentResumeId?: string;
  /** derived by the server on single-resume reads; never stored for structured docs */
  latex?: string;
  /** @deprecated pre-v2 rows */
  latexCode?: string;
  /** @deprecated pre-v2 rows */
  tailoredData?: ResumeContent;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompileError {
  line: number | null;
  severity: 'error' | 'warning';
  message: string;
  context?: string;
}

// Does a section have anything to render? Mirrors the backend's
// sectionHasContent — drives the outline and the visual editor's badges.
export const sectionHasContent = (key: SectionKey, content?: ResumeContent): boolean => {
  if (!content) return false;
  if (key === 'skills') {
    const s = content.skills;
    return !!s && (['languages', 'frameworks', 'tools', 'other'] as const).some((k) => (s[k]?.length ?? 0) > 0);
  }
  const v = content[key as keyof ResumeContent];
  return Array.isArray(v) && v.length > 0;
};

// ---------------------------------------------------------------------------
// ATS-safety linter: inform, don't nanny. Pure function of the design.
export const atsLint = (design: DesignTokens): string[] => {
  const warnings: string[] = [];
  if (design.columns === 2) {
    warnings.push('Two-column layouts can scramble the reading order in older ATS parsers — single column is the safe bet.');
  }
  if (design.showPhoto) {
    warnings.push('Photos are ignored by ATS systems and can introduce bias screening — most US/UK recruiters advise against them.');
  }
  if (design.accentColor && design.accentColor !== '#000000') {
    warnings.push('Accent color is fine for humans but adds nothing for ATS — pure black & white is the most conservative choice.');
  }
  if (design.links === 'icons') {
    warnings.push('Icon glyphs next to links may extract as garbage characters in some ATS text parsers.');
  }
  return warnings;
};
