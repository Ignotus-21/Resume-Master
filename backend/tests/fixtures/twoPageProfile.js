// A deliberately long profile that compiles to 2+ pages in every template at
// the default design. Built for the page-break regression test: before the
// \needspace guards (M8), this resume orphaned a section heading at the
// bottom of page 1 (the heading printed alone, its content on page 2).
// Content volume is tuned so section boundaries land near the page break —
// don't trim it casually or the test loses its teeth.
const { profile } = require('../../shared/fixtureProfile');

const bullet = (i, extra = '') =>
  `Delivered workstream ${i}${extra}: scoped requirements with stakeholders, built and shipped the implementation, ` +
  'measured the outcome against the baseline, and documented the results for the wider engineering organization';

const twoPage = JSON.parse(JSON.stringify(profile));

twoPage.experience = [
  {
    company: 'Analytical Engines Ltd',
    role: 'Staff Software Engineer',
    startDate: 'January 2022',
    endDate: '',
    isCurrent: true,
    location: 'Remote',
    bulletPoints: [1, 2, 3, 4, 5].map((i) => bullet(i, ' for the compute platform')),
  },
  {
    company: 'Babbage & Co',
    role: 'Senior Software Engineer',
    startDate: 'March 2019',
    endDate: 'December 2021',
    isCurrent: false,
    location: 'London',
    bulletPoints: [1, 2, 3, 4, 5].map((i) => bullet(i, ' for the billing system')),
  },
  {
    company: 'Difference Works',
    role: 'Software Engineer',
    startDate: 'June 2016',
    endDate: 'February 2019',
    isCurrent: false,
    location: 'Cambridge',
    bulletPoints: [1, 2, 3, 4].map((i) => bullet(i, ' for the data pipeline')),
  },
  {
    company: 'Jacquard Systems',
    role: 'Junior Engineer',
    startDate: 'July 2014',
    endDate: 'May 2016',
    isCurrent: false,
    location: 'Manchester',
    bulletPoints: [1, 2, 3].map((i) => bullet(i, ' for the loom controller')),
  },
];

twoPage.projects = [
  {
    title: 'Difference Engine',
    techStack: ['Brass', 'Steam', 'Punch cards'],
    description: 'A mechanical calculator for polynomial functions, built end to end.',
    link: 'github.com/ada/difference-engine',
    bulletPoints: [1, 2, 3].map((i) => bullet(i, ' of the calculation engine')),
  },
  {
    title: 'Analytical Notes Compiler',
    techStack: ['Ada', 'TypeScript'],
    description: 'A compiler that turns annotated engine diagrams into executable programs.',
    link: '',
    bulletPoints: [1, 2].map((i) => bullet(i, ' of the compiler frontend')),
  },
  {
    title: 'Bernoulli Number Tabulator',
    techStack: ['Python'],
    description: 'Reference implementation of the first published algorithm.',
    link: '',
    bulletPoints: [1, 2].map((i) => bullet(i, ' of the tabulation service')),
  },
];

twoPage.education.push({
  institution: 'Royal Institution',
  degree: 'MSc',
  fieldOfStudy: 'Analytical Computation',
  startDate: '2013',
  endDate: '2014',
  gpa: '4.0/4.0',
  coursework: ['Advanced Mechanics', 'Symbolic Logic', 'Number Theory', 'Automata'],
});

twoPage.achievements = [
  { title: 'First programmer', description: 'Wrote the first published algorithm intended for machine execution.', date: '1843' },
  { title: 'Engineering excellence award', description: 'Recognized for sustained impact across the analytical platform.', date: '2023' },
  { title: 'Conference keynote', description: 'Invited keynote on mechanical computation at the Royal Society.', date: '2022' },
];

twoPage.publications = [
  { title: 'Notes on the Analytical Engine', link: '', date: '1843', description: 'Sketch of the engine with annotations on its operation.' },
  { title: 'On the Composition of Loom Programs', link: '', date: '1845', description: 'A treatise on sequencing punch card instructions.' },
];

module.exports = { twoPage };
