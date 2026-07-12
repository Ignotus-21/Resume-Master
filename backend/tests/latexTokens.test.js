const tokens = require('../services/latex/tokens');
const { DEFAULT_DESIGN, validateDesign, FONTS } = require('../shared/resume');

const design = (overrides = {}) => validateDesign({ ...DEFAULT_DESIGN, ...overrides });

describe('tokens: documentClass', () => {
  it('uses the class option for whole point sizes', () => {
    expect(tokens.documentClass(design({ fontSize: 12 }))).toBe(
      '\\documentclass[letterpaper,12pt]{article}'
    );
  });

  it('uses the fontsize package for 10.5pt', () => {
    const out = tokens.documentClass(design({ fontSize: 10.5 }));
    expect(out).toContain('[fontsize=10.5pt]{fontsize}');
  });
});

describe('tokens: fontPreamble', () => {
  it('maps every allowed font to a package line', () => {
    for (const font of FONTS) {
      const out = tokens.fontPreamble(design({ font }));
      expect(out).toContain('\\usepackage');
    }
  });
});

describe('tokens: geometry/spacing/color', () => {
  it('emits geometry with the margin in inches', () => {
    expect(tokens.geometryPreamble(design({ margin: 0.5 }))).toBe(
      '\\usepackage[margin=0.5in]{geometry}'
    );
  });

  it('emits setstretch with the line spacing', () => {
    expect(tokens.spacingPreamble(design({ lineSpacing: 1.2 }))).toContain('\\setstretch{1.2}');
  });

  it('defines the accent color from hex, defaulting to black', () => {
    expect(tokens.colorPreamble(design({ accentColor: '#1a73e8' }))).toContain(
      '\\definecolor{accent}{HTML}{1A73E8}'
    );
    expect(tokens.colorPreamble(design({ accentColor: null }))).toContain(
      '\\definecolor{accent}{HTML}{000000}'
    );
  });

  it('section rule toggles with the token', () => {
    expect(tokens.sectionRule(design({ sectionRule: 'line' }))).toContain('\\titlerule');
    expect(tokens.sectionRule(design({ sectionRule: 'none' }))).toBe('');
  });

  it('maps every section spacing density', () => {
    for (const s of ['tight', 'normal', 'airy']) {
      expect(tokens.sectionSpacing(design({ sectionSpacing: s }))).toHaveProperty('before');
    }
  });

  it('maps every bullet char to a text-mode label', () => {
    for (const b of ['•', '–', '▪']) {
      expect(typeof tokens.bulletLabel(design({ bulletChar: b }))).toBe('string');
    }
  });
});

describe('validateDesign', () => {
  it('returns defaults for garbage input', () => {
    expect(validateDesign(null)).toEqual(expect.objectContaining({ font: 'Garamond', fontSize: 11 }));
    expect(validateDesign('junk')).toEqual(expect.objectContaining({ columns: 1 }));
  });

  it('clamps numeric ranges', () => {
    const d = validateDesign({ margin: 3, lineSpacing: 0.1 });
    expect(d.margin).toBe(1.0);
    expect(d.lineSpacing).toBe(0.9);
  });

  it('rejects unknown enum values', () => {
    const d = validateDesign({ font: 'ComicSans', bulletChar: 'x', columns: 5 });
    expect(d.font).toBe('Garamond');
    expect(d.bulletChar).toBe('•');
    expect(d.columns).toBe(1);
  });

  it('filters sectionOrder to known keys and re-appends missing ones', () => {
    const d = validateDesign({ sectionOrder: ['education', 'bogus', 'experience'] });
    expect(d.sectionOrder.slice(0, 2)).toEqual(['education', 'experience']);
    expect(d.sectionOrder).toContain('skills');
    expect(d.sectionOrder).not.toContain('bogus');
  });

  it('accepts only #rrggbb accent colors', () => {
    expect(validateDesign({ accentColor: '#12abEF' }).accentColor).toBe('#12abEF');
    expect(validateDesign({ accentColor: 'red' }).accentColor).toBe(null);
    expect(validateDesign({ accentColor: '#fff' }).accentColor).toBe(null);
  });
});
