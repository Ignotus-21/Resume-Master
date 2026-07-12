// DesignTokens -> LaTeX preamble fragments. Pure functions of a validated
// DesignTokens object (callers must run validateDesign first). No user
// content flows through here — only whitelisted token values.

// Free TeX Live equivalents of the ATS-safe font menu. Every package here is
// fetchable by Tectonic (and pre-baked into the Docker image cache).
const FONT_PACKAGES = {
  Garamond: '\\usepackage{ebgaramond}',
  TimesNewRoman: '\\usepackage{newtxtext}',
  Arial: '\\usepackage{helvet}\n\\renewcommand{\\familydefault}{\\sfdefault}',
  Georgia: '\\usepackage{newpxtext}',
  Verdana: '\\usepackage{DejaVuSans}\n\\renewcommand{\\familydefault}{\\sfdefault}',
  Charter: '\\usepackage{XCharter}',
  FiraSans: '\\usepackage[sfdefault]{FiraSans}',
  SourceSansPro: '\\usepackage[default]{sourcesanspro}',
};

const fontPreamble = (design) => FONT_PACKAGES[design.font];

// article's class options only do 10/11/12pt; the `fontsize` package covers
// the half step.
const documentClass = (design) => {
  if (design.fontSize === 10.5) {
    return '\\documentclass[letterpaper,10pt]{article}\n\\usepackage[fontsize=10.5pt]{fontsize}';
  }
  return `\\documentclass[letterpaper,${design.fontSize}pt]{article}`;
};

const geometryPreamble = (design) =>
  `\\usepackage[margin=${design.margin}in]{geometry}`;

const spacingPreamble = (design) =>
  `\\usepackage{setspace}\n\\setstretch{${design.lineSpacing}}`;

// titlesec \titlespacing*{\section}{left}{before}{after} values per density.
const SECTION_SPACING = {
  tight: { before: '4pt', after: '2pt', itemsep: '1pt' },
  normal: { before: '8pt', after: '4pt', itemsep: '2pt' },
  airy: { before: '14pt', after: '7pt', itemsep: '4pt' },
};

const sectionSpacing = (design) => SECTION_SPACING[design.sectionSpacing];

// Accent color: templates color section headings/rules with \color{accent}.
// null accent defines black so templates can reference the color
// unconditionally.
const colorPreamble = (design) => {
  const hex = (design.accentColor || '#000000').slice(1).toUpperCase();
  return `\\usepackage{xcolor}\n\\definecolor{accent}{HTML}{${hex}}`;
};

// \titlerule after the section heading, or nothing.
const sectionRule = (design) =>
  design.sectionRule === 'line' ? '[\\color{accent}\\titlerule]' : '';

// Placed before every \section: if less than ~a heading plus one content
// line remains on the page, break early instead of orphaning the heading at
// the page bottom. Needs \usepackage{needspace} (see pageBreakPreamble).
const SECTION_GUARD = '\\needspace{4\\baselineskip}';

// Page-break quality: needspace for the section guard above, \raggedbottom
// so the early breaks it forces never stretch inter-section glue (also the
// article/oneside default — stated here so it's deliberate), and max
// club/widow penalties so a bullet's first or last line is never split from
// the rest of the bullet across a page break.
const pageBreakPreamble = () => [
  '\\usepackage{needspace}',
  '\\raggedbottom',
  '\\clubpenalty=10000',
  '\\widowpenalty=10000',
].join('\n');

const bulletLabel = (design) => {
  // ▪ as a plain \rule square avoids pulling in amssymb just for a bullet.
  const map = { '•': '\\textbullet', '–': '--', '▪': '\\rule{3pt}{3pt}' };
  return map[design.bulletChar] || '\\textbullet';
};

module.exports = {
  FONT_PACKAGES,
  fontPreamble,
  documentClass,
  geometryPreamble,
  spacingPreamble,
  sectionSpacing,
  colorPreamble,
  sectionRule,
  bulletLabel,
  SECTION_GUARD,
  pageBreakPreamble,
};
