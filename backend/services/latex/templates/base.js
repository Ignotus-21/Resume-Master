// Parametric single-column renderer behind the sheets / compact / modern
// templates — they differ in heading style and density, which is exactly
// what `opts` captures. jake.js has its own layout and does not use this.
// Pure function: (content, design, opts) -> LaTeX string.
const tokens = require('../tokens');
const {
  escapeLatex, escapeList, dateRange, link, contactParts,
  hasItems, hasSkills, visibleSections, SKILL_LABELS,
} = require('./helpers');
const { sectionTitle } = require('../../../shared/resume');

const line = (l, r) => (r ? `${l} \\hfill ${r}\\\\` : `${l}\\\\`);

const bullets = (items) => {
  const rows = (items || []).filter((b) => b && String(b).trim());
  if (!rows.length) return '';
  return [
    '\\begin{itemize}',
    ...rows.map((b) => `  \\item ${escapeLatex(b)}`),
    '\\end{itemize}',
  ].join('\n');
};

const entryGap = '\\vspace{4pt}';

const sectionBodies = (content, design) => ({
  experience: () =>
    (content.experience || []).map((e) => [
      line(`\\textbf{${escapeLatex(e.role)}}`, dateRange(e.startDate, e.endDate, e.isCurrent, design)),
      line(`\\textit{${escapeLatex(e.company)}}`, escapeLatex(e.location)),
      bullets(e.bulletPoints),
    ].filter(Boolean).join('\n')).join(`\n${entryGap}\n\n`),

  education: () =>
    (content.education || []).map((ed) => {
      const degree = [ed.degree, ed.fieldOfStudy].filter(Boolean).join(' in ');
      const detail = [
        degree ? escapeLatex(degree) : '',
        ed.gpa ? `GPA: ${escapeLatex(ed.gpa)}` : '',
      ].filter(Boolean).join(' --- ');
      return [
        line(`\\textbf{${escapeLatex(ed.institution)}}`, dateRange(ed.startDate, ed.endDate, false, design)),
        detail ? `${detail}\\\\` : '',
        hasItems(ed.coursework) ? `\\textit{Coursework:} ${escapeList(ed.coursework)}\\\\` : '',
      ].filter(Boolean).join('\n');
    }).join(`\n${entryGap}\n\n`),

  projects: () =>
    (content.projects || []).map((p) => {
      const title = p.link
        ? `\\textbf{${escapeLatex(p.title)}} (${link(p.link, 'link', design, 'faLink')})`
        : `\\textbf{${escapeLatex(p.title)}}`;
      return [
        line(title, hasItems(p.techStack) ? `\\textit{${escapeList(p.techStack)}}` : ''),
        p.description ? `${escapeLatex(p.description)}\\\\` : '',
        bullets(p.bulletPoints),
      ].filter(Boolean).join('\n');
    }).join(`\n${entryGap}\n\n`),

  skills: () => {
    if (!hasSkills(content.skills)) return '';
    return Object.entries(SKILL_LABELS)
      .filter(([k]) => hasItems(content.skills[k]))
      .map(([k, label]) => `\\textbf{${label}:} ${escapeList(content.skills[k])}\\\\`)
      .join('\n');
  },

  certificates: () =>
    (content.certificates || []).map((c) => {
      const name = c.link ? link(c.link, c.name, design, 'faCertificate') : `\\textbf{${escapeLatex(c.name)}}`;
      const left = c.issuer ? `${name} --- ${escapeLatex(c.issuer)}` : name;
      return line(left, c.date ? dateRange(c.date, null, false, design) : '');
    }).join('\n'),

  achievements: () =>
    (content.achievements || []).map((a) => [
      line(`\\textbf{${escapeLatex(a.title)}}`, a.date ? dateRange(a.date, null, false, design) : ''),
      a.description ? `${escapeLatex(a.description)}\\\\` : '',
    ].filter(Boolean).join('\n')).join(`\n${entryGap}\n\n`),

  publications: () =>
    (content.publications || []).map((p) => [
      line(p.link ? link(p.link, p.title, design, 'faBook') : `\\textbf{${escapeLatex(p.title)}}`,
        p.date ? dateRange(p.date, null, false, design) : ''),
      p.description ? `${escapeLatex(p.description)}\\\\` : '',
    ].filter(Boolean).join('\n')).join(`\n${entryGap}\n\n`),

  volunteering: () =>
    (content.volunteering || []).map((v) => [
      line(`\\textbf{${escapeLatex(v.role)}}, ${escapeLatex(v.organization)}`,
        dateRange(v.startDate, v.endDate, false, design)),
      v.description ? `${escapeLatex(v.description)}\\\\` : '',
    ].filter(Boolean).join('\n')).join(`\n${entryGap}\n\n`),

  patents: () =>
    (content.patents || []).map((p) => [
      line(`\\textbf{${escapeLatex(p.title)}}${p.number ? ` (${escapeLatex(p.number)})` : ''}`,
        p.date ? dateRange(p.date, null, false, design) : ''),
      p.description ? `${escapeLatex(p.description)}\\\\` : '',
    ].filter(Boolean).join('\n')).join(`\n${entryGap}\n\n`),

  hobbies: () => (hasItems(content.hobbies) ? `${escapeList(content.hobbies)}\\\\` : ''),
});

