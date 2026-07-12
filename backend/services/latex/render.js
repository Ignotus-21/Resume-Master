// render(content, design, templateId) -> LaTeX string.
// PURE AND DETERMINISTIC: no I/O, no network, no LLM, no Date.now(), no
// randomness. Same input must always produce byte-identical output — this
// is asserted in tests and everything downstream (compile cache, template
// thumbnails, snapshot regression net) depends on it.
const { validateDesign } = require('../../shared/resume');

const templates = {
  sheets: require('./templates/sheets'),
  jake: require('./templates/jake'),
  compact: require('./templates/compact'),
  modern: require('./templates/modern'),
};

const render = (content, design, templateId) => {
  const template = templates[templateId] || templates.sheets;
  const c = content && typeof content === 'object' ? content : {};
  return template(c, validateDesign(design));
};

module.exports = { render, TEMPLATES: Object.keys(templates) };
