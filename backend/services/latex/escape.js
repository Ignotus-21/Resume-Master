// The single choke point through which ALL user content enters LaTeX.
// No template file may interpolate a raw user string — everything goes
// through escapeLatex (text) or escapeUrl (\href targets).
//
// Escaping is applied exactly once, at render time, to raw JSON content.
// That structural guarantee (render() is the only caller, content is never
// stored escaped) is what prevents double-escaping — a self-detecting
// "idempotent" escape would have to guess whether "\&" in user text meant
// an escape or a literal, which is not decidable.

// Built with fromCharCode so no literal control characters live in this file.
const NUL = String.fromCharCode(0);
// C0 controls + DEL. Newlines are normalized to spaces before this runs.
const CONTROL_CHARS = new RegExp(
  '[' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']',
  'g'
);

const escapeLatex = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r?\n/g, ' ')
    .replace(CONTROL_CHARS, '')
    // Backslash first, via a placeholder: its replacement (\textbackslash{})
    // contains braces, which the brace rule below would then mangle.
    .replace(/\\/g, NUL)
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .split(NUL)
    .join('\\textbackslash{}');
};

// \href{<target>}{...} targets follow different rules: % (comment) and
// # (macro param) must be escaped — hyperref turns \% and \# back into
// literal % and # in the link target, so they survive into the PDF.
// Backslashes, braces and whitespace can't appear meaningfully in a URL;
// strip them along with control chars.
const escapeUrl = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(CONTROL_CHARS, '')
    .replace(/[\\{}\s]/g, '')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/&/g, '\\&');
};

const escapeList = (arr, sep = ', ') =>
  (Array.isArray(arr) ? arr : [])
    .filter((s) => s !== null && s !== undefined && String(s).trim() !== '')
    .map(escapeLatex)
    .join(sep);

module.exports = { escapeLatex, escapeUrl, escapeList };
