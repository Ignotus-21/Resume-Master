const { escapeLatex, escapeUrl, escapeList } = require('../services/latex/escape');

describe('escapeLatex', () => {
  it.each([
    ['&', '\\&'],
    ['%', '\\%'],
    ['$', '\\$'],
    ['#', '\\#'],
    ['_', '\\_'],
    ['{', '\\{'],
    ['}', '\\}'],
    ['~', '\\textasciitilde{}'],
    ['^', '\\textasciicircum{}'],
    ['\\', '\\textbackslash{}'],
  ])('escapes %s -> %s', (input, expected) => {
    expect(escapeLatex(input)).toBe(expected);
  });

  it.each([
    ['R&D', 'R\\&D'],
    ['C++', 'C++'],
    ['100% growth', '100\\% growth'],
    ['Node_JS', 'Node\\_JS'],
    ['A&M', 'A\\&M'],
    ['$1.2M ARR', '\\$1.2M ARR'],
    ['#1 ranked', '\\#1 ranked'],
    ['50%+ uplift', '50\\%+ uplift'],
    ['C#', 'C\\#'],
    ['~/.bashrc', '\\textasciitilde{}/.bashrc'],
  ])('handles real-world string %s', (input, expected) => {
    expect(escapeLatex(input)).toBe(expected);
  });

  it('handles combinations of every special char', () => {
    expect(escapeLatex('\\&%$#_{}~^')).toBe(
      '\\textbackslash{}\\&\\%\\$\\#\\_\\{\\}\\textasciitilde{}\\textasciicircum{}'
    );
  });

  it('escapes a backslash without swallowing what follows it', () => {
    // \& in user text is a literal backslash followed by an ampersand —
    // both must be escaped independently.
    expect(escapeLatex('\\&')).toBe('\\textbackslash{}\\&');
    expect(escapeLatex('a\\nb')).toBe('a\\textbackslash{}nb');
  });

  it('output never contains an unescaped special character', () => {
    // Poor man's property test (fast-check would be a new dependency):
    // random strings drawn from the special-char alphabet must escape to
    // output with no bare specials outside of known escape sequences.
    const alphabet = '\\{}$&#^_~% aZ9.';
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 500; i++) {
      const len = Math.floor(rand() * 20);
      let s = '';
      for (let j = 0; j < len; j++) s += alphabet[Math.floor(rand() * alphabet.length)];
      const out = escapeLatex(s);
      // Strip all sequences we legitimately emit; nothing special may remain.
      const stripped = out
        .replace(/\\textbackslash\{\}/g, '')
        .replace(/\\textasciitilde\{\}/g, '')
        .replace(/\\textasciicircum\{\}/g, '')
        .replace(/\\[&%$#_{}]/g, '');
      expect(stripped).not.toMatch(/[\\{}$&#^_~%]/);
    }
  });

  it('normalizes newlines to spaces and strips control chars', () => {
    expect(escapeLatex('line one\nline two')).toBe('line one line two');
    expect(escapeLatex('a' + String.fromCharCode(7) + 'b')).toBe('ab');
  });

  it('returns empty string for null/undefined and stringifies non-strings', () => {
    expect(escapeLatex(null)).toBe('');
    expect(escapeLatex(undefined)).toBe('');
    expect(escapeLatex(42)).toBe('42');
  });
});

describe('escapeUrl', () => {
  it('keeps % and # functional in href targets (escaped, not stripped)', () => {
    expect(escapeUrl('https://x.com/a%20b#frag')).toBe('https://x.com/a\\%20b\\#frag');
  });

  it('escapes & and strips whitespace, braces and backslashes', () => {
    expect(escapeUrl('https://x.com/?a=1&b=2')).toBe('https://x.com/?a=1\\&b=2');
    expect(escapeUrl('https://x.com/{a} \\b')).toBe('https://x.com/ab');
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeUrl(null)).toBe('');
    expect(escapeUrl(undefined)).toBe('');
  });
});

describe('escapeList', () => {
  it('escapes each item and joins', () => {
    expect(escapeList(['C#', 'R&D'])).toBe('C\\#, R\\&D');
    expect(escapeList(['a', 'b'], ' | ')).toBe('a | b');
  });

  it('drops empty/null items and tolerates non-arrays', () => {
    expect(escapeList(['a', '', null, undefined, 'b'])).toBe('a, b');
    expect(escapeList(null)).toBe('');
    expect(escapeList('nope')).toBe('');
  });
});
