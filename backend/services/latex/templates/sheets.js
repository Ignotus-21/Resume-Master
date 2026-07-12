// The SheetsResume-style safe default: single column, Garamond (via design
// default), uppercase headings with a rule, strictly black and white.
const { renderBase } = require('./base');

module.exports = (content, design) =>
  renderBase(content, design, {
    nameSize: '\\LARGE',
    headingFormat: '\\large\\bfseries',
    headingText: (t) => `\\MakeUppercase{${t}}`,
    useAccent: false,
  });