const customSectionBlock = (section, design, opts) => {
  const items = (section.items || []).map((item) => [
    line(
      [
        item.title ? `\\textbf{${escapeLatex(item.title)}}` : '',
        item.subtitle ? `--- ${escapeLatex(item.subtitle)}` : '',
        item.link ? `(${link(item.link, 'link', design, 'faLink')})` : '',
      ].filter(Boolean).join(' '),
      item.date ? dateRange(item.date, null, false, design) : ''
    ),
    item.description ? `${escapeLatex(item.description)}\\\\` : '',
    bullets(item.bullets),
  ].filter(Boolean).join('\n')).join(`\n${entryGap}\n\n`);
  return `\\section{${opts.headingText(escapeLatex(section.title || 'Additional'))}}\n${items}`;
};

const header = (content, design, opts) => {
  const u = content.user || {};
  const name = `{${opts.nameSize}\\bfseries ${escapeLatex(u.name || '')}}`;
  const contact = `{\\small ${contactParts(u, design).join(' $|$ ')}}`;
  if (design.headerStyle === 'left') {
    return `${name}\\\\[2pt]\n${contact}\\\\[2pt]`;
  }
  if (design.headerStyle === 'two-column') {
    return [
      '\\begin{tabularx}{\\textwidth}{@{}X r@{}}',
      `${name} & ${contact}\\\\`,
      '\\end{tabularx}',
    ].join('\n');
  }
  return `\\begin{center}\n${name}\\\\[4pt]\n${contact}\n\\end{center}`;
};

// opts: nameSize, headingFormat ('\large\bfseries...'), headingText(title)->tex,
// useAccent (color headings), listOpts override.
const renderBase = (content, design, opts) => {
  const spacing = tokens.sectionSpacing(design);
  const accent = opts.useAccent && design.accentColor ? '\\color{accent}' : '';
  const rule = tokens.sectionRule(design);
  const needsTabularx = design.headerStyle === 'two-column';
  const needsIcons = design.links === 'icons';

  const preamble = [
    tokens.documentClass(design),
    tokens.fontPreamble(design),
    tokens.geometryPreamble(design),
    tokens.spacingPreamble(design),
    '\\usepackage{titlesec}',
    '\\usepackage{enumitem}',
    tokens.colorPreamble(design),
    needsTabularx ? '\\usepackage{tabularx}' : '',
    design.columns === 2 ? '\\usepackage{multicol}' : '',
    needsIcons ? '\\usepackage{fontawesome5}' : '',
    // bookmarks=false: with bookmarks on, hyperref writes each \section title
    // into the PDF outline, and \MakeUppercase (sheets/compact headings) is
    // not expandable in that PDF-string context — the compile dies with
    // "\MakeUppercaseUnsupportedInPdfStrings". A one-page resume has no use
    // for outline bookmarks anyway.
    '\\usepackage[hidelinks,bookmarks=false]{hyperref}',
    '\\pagestyle{empty}',
    '\\setlength{\\parindent}{0pt}',
    `\\titleformat{\\section}{${accent}${opts.headingFormat}}{}{0em}{}${rule}`,
    `\\titlespacing*{\\section}{0pt}{${spacing.before}}{${spacing.after}}`,
    `\\setlist[itemize]{leftmargin=0.18in, itemsep=${spacing.itemsep}, parsep=0pt, topsep=2pt, label=${tokens.bulletLabel(design)}}`,
  ].filter(Boolean).join('\n');

  const bodies = sectionBodies(content, design);
  const sections = visibleSections(content, design).map((key) => {
    if (key === 'customSections') {
      return (content.customSections || [])
        .filter((s) => hasItems(s.items))
        .map((s) => customSectionBlock(s, design, opts))
        .join('\n\n');
    }
    const body = bodies[key]();
    if (!body) return '';
    return `\\section{${opts.headingText(escapeLatex(sectionTitle(key, design)))}}\n${body}`;
  }).filter(Boolean).join('\n\n');

  const body = design.columns === 2
    ? `\\begin{multicols}{2}\n${sections}\n\\end{multicols}`
    : sections;

  return [
    preamble,
    '\\begin{document}',
    header(content, design, opts),
    '',
    body,
    '\\end{document}',
    '',
  ].join('\n');
};

module.exports = { renderBase };
