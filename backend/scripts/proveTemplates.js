// Pipeline-proof step 3: compile every template x design variant against a
// realistic MasterProfile fixture (packed with LaTeX special characters)
// through the REAL render() -> compileCache -> compileLatex() path — the same
// flow middleware/compile.js + resumeController.compileResume run in prod.
//
// Runs the full matrix twice in one process: without Redis the compile cache
// is in-process memory, so pass 2 is the cache-hit proof.
//
// Usage: node scripts/proveTemplates.js   (needs a tectonic binary on PATH)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { render, TEMPLATES } = require('../services/latex/render');
const { validateDesign } = require('../shared/resume');
const { compileLatex } = require('../services/latexService');
const compileCache = require('../services/compileCache');
const { special } = require('../tests/fixtures/profile');

// The special fixture already carries R&D, 100%, $1.2M, #1, C++, C#, Node_JS,
// {braces}, ~, ^, backslash in every section. Add the exact strings the proof
// prompt calls out that it lacks verbatim.
const fixture = JSON.parse(JSON.stringify(special));
fixture.education[0].institution = 'A&M University';
fixture.education[0].coursework = ['C#', 'R&D', '100% growth'];
fixture.experience[0].bulletPoints.push(
  'Scaled to $1.2M ARR — #1 ranked team, 50%+ uplift on Node_JS + C++ services'
);

const VARIANTS = {
  default: {},
  dense: { sectionSpacing: 'tight', fontSize: 10 },
  airy: { sectionSpacing: 'airy', fontSize: 12 },
};

const run = async () => {
  const rows = [];
  for (let pass = 1; pass <= 2; pass++) {
    for (const templateId of TEMPLATES) {
      for (const [variant, design] of Object.entries(VARIANTS)) {
        const tex = render(fixture, validateDesign(design), templateId);
        const hash = compileCache.hashTex(tex);
        const started = Date.now();
        const cached = await compileCache.get(hash);
        let row;
        if (cached) {
          row = {
            pass, templateId, variant, success: true,
            pages: cached.pages,
            ms: Date.now() - started,
            pdfBytes: Buffer.from(cached.pdf, 'base64').length,
            cached: true,
          };
        } else {
          const result = await compileLatex(tex);
          row = {
            pass, templateId, variant, success: result.success,
            pages: result.success ? result.pages : null,
            ms: Date.now() - started,
            pdfBytes: result.success ? result.pdf.length : null,
            cached: false,
          };
          if (result.success) {
            await compileCache.set(hash, { pdf: result.pdf.toString('base64'), pages: result.pages });
          } else {
            row.errors = result.errors || [];
            row.log = result.log || result.error || '';
            console.error(`\nFAIL ${templateId}/${variant} (pass ${pass}) — Tectonic log:\n${row.log}\n`);
          }
        }
        rows.push(row);
        console.log(
          `[pass ${pass}] ${templateId.padEnd(8)} ${variant.padEnd(8)} ` +
          `${row.success ? 'OK  ' : 'FAIL'} pages=${row.pages ?? '-'} ` +
          `${String(row.ms).padStart(6)}ms pdf=${row.pdfBytes ?? '-'}b cached=${row.cached}`
        );
      }
    }
  }

  const report = { generatedAt: new Date().toISOString(), stats: compileCache.getStats(), rows };
  const outPath = fs.existsSync('/tmp')
    ? '/tmp/template-proof-report.json'
    : path.join(os.tmpdir(), 'template-proof-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  const failures = rows.filter((r) => !r.success);
  console.log(`\nCache stats: ${JSON.stringify(report.stats)}`);
  console.log(`Report written to ${outPath}`);
  console.log(failures.length ? `${failures.length} FAILURE(S)` : 'All cells passed.');
  process.exit(failures.length ? 1 : 0);
};

run().catch((err) => {
  console.error('proveTemplates crashed:', err);
  process.exit(1);
});
