// M8 page-break quality: a section heading must never print alone at the
// bottom of a page with its content starting on the next one. Guarded by a
// \needspace before every \section (see tokens.SECTION_GUARD). The compile
// half of this suite reproduces the original bug: before the guards, the
// two-page fixture orphaned CERTIFICATIONS at the bottom of page 2 in
// sheets/compact/modern at the default design.
const { execFileSync, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const pdfParse = require('pdf-parse');
const { render, TEMPLATES } = require('../services/latex/render');
const tokens = require('../services/latex/tokens');
const { DEFAULT_SECTION_TITLES, DEFAULT_DESIGN, validateDesign } = require('../shared/resume');
const { twoPage } = require('./fixtures/twoPageProfile');

// Mirrors the renderTemplates.test.js snapshot matrix.
const DESIGN_VARIANTS = {
  default: DEFAULT_DESIGN,
  dense: validateDesign({
    font: 'TimesNewRoman', fontSize: 10, margin: 0.4, lineSpacing: 0.9,
    sectionSpacing: 'tight', sectionRule: 'none', bulletChar: '–',
    dateFormat: 'YYYY', links: 'plaintext', headerStyle: 'left',
  }),
  styled: validateDesign({
    font: 'FiraSans', fontSize: 12, margin: 1.0, lineSpacing: 1.3,
    sectionSpacing: 'airy', accentColor: '#1a73e8', bulletChar: '▪',
    dateFormat: 'MM/YYYY', links: 'hyperlink', headerStyle: 'two-column',
  }),
};

describe('page breaks: every \\section is guarded by \\needspace', () => {
  for (const templateId of TEMPLATES) {
    it(`${templateId}: guard precedes each heading, preamble has needspace + penalties`, () => {
      const tex = render(twoPage, DEFAULT_DESIGN, templateId);
      expect(tex).toContain('\\usepackage{needspace}');
      expect(tex).toContain('\\clubpenalty=10000');
      expect(tex).toContain('\\widowpenalty=10000');
      const lines = tex.split('\n');
      const headingLines = lines
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => l.startsWith('\\section{'));
      expect(headingLines.length).toBeGreaterThan(0);
      for (const { i } of headingLines) {
        expect(lines[i - 1]).toBe(tokens.SECTION_GUARD);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Integration: compile the two-page fixture and assert no non-final page ends
// with a bare section heading. Runs only where a tectonic binary is on PATH
// (same gate as renderTemplates.test.js).
const hasTectonic = (() => {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', ['tectonic'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const maybeDescribe = hasTectonic ? describe : describe.skip;

// All headings the fixture can produce; sheets/compact render them uppercase
// so the comparison is case-insensitive.
const HEADINGS = new Set(
  [
    ...Object.values(DEFAULT_SECTION_TITLES).filter(Boolean),
    ...twoPage.customSections.map((s) => s.title),
  ].map((t) => t.toLowerCase())
);

const compile = (tex) => new Promise((resolve, reject) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-pb-'));
  const texPath = path.join(dir, 'doc.tex');
  fs.writeFileSync(texPath, tex);
  execFile('tectonic', ['--untrusted', '--outdir', dir, texPath], { timeout: 90000 }, (err) => {
    try {
      if (err) throw err;
      resolve(fs.readFileSync(path.join(dir, 'doc.pdf')));
    } catch (e) {
      reject(e);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// The bottommost text line of each page. PDF text coordinates put the origin
// at the bottom-left corner, so the smallest y on a page is its last line;
// items sharing a (rounded) y are one visual line.
const pageBottomLines = async (pdfBuffer) => {
  const pages = [];
  await pdfParse(pdfBuffer, {
    pagerender: (pageData) => pageData.getTextContent().then((tc) => {
      const byY = new Map();
      for (const item of tc.items) {
        if (!item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        byY.set(y, (byY.get(y) || '') + item.str);
      }
      const ys = [...byY.keys()].sort((a, b) => a - b);
      pages.push(ys.length ? byY.get(ys[0]).trim() : '');
      return '';
    }),
  });
  return pages;
};

maybeDescribe('page breaks: compiled matrix never orphans a heading at a page bottom', () => {
  jest.setTimeout(120000);

  for (const templateId of TEMPLATES) {
    for (const [variant, design] of Object.entries(DESIGN_VARIANTS)) {
      it(`${templateId} / ${variant}`, async () => {
        const bottoms = await pageBottomLines(await compile(render(twoPage, design, templateId)));
        // The fixture must actually exercise a page break to prove anything.
        expect(bottoms.length).toBeGreaterThanOrEqual(2);
        for (const line of bottoms.slice(0, -1)) {
          expect(HEADINGS.has(line.toLowerCase())).toBe(false);
        }
      });
    }
  }
});
