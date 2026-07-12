// Pre-bakes the Tectonic package cache at Docker image build time by
// compiling the fixture profile through every template and every design
// variant that pulls extra packages (each font, fontawesome icons, multicol,
// the fontsize package). After this runs, no production compile ever fetches
// a package over the network. A failure here fails the image build — that's
// deliberate: it means a template stopped compiling.
//
// Usage (in Dockerfile): HOME=/home/node node scripts/warmTectonicCache.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { render, TEMPLATES } = require('../services/latex/render');
const { validateDesign, FONTS } = require('../shared/resume');
const { profile } = require('../tests/fixtures/profile');

const variants = [
  // Every template with defaults.
  ...TEMPLATES.map((templateId) => ({ templateId, design: {} })),
  // Every font once (cheapest template).
  ...FONTS.map((font) => ({ templateId: 'sheets', design: { font } })),
  // Extra-package variants.
  { templateId: 'sheets', design: { links: 'icons' } }, // fontawesome5
  { templateId: 'sheets', design: { columns: 2, headerStyle: 'two-column' } }, // multicol, tabularx
  { templateId: 'sheets', design: { fontSize: 10.5 } }, // fontsize
];

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tectonic-warm-'));
let n = 0;
try {
  for (const { templateId, design } of variants) {
    n++;
    const tex = render(profile, validateDesign(design), templateId);
    const texPath = path.join(workDir, `warm${n}.tex`);
    fs.writeFileSync(texPath, tex);
    console.log(`[warm ${n}/${variants.length}] ${templateId} ${JSON.stringify(design)}`);
    execFileSync('tectonic', ['--untrusted', '--outdir', workDir, texPath], {
      stdio: 'inherit',
      timeout: 180000,
    });
  }
  console.log('Tectonic cache warmed.');
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
