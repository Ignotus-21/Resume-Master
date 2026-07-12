// Shared leaf renderers used by every template. All user strings pass
// through escapeLatex / escapeUrl here — templates never interpolate raw
// content. Everything is a pure function; no I/O, no Date, no randomness.
const { escapeLatex, escapeUrl, escapeList } = require('../escape');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

// Best-effort parse of the free-form date strings stored in profiles
// ("January 2023", "Jan 2023", "01/2023", "2023-01", "2023"). Returns
// { month: 1-12 | null, year } or null when unparseable.
const parseDate = (str) => {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim();
  let m = s.match(/^([A-Za-z]+)\.?,?\s+(\d{4})$/); // Month YYYY
  if (m) {
    const idx = MONTHS.findIndex((name) => name.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
    if (idx >= 0) return { month: idx + 1, year: m[2] };
  }
  m = s.match(/^(\d{1,2})\/(\d{4})$/); // MM/YYYY
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return { month: Number(m[1]), year: m[2] };
  m = s.match(/^(\d{4})-(\d{1,2})(-\d{1,2})?$/); // YYYY-MM(-DD)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { month: Number(m[2]), year: m[1] };
  m = s.match(/^(\d{4})$/); // YYYY
  if (m) return { month: null, year: m[1] };
  return null;
};

// Re-render a date string in the design's dateFormat; falls back to the
// original (escaped) text when it can't be parsed.
const formatDate = (str, dateFormat) => {
  const parsed = parseDate(str);
  if (!parsed) return escapeLatex(str);
  const { month, year } = parsed;
  if (dateFormat === 'YYYY' || month === null) return year;
  if (dateFormat === 'MM/YYYY') return `${String(month).padStart(2, '0')}/${year}`;
  return `${MONTHS_SHORT[month - 1]} ${year}`; // MMM YYYY
};

const dateRange = (start, end, isCurrent, design) => {
  const from = start ? formatDate(start, design.dateFormat) : '';
  const to = isCurrent ? 'Present' : end ? formatDate(end, design.dateFormat) : '';
  if (from && to) return `${from} -- ${to}`;
  return from || to;
};

// A link rendered per design.links. `label` defaults to a cleaned-up URL.
const link = (url, label, design, icon) => {
  if (!url) return '';
  const text = escapeLatex(label || String(url).replace(/^https?:\/\/(www\.)?/, ''));
  if (design.links === 'plaintext') return text;
  const target = /^https?:\/\//.test(url) ? url : `https://${url}`;
  const prefix = design.links === 'icons' && icon ? `\\${icon}\\ ` : '';
  return `${prefix}\\href{${escapeUrl(target)}}{${text}}`;
};

// The contact line under the name. Order is fixed; separator is the
// template's choice.
const contactParts = (user, design) => {
  const u = user || {};
  const parts = [];
  if (u.phone) parts.push(escapeLatex(u.phone));
  if (u.email) {
    parts.push(design.links === 'plaintext'
      ? escapeLatex(u.email)
      : `\\href{mailto:${escapeUrl(u.email)}}{${escapeLatex(u.email)}}`);
  }
  if (u.linkedin) parts.push(link(u.linkedin, null, design, 'faLinkedin'));
  if (u.github) parts.push(link(u.github, null, design, 'faGithub'));
  if (u.website) parts.push(link(u.website, null, design, 'faGlobe'));
  if (u.location) parts.push(escapeLatex(u.location));
  return parts;
};

const hasItems = (arr) => Array.isArray(arr) && arr.length > 0;

const hasSkills = (skills) =>
  !!skills && ['languages', 'frameworks', 'tools', 'other'].some((k) => hasItems(skills[k]));

// Does a section have anything to render? Drives both templates and the
// outline panel semantics (empty sections are silently skipped).
const sectionHasContent = (key, content) => {
  const c = content || {};
  if (key === 'skills') return hasSkills(c.skills);
  if (key === 'hobbies') return hasItems(c.hobbies);
  if (key === 'customSections') return hasItems(c.customSections);
  return hasItems(c[key]);
};

// Ordered, visible, non-empty section keys for a document.
const visibleSections = (content, design) =>
  design.sectionOrder.filter(
    (key) => !design.hiddenSections.includes(key) && sectionHasContent(key, content)
  );

const SKILL_LABELS = {
  languages: 'Languages',
  frameworks: 'Frameworks',
  tools: 'Tools',
  other: 'Other',
};

module.exports = {
  escapeLatex,
  escapeUrl,
  escapeList,
  formatDate,
  dateRange,
  link,
  contactParts,
  hasItems,
  hasSkills,
  sectionHasContent,
  visibleSections,
  SKILL_LABELS,
};
