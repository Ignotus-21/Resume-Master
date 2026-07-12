// Fixture profile exercising every section, used by the render snapshot
// tests. `special` is the same shape with LaTeX special characters packed
// into every field — the whole-document escaping regression test.
const profile = {
  user: {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+1 555 010 0101',
    linkedin: 'linkedin.com/in/ada',
    github: 'github.com/ada',
    website: 'ada.dev',
    location: 'London, UK',
  },
  experience: [
    {
      company: 'Analytical Engines Ltd',
      role: 'Senior Software Engineer',
      startDate: 'January 2022',
      endDate: '',
      isCurrent: true,
      location: 'Remote',
      bulletPoints: [
        'Led migration of a monolith to services, cutting deploy time by 80%',
        'Mentored 4 engineers; introduced code review practices',
      ],
    },
    {
      company: 'Babbage & Co',
      role: 'Software Engineer',
      startDate: 'March 2019',
      endDate: 'December 2021',
      isCurrent: false,
      location: 'London',
      bulletPoints: ['Built the first compiler'],
    },
  ],
  education: [
    {
      institution: 'University of London',
      degree: 'BSc',
      fieldOfStudy: 'Mathematics',
      startDate: '2015',
      endDate: '2019',
      gpa: '3.9/4.0',
      coursework: ['Number Theory', 'Mechanics'],
    },
  ],
  projects: [
    {
      title: 'Difference Engine',
      techStack: ['Brass', 'Steam'],
      description: 'A mechanical calculator for polynomial functions.',
      link: 'github.com/ada/difference-engine',
      bulletPoints: ['Computed tables to 31 digits'],
    },
  ],
  skills: {
    languages: ['Ada', 'Python', 'TypeScript'],
    frameworks: ['React', 'Express'],
    tools: ['Git', 'Docker'],
    other: ['Distributed systems'],
  },
  certificates: [{ name: 'AWS Solutions Architect', issuer: 'Amazon', date: 'June 2023', link: '' }],
  achievements: [{ title: 'First programmer', description: 'Wrote the first algorithm.', date: '1843' }],
  publications: [{ title: 'Notes on the Analytical Engine', link: '', date: '1843', description: 'Sketch of the engine.' }],
  volunteering: [{ organization: 'Code Club', role: 'Mentor', startDate: '2020', endDate: '2022', description: 'Taught kids to code.' }],
  patents: [{ title: 'Loom control mechanism', number: 'GB-0001', date: '1842', link: '', description: 'Punch card sequencing.' }],
  hobbies: ['Chess', 'Horse racing'],
  customSections: [
    {
      title: 'Leadership',
      items: [
        {
          title: 'Chair',
          subtitle: 'Royal Society computing group',
          date: '1841',
          link: '',
          description: 'Organized monthly colloquia.',
          bullets: ['Grew membership 3x'],
        },
      ],
    },
  ],
};

// Every text field carries LaTeX specials — if any of these leak unescaped,
// the compile integration test fails.
const SPECIALS = 'R&D 100% $1.2M #1 C++ C# Node_JS {braces} ~home ^caret \\backslash';
const special = JSON.parse(JSON.stringify(profile));
special.user.name = 'A&M $mith #1';
special.user.location = '100% {remote} ~_^';
special.experience[0].role = `Engineer ${SPECIALS}`;
special.experience[0].company = SPECIALS;
special.experience[0].bulletPoints = [SPECIALS, 'Grew ARR to $1.2M (50%+ uplift) via A&M pipeline_v2'];
special.education[0].institution = SPECIALS;
special.education[0].coursework = ['C#', 'R&D', '100% growth'];
special.projects[0].title = SPECIALS;
special.projects[0].description = SPECIALS;
special.projects[0].techStack = ['C++', 'C#', 'F#'];
special.skills.languages = ['C++', 'C#', 'Node_JS'];
special.skills.other = [SPECIALS];
special.certificates[0].name = SPECIALS;
special.achievements[0].title = SPECIALS;
special.achievements[0].description = SPECIALS;
special.publications[0].title = SPECIALS;
special.publications[0].description = SPECIALS;
special.volunteering[0].description = SPECIALS;
special.patents[0].title = SPECIALS;
special.hobbies = ['~/.bashrc', '50%+ uplift'];
special.customSections[0].title = 'R&D #Awards';
special.customSections[0].items[0].title = SPECIALS;
special.customSections[0].items[0].description = SPECIALS;
special.customSections[0].items[0].bullets = [SPECIALS];

module.exports = { profile, special };
