// Port of the Jake Gutierrez / sb2nov template — the canonical CS resume.
// Layout is faithful to the original (tabular* subheadings, small-caps
// sections, ragged-right) but driven by design tokens: geometry replaces
// fullpage at the source, and font / margins / spacing / section order /
// titles / bullet char / accent all come from DesignTokens.
//
// Deliberately dropped from the original preamble: latexsym, marvosym,
// verbatim, babel, fancyhdr (unused by the actual output — \pagestyle{empty}
// does the same as the empty fancy header) and glyphtounicode/\pdfgentounicode
// (pdfTeX-only primitives; Tectonic's XeTeX engine embeds unicode maps
// natively, which is what glyphtounicode existed to fix).
const tokens = require('../tokens');
const {
  escapeLatex, escapeList, dateRange, link, contactParts,
  hasItems, hasSkills, visibleSections, SKILL_LABELS,
} = require('./helpers');
const { sectionTitle } = require('../../../shared/resume');

const itemList = (items) => {
  const rows = (items || []).filter((b) => b && String(b).trim());
  if (!rows.length) return '';
  return [
    '      \\resumeItemListStart',
    ...rows.map((b) => `        \\resumeItem{${escapeLatex(b)}}`),
    '      \\resumeItemListEnd',
  ].join('\n');
};

const subheading = (l1, r1, l2, r2) =>
  `    \\resumeSubheading{${l1}}{${r1}}{${l2}}{${r2}}`;

const oneLine = (l, r) => `    \\resumeProjectHeading{${l}}{${r}}`;

const sectionBodies = (content, design) => ({
  experience: () =>
    (content.experience || []).map((e) => [
      subheading(
        escapeLatex(e.role), dateRange(e.startDate, e.endDate, e.isCurrent, design),
        escapeLatex(e.company), escapeLatex(e.location)
      ),
      itemList(e.bulletPoints),
    ].filter(Boolean).join('\n')).join('\n'),

  education: () =>
    (content.education || []).map((ed) => {
      const degree = [ed.degree, ed.fieldOfStudy].filter(Boolean).join(' in ');
      return [
        subheading(
          escapeLatex(ed.institution), dateRange(ed.startDate, ed.endDate, false, design),
          [degree ? escapeLatex(degree) : '', ed.gpa ? `GPA: ${escapeLatex(ed.gpa)}` : '']
            .filter(Boolean).join(' --- '),
          ''
        ),
        hasItems(ed.coursework)
          ? itemList([`Relevant Coursework: ${(ed.coursework || []).join(', ')}`])
          : '',
      ].filter(Boolean).join('\n');
    }).join('\n'),

  projects: () =>
    (content.projects || []).map((p) => {
      const title = p.link
        ? `\\textbf{${escapeLatex(p.title)}} $|$ ${link(p.link, 'link', design, 'faLink')}`
        : `\\textbf{${escapeLatex(p.title)}}`;
      const tech = hasItems(p.techStack) ? `\\emph{${escapeList(p.techStack)}}` : '';
      const heading = tech ? `${title} $|$ ${tech}` : title;
      return [
        oneLine(heading, ''),
        itemList([p.description, ...(p.bulletPoints || [])].filter(Boolean)),
      ].filter(Boolean).join('\n');
    }).join('\n'),

  skills: () => {
    if (!hasSkills(content.skills)) return '';
    const rows = Object.entries(SKILL_LABELS)
      .filter(([k]) => hasItems(content.skills[k]))
      .map(([k, label]) => `     \\textbf{${label}}{: ${escapeList(content.skills[k])}} \\\\`)
      .join('\n');
    return [
      ' \\begin{itemize}[leftmargin=0.15in, label={}]',
      '    \\small{\\item{',
      rows,
      '    }}',
      ' \\end{itemize}',
    ].join('\n');
  },

  certificates: () =>
    (content.certificates || []).map((c) => oneLine(
      [
        c.link ? link(c.link, c.name, design, 'faCertificate') : `\\textbf{${escapeLatex(c.name)}}`,
        c.issuer ? `$|$ \\emph{${escapeLatex(c.issuer)}}` : '',
      ].filter(Boolean).join(' '),
      c.date ? dateRange(c.date, null, false, design) : ''
    )).join('\n'),

  achievements: () =>
    (content.achievements || []).map((a) => [
      oneLine(`\\textbf{${escapeLatex(a.title)}}`, a.date ? dateRange(a.date, null, false, design) : ''),
      a.description ? itemList([a.description]) : '',
    ].filter(Boolean).join('\n')).join('\n'),

  publications: () =>
    (content.publications || []).map((p) => [
      oneLine(
        p.link ? link(p.link, p.title, design, 'faBook') : `\\textbf{${escapeLatex(p.title)}}`,
        p.date ? dateRange(p.date, null, false, design) : ''
      ),
      p.description ? itemList([p.description]) : '',
    ].filter(Boolean).join('\n')).join('\n'),

  volunteering: () =>
    (content.volunteering || []).map((v) => [
      subheading(
        escapeLatex(v.role), dateRange(v.startDate, v.endDate, false, design),
        escapeLatex(v.organization), ''
      ),
      v.description ? itemList([v.description]) : '',
    ].filter(Boolean).join('\n')).join('\n'),

  patents: () =>
    (content.patents || []).map((p) => [
      oneLine(
        `\\textbf{${escapeLatex(p.title)}}${p.number ? ` $|$ ${escapeLatex(p.number)}` : ''}`,
        p.date ? dateRange(p.date, null, false, design) : ''
      ),
      p.description ? itemList([p.description]) : '',
    ].filter(Boolean).join('\n')).join('\n'),

  hobbies: () =>
    (hasItems(content.hobbies)
      ? ` \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{${escapeList(content.hobbies)}}}\n \\end{itemize}`
      : ''),
});

