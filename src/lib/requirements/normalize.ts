// Value/unit normalization: guarantees VALUE + UNIT render exactly once.
//
// The extractor sometimes returns value="25 MPa" together with unit="MPa".
// This helper strips a trailing unit duplicated inside value, so the stored
// representation is value="25", unit="MPa". It only strips when the leftover
// is non-empty and the split point is safe (whitespace separator, or the
// leftover ends in a digit, e.g. "20mm"). Anything else is preserved
// faithfully — never guess.

export function splitValueUnit(
  value: string | null | undefined,
  unit: string | null | undefined
): { value: string; unit: string | null } {
  const v = (value ?? '').trim();
  const u = (unit ?? '').trim() || null;
  if (!v || !u) return { value: v, unit: u };

  const vl = v.toLowerCase();
  const ul = u.toLowerCase();
  if (vl.length > ul.length && vl.endsWith(ul)) {
    const cutAt = v.length - u.length;
    const sepIsSpace = /\s/.test(v[cutAt - 1] || '');
    const rest = v.slice(0, cutAt).trim().replace(/[,\-–:;]+$/, '').trim();
    const restEndsDigit = /\d$/.test(rest);
    if (rest && (sepIsSpace || restEndsDigit)) {
      return { value: rest, unit: u };
    }
  }
  return { value: v, unit: u };
}
