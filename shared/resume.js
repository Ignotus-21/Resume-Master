// Single source of truth for the resume IR shared by frontend and backend.
// Backend: require('../shared/resume'). Frontend: import from '@shared/resume'
// (path alias in tsconfig.json; types in shared/resume.d.ts).
//
// A resume is { content, design, templateId, mode }. LaTeX is a pure
// deterministic function of the first three — see backend/services/latex/.

// Order here is the default section order on the rendered document.
const SECTION_KEYS = [
  'experience',
  'education',
  'projects',
  'skills',
  'certificates',
  'achievements',
  'publications',
  'volunteering',
  'patents',
  'hobbies',
  'customSections',
];

const DEFAULT_SECTION_TITLES = {
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
  customSections: '', // custom sections carry their own titles
};

const TEMPLATE_IDS = ['sheets', 'jake', 'compact', 'modern'];

// ATS-safe font choices. Each maps to a free TeX Live equivalent in
// backend/services/latex/tokens.js.
const FONTS = [
  'Garamond',
  'TimesNewRoman',
  'Arial',
  'Georgia',
  'Verdana',
  'Charter',
  'FiraSans',
  'SourceSansPro',
];

const FONT_SIZES = [10, 10.5, 11, 12];
const SECTION_SPACINGS = ['tight', 'normal', 'airy'];
const HEADER_STYLES = ['centered', 'left', 'two-column'];
const SECTION_RULES = ['line', 'none'];
const BULLET_CHARS = ['•', '–', '▪']; // • – ▪
const DATE_FORMATS = ['MMM YYYY', 'MM/YYYY', 'YYYY'];
const LINK_STYLES = ['hyperlink', 'plaintext', 'icons'];

const DEFAULT_DESIGN = Object.freeze({
  font: 'Garamond',
  fontSize: 11,
  margin: 0.7, // inches
  lineSpacing: 1.0,
  sectionSpacing: 'normal',
  sectionOrder: SECTION_KEYS,
  hiddenSections: [],
  sectionTitles: {}, // overrides of DEFAULT_SECTION_TITLES
  accentColor: null, // hex string or null = pure B/W (ATS-safest)
  headerStyle: 'centered',
  sectionRule: 'line',
  bulletChar: '•',
  dateFormat: 'MMM YYYY',
  links: 'hyperlink',
  columns: 1,
  showPhoto: false,
});

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const pickEnum = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

// Clamps/whitelists every field so whatever a client sends, the render layer
// only ever sees a complete, in-range DesignTokens object.
const validateDesign = (design) => {
  const d = design && typeof design === 'object' ? design : {};
  const num = (v, fb) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);

  const order = Array.isArray(d.sectionOrder)
    ? d.sectionOrder.filter((k) => SECTION_KEYS.includes(k))
    : [];
  // Any section missing from a (possibly stale) client order still renders.
  for (const k of SECTION_KEYS) if (!order.includes(k)) order.push(k);

  const titles = {};
  if (d.sectionTitles && typeof d.sectionTitles === 'object') {
    for (const k of SECTION_KEYS) {
      if (typeof d.sectionTitles[k] === 'string' && d.sectionTitles[k].trim()) {
        titles[k] = d.sectionTitles[k].trim().slice(0, 60);
      }
    }
  }

  return {
    font: pickEnum(d.font, FONTS, DEFAULT_DESIGN.font),
    fontSize: FONT_SIZES.includes(d.fontSize) ? d.fontSize : DEFAULT_DESIGN.fontSize,
    margin: clamp(num(d.margin, DEFAULT_DESIGN.margin), 0.4, 1.0),
    lineSpacing: clamp(num(d.lineSpacing, DEFAULT_DESIGN.lineSpacing), 0.9, 1.3),
    sectionSpacing: pickEnum(d.sectionSpacing, SECTION_SPACINGS, DEFAULT_DESIGN.sectionSpacing),
    sectionOrder: order,
    hiddenSections: Array.isArray(d.hiddenSections)
      ? d.hiddenSections.filter((k) => SECTION_KEYS.includes(k))
      : [],
    sectionTitles: titles,
    accentColor:
      typeof d.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(d.accentColor)
        ? d.accentColor
        : null,
    headerStyle: pickEnum(d.headerStyle, HEADER_STYLES, DEFAULT_DESIGN.headerStyle),
    sectionRule: pickEnum(d.sectionRule, SECTION_RULES, DEFAULT_DESIGN.sectionRule),
    bulletChar: pickEnum(d.bulletChar, BULLET_CHARS, DEFAULT_DESIGN.bulletChar),
    dateFormat: pickEnum(d.dateFormat, DATE_FORMATS, DEFAULT_DESIGN.dateFormat),
    links: pickEnum(d.links, LINK_STYLES, DEFAULT_DESIGN.links),
    columns: d.columns === 2 ? 2 : 1,
    showPhoto: d.showPhoto === true,
  };
};

const sectionTitle = (key, design) =>
  (design.sectionTitles && design.sectionTitles[key]) || DEFAULT_SECTION_TITLES[key] || key;

module.exports = {
  SECTION_KEYS,
  DEFAULT_SECTION_TITLES,
  TEMPLATE_IDS,
  FONTS,
  FONT_SIZES,
  SECTION_SPACINGS,
  HEADER_STYLES,
  SECTION_RULES,
  BULLET_CHARS,
  DATE_FORMATS,
  LINK_STYLES,
  DEFAULT_DESIGN,
  validateDesign,
  sectionTitle,
};