// Sections whose bodies are already complete lists (no wrapping needed).
const SELF_CONTAINED = new Set(['skills', 'hobbies']);

const customSectionBody = (section, design) =>
  (section.items || []).map((item) => [
    oneLine(
      [
        item.title ? `\\textbf{${escapeLatex(item.title)}}` : '',
        item.subtitle ? `$|$ \\emph{${escapeLatex(item.subtitle)}}` : '',
        item.link ? `$|$ ${link(item.link, 'link', design, 'faLink')}` : '',
      ].filter(Boolean).join(' '),
      item.date ? dateRange(item.date, null, false, design) : ''
    ),
    itemList([item.description, ...(item.bullets || [])].filter(Boolean)),
  ].filter(Boolean).join('\n')).join('\n');

const header = (content, design) => {
  const u = content.user || {};
  const name = `\\textbf{\\Huge \\scshape ${escapeLatex(u.name || '')}}`;
  const contact = `\\small ${contactParts(u, design).join(' $|$ ')}`;
  if (design.headerStyle === 'left') {
    return `${name} \\\\ \\vspace{2pt}\n${contact}\n\\vspace{4pt}`;
  }
  if (design.headerStyle === 'two-column') {
    return [
      '\\begin{tabular*}{\\textwidth}{l@{\\extracolsep{\\fill}}r}',
      `  ${name} & ${contact}\\\\`,
      '\\end{tabular*}',
    ].join('\n');
  }
  return [
    '\\begin{center}',
    `    ${name} \\\\ \\vspace{4pt}`,
    `    ${contact}`,
    '\\end{center}',
  ].join('\n');
};

module.exports = (content, design) => {
  const spacing = tokens.sectionSpacing(design);
  const rule = design.sectionRule === 'line'
    ? `[\\color{accent}\\titlerule \\vspace{-5pt}]`
    : '';

  const preamble = [
    tokens.documentClass(design),
    tokens.fontPreamble(design),
    tokens.geometryPreamble(design),
    tokens.spacingPreamble(design),
    '\\usepackage{titlesec}',
    '\\usepackage{enumitem}',
    tokens.colorPreamble(design),
    '\\usepackage{tabularx}',
    design.links === 'icons' ? '\\usepackage{fontawesome5}' : '',
    '\\usepackage[hidelinks]{hyperref}',
    '\\urlstyle{same}',
    '\\pagestyle{empty}',
    '\\raggedbottom',
    '\\raggedright',
    '\\setlength{\\tabcolsep}{0in}',
    `\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large\\color{accent}}{}{0em}{}${rule}`,
    `\\titlespacing*{\\section}{0pt}{${spacing.before}}{${spacing.after}}`,
    '',
    '% Custom commands (Jake Gutierrez / sb2nov)',
    '\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-2pt}}}',
    '\\newcommand{\\resumeSubheading}[4]{',
    '  \\vspace{-2pt}\\item',
    '    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}',
    '      \\textbf{#1} & #2 \\\\',
    '      \\textit{\\small#3} & \\textit{\\small #4} \\\\',
    '    \\end{tabular*}\\vspace{-7pt}',
    '}',
    '\\newcommand{\\resumeProjectHeading}[2]{',
    '    \\item',
    '    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}',
    '      \\small#1 & #2 \\\\',
    '    \\end{tabular*}\\vspace{-7pt}',
    '}',
    '\\renewcommand\\labelitemii{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}',
    '\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}',
    '\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}',
    `\\newcommand{\\resumeItemListStart}{\\begin{itemize}[label=${tokens.bulletLabel(design)}, itemsep=${spacing.itemsep}]}`,
    '\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}',
  ].filter(Boolean).join('\n');

  const bodies = sectionBodies(content, design);
  const sections = visibleSections(content, design).map((key) => {
    if (key === 'customSections') {
      return (content.customSections || [])
        .filter((s) => hasItems(s.items))
        .map((s) => [
          `\\section{${escapeLatex(s.title || 'Additional')}}`,
          '  \\resumeSubHeadingListStart',
          customSectionBody(s, design),
          '  \\resumeSubHeadingListEnd',
        ].join('\n'))
        .join('\n\n');
    }
    const body = bodies[key]();
    if (!body) return '';
    const heading = `\\section{${escapeLatex(sectionTitle(key, design))}}`;
    if (SELF_CONTAINED.has(key)) return `${heading}\n${body}`;
    return [heading, '  \\resumeSubHeadingListStart', body, '  \\resumeSubHeadingListEnd'].join('\n');
  }).filter(Boolean).join('\n\n');

  return [
    preamble,
    '',
    '\\begin{document}',
    '',
    header(content, design),
    '',
    sections,
    '',
    '\\end{document}',
    '',
  ].join('\n');
};
