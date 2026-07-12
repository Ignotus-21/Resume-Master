// The regression net for the whole rendering system: snapshots of every
// template × design variant, determinism, escaping coverage, and (when a
// tectonic binary is available) real compiles of every snapshot.
const { execFileSync, execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { render, TEMPLATES } = require('../services/latex/render');
const { DEFAULT_DESIGN, validateDesign } = require('../shared/resume');
const { profile, special } = require('./fixtures/profile');

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
    sectionOrder: ['education', 'skills', 'experience'],
    hiddenSections: ['hobbies'],
    sectionTitles: { experience: 'Work History' },
  }),
};

describe('render: snapshots (fixture profile x templates x design variants)', () => {
  for (const templateId of TEMPLATES) {
    for (const [variant, design] of Object.entries(DESIGN_VARIANTS)) {
      it(`${templateId} / ${variant}`, () => {
        expect(render(profile, design, templateId)).toMatchSnapshot();
      });
    }
  }
});

describe('render: determinism', () => {
  it('same input produces byte-identical output', () => {
    for (const templateId of TEMPLATES) {
      const a = render(profile, DESIGN_VARIANTS.styled, templateId);
      const b = render(profile, DESIGN_VARIANTS.styled, templateId);
      expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    }
  });
});

describe('render: behavior', () => {
  it('unknown template falls back to sheets', () => {
    expect(render(profile, DEFAULT_DESIGN, 'nope')).toBe(render(profile, DEFAULT_DESIGN, 'sheets'));
  });

  it('tolerates empty content', () => {
    for (const templateId of TEMPLATES) {
      const tex = render({}, DEFAULT_DESIGN, templateId);
      expect(tex).toContain('\\begin{document}');
      expect(tex).toContain('\\end{document}');
    }
  });

  it('honours hiddenSections and sectionTitles', () => {
    const design = validateDesign({ hiddenSections: ['projects'], sectionTitles: { experience: 'Employment' } });
    const tex = render(profile, design, 'sheets');
    expect(tex).not.toContain('Difference Engine');
    expect(tex).toContain('\\MakeUppercase{Employment}');
    expect(tex).not.toContain('\\MakeUppercase{Experience}');
  });

  it('honours sectionOrder', () => {
    const design = validateDesign({ sectionOrder: ['skills', 'experience'] });
    const tex = render(profile, design, 'jake');
    expect(tex.indexOf('Technical Skills')).toBeLessThan(tex.indexOf('Experience'));
  });

  it('renders custom sections in every template', () => {
    for (const templateId of TEMPLATES) {
      const tex = render(profile, DEFAULT_DESIGN, templateId);
      expect(tex).toContain('Leadership');
      expect(tex).toContain('Royal Society');
    }
  });

  it('never leaks an unescaped special char from user content', () => {
    for (const templateId of TEMPLATES) {
      const tex = render(special, DEFAULT_DESIGN, templateId);
      // The tell-tale of a raw "R&D"/"Node_JS" leak: & or _ not preceded
      // by a backslash. Template-authored & (tabular alignment) is always
      // in template literals like `& #2` / `& contact` — check content
      // markers instead.
      expect(tex).toContain('R\\&D');
      expect(tex).toContain('100\\%');
      expect(tex).toContain('\\$1.2M');
      expect(tex).toContain('\\#1');
      expect(tex).toContain('C\\#');
      expect(tex).toContain('Node\\_JS');
      expect(tex).toContain('\\{braces\\}');
      expect(tex).toContain('\\textasciitilde{}');
      expect(tex).toContain('\\textasciicircum{}');
      expect(tex).toContain('\\textbackslash{}');
      expect(tex).not.toContain('R&D');
      expect(tex).not.toContain('Node_JS');
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: every snapshot must compile under a real Tectonic. Runs only
// when a tectonic binary is on PATH (CI mocks execFile; dev machines without
// tectonic skip). Note latexService mocks child_process in other test files —
// this file uses the real one.
const hasTectonic = (() => {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', ['tectonic'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const maybeDescribe = hasTectonic ? describe : describe.skip;

maybeDescribe('render: real Tectonic compile of every template/variant', () => {
  jest.setTimeout(120000);

  const compile = (tex) => new Promise((resolve) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-tex-'));
    const texPath = path.join(dir, 'doc.tex');
    fs.writeFileSync(texPath, tex);
    execFile('tectonic', ['--untrusted', '--outdir', dir, texPath], { timeout: 90000 }, (err) => {
      const ok = fs.existsSync(path.join(dir, 'doc.pdf'));
      fs.rmSync(dir, { recursive: true, force: true });
      resolve(ok && !err);
    });
  });

  for (const templateId of TEMPLATES) {
    it(`${templateId}: default design + specials profile compiles`, async () => {
      expect(await compile(render(special, DEFAULT_DESIGN, templateId))).toBe(true);
    });
    it(`${templateId}: styled variant compiles`, async () => {
      expect(await compile(render(profile, DESIGN_VARIANTS.styled, templateId))).toBe(true);
    });
  }
});
