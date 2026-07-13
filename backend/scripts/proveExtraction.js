// M9 proof: run the REAL resume-extraction path (parseResumeData -> Gemini
// structured output -> schema validation) against real-shaped resume texts
// and check the field mapping is reasonable. Extraction is inherently fuzzy,
// so "reasonable" is defined as:
//   - required fields populate: user.name + at least one experience entry
//     with a company or role
//   - nothing crashes / nothing schema-invalid gets through (parseResumeData
//     already throws AI_BAD_RESPONSE on that)
// plus per-fixture expectations listed below (e.g. the two-column resume must
// not lose the main-column experience; unusual section names must land in a
// sensible IR section, not vanish).
//
// Usage: node scripts/proveExtraction.js   (needs GEMINI_API_KEY in .env;
// each fixture is one real Gemini call)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { parseResumeData } = require('../services/geminiService');

const has = (v) => typeof v === 'string' && v.trim().length > 0;

const FIXTURES = [
  {
    file: 'resume-single-column.txt',
    label: 'single-column classic',
    expect: (c, problems) => {
      if (!/marcus/i.test(c.user.name)) problems.push(`name: got "${c.user.name}"`);
      if (c.experience.length < 2) problems.push(`experience: expected >=2 entries, got ${c.experience.length}`);
      if (!c.experience.some((e) => /stripe/i.test(e.company))) problems.push('experience: Stripe entry missing');
      if (!c.education.some((e) => /berkeley/i.test(e.institution))) problems.push('education: Berkeley missing');
      const skills = Object.values(c.skills).flat().join(' ');
      if (!/kafka/i.test(skills)) problems.push('skills: Kafka not captured');
      if (!c.projects.some((p) => /ledgerline/i.test(p.title))) problems.push('projects: Ledgerline missing');
    },
  },
  {
    file: 'resume-two-column.txt',
    label: 'two-column (sidebar text extracted before main column)',
    expect: (c, problems) => {
      if (!/priya/i.test(c.user.name)) problems.push(`name: got "${c.user.name}"`);
      if (!c.experience.some((e) => /flipkart/i.test(e.company))) problems.push('experience: Flipkart (main column) missing');
      if (!c.experience.some((e) => /delhivery/i.test(e.company))) problems.push('experience: Delhivery (main column) missing');
      if (c.certificates.length < 1) problems.push('certificates: sidebar certifications lost');
      const skills = Object.values(c.skills).flat().join(' ');
      if (!/snowflake/i.test(skills)) problems.push('skills: sidebar skills lost');
    },
  },
  {
    file: 'resume-unusual-sections.txt',
    label: 'unusual section names (My Story / Professional Journey / Toolbox…)',
    expect: (c, problems) => {
      if (!/okafor/i.test(c.user.name)) problems.push(`name: got "${c.user.name}"`);
      if (!c.experience.some((e) => /helixdx/i.test(e.company))) {
        problems.push('experience: "Professional Journey" entries not mapped to experience');
      }
      if (!c.education.some((e) => /cambridge/i.test(e.institution))) {
        problems.push('education: "Academic Credentials" not mapped to education');
      }
      // Speaking/distinctions may land in achievements, customSections or
      // publications — any of those is reasonable; vanishing entirely is not.
      const overflow =
        c.achievements.length + c.customSections.reduce((n, s) => n + (s.items?.length || 0), 0);
      if (overflow < 1) problems.push('speaking/distinctions vanished (no achievements/customSections)');
    },
  },
  {
    file: 'resume-messy.txt',
    label: 'messy input (broken spacing, strikethrough unicode, page headers)',
    expect: (c, problems) => {
      // The floor for garbage-in: don't crash, still find the person and at
      // least one plausible experience entry.
      if (!/jordan|alvarez/i.test(c.user.name)) problems.push(`name: got "${c.user.name}"`);
      if (!c.experience.some((e) => has(e.company) || has(e.role))) {
        problems.push('experience: no entry with a company or role');
      }
    },
  },
];

(async () => {
  let failures = 0;
  for (const { file, label, expect } of FIXTURES) {
    const text = fs.readFileSync(path.join(__dirname, 'fixtures', file), 'utf8');
    process.stdout.write(`\n=== ${file} (${label})\n`);
    let content;
    try {
      content = await parseResumeData(text, null);
    } catch (err) {
      failures++;
      console.log(`  CRASH: ${err.code || err.name}: ${err.detail || err.message}`);
      continue;
    }

    const problems = [];
    // Universal floor first…
    if (!has(content.user?.name)) problems.push('required: user.name is empty');
    if (!Array.isArray(content.experience) || content.experience.length === 0) {
      problems.push('required: no experience entries');
    }
    // …then the fixture-specific mapping expectations.
    try {
      expect(content, problems);
    } catch (err) {
      problems.push(`expectation code threw: ${err.message}`);
    }

    console.log(
      `  name="${content.user?.name}" experience=${content.experience?.length}` +
      ` education=${content.education?.length} projects=${content.projects?.length}` +
      ` certs=${content.certificates?.length} achievements=${content.achievements?.length}` +
      ` custom=${content.customSections?.length}` +
      ` skills=${Object.values(content.skills || {}).flat().length}`
    );
    if (problems.length === 0) {
      console.log('  PASS');
    } else {
      failures++;
      console.log(`  FAIL:\n    - ${problems.join('\n    - ')}`);
    }
  }
  console.log(`\n${failures === 0 ? 'ALL FIXTURES PASS' : `${failures} fixture(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
