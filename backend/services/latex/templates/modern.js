// Contemporary look: mixed-case headings, accent color applied to headings
// and rules when the user picks one (null accent stays pure B/W).
const { renderBase } = require('./base');

module.exports = (content, design) =>
  renderBase(content, design, {
    nameSize: '\\huge',
    headingFormat: '\\Large\\bfseries',
    headingText: (t) => t,
    useAccent: true,
  });
