const { parseLatexErrors, countPdfPages } = require('../services/latexService');

// Trimmed from real Tectonic/TeX logs.
const UNDEFINED_CONTROL_SEQUENCE = `
This is TeX, Version 3.141592653 (Tectonic 0.16.9)
(./resume.tex
LaTeX2e <2022-11-01>
! Undefined control sequence.
l.42 \\resumeItemm
                  {Led migration of a monolith}
The control sequence at the end of the top line
of your error message was never \\def'ed.
`;

const MISSING_DOLLAR = `
! Missing $ inserted.
<inserted text>
                $
l.17 100_
         % growth in revenue
I've inserted a begin-math/end-math symbol since I think
`;

const OVERFULL_HBOX = `
Overfull \\hbox (15.37506pt too wide) in paragraph at lines 100--102
[]\\OT1/cmr/m/n/10 This line is much too long for the column width
[1{/deps/.cache/Tectonic}]
LaTeX Warning: Reference \`sec:foo' on page 1 undefined on input line 12.
`;

describe('parseLatexErrors', () => {
  it('parses an undefined control sequence with its line and context', () => {
    const errors = parseLatexErrors(UNDEFINED_CONTROL_SEQUENCE);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      severity: 'error',
      line: 42,
      message: 'Undefined control sequence.',
    });
    expect(errors[0].context).toContain('\\resumeItemm');
  });

  it('parses a missing $ error with its line', () => {
    const errors = parseLatexErrors(MISSING_DOLLAR);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ severity: 'error', line: 17, message: 'Missing $ inserted.' });
  });

  it('parses overfull hbox and LaTeX warnings as warnings with lines', () => {
    const errors = parseLatexErrors(OVERFULL_HBOX);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({ severity: 'warning', line: 100 });
    expect(errors[0].message).toContain('Overfull box');
    expect(errors[1]).toMatchObject({ severity: 'warning', line: 12 });
  });

  it('returns [] for a clean log', () => {
    expect(parseLatexErrors('All good.\nOutput written on resume.pdf (1 page).')).toEqual([]);
    expect(parseLatexErrors('')).toEqual([]);
  });
});

describe('countPdfPages', () => {
  it('counts /Type /Page objects', () => {
    const pdf = Buffer.from(
      '%PDF-1.5\n1 0 obj << /Type /Pages /Count 2 >>\n2 0 obj << /Type /Page >>\n3 0 obj << /Type /Page >>\n%%EOF'
    );
    expect(countPdfPages(pdf)).toBe(2);
  });

  it('falls back to /Count when no page objects are visible', () => {
    const pdf = Buffer.from('%PDF-1.5\n1 0 obj << /Type /Pages /Count 3 >>\n%%EOF');
    expect(countPdfPages(pdf)).toBe(3);
  });

  it('never returns less than 1', () => {
    expect(countPdfPages(Buffer.from('%PDF-1.5'))).toBe(1);
  });
});
