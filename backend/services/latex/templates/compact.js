// Dense variant: smaller headings and name so more content fits a page.
// Overall density still follows design.sectionSpacing / margin / fontSize.
const { renderBase } = require('./base');

module.exports = (content, design) =>
  renderBase(content, design, {
    nameSize: '\\Large',
    headingFormat: '\\normalsize\\bfseries',
    headingText: (t) => `\\MakeUppercase{${t}}`,
    useAccent: false,
  });
