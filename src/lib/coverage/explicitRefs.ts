// Explicit Indian Standard references detected in tender text.
//
// Detects strings like "IS 456", "IS 1786:2008", "IS 875 (Part 2):1987",
// "IS/ISO 9001:2015" in raw document text. This is document observation ONLY:
// it never judges compliance and never feeds the retrieval engine.

export interface ExplicitReference {
  raw: string; // as written, e.g. "IS 875 (Part 2):1987"
  core: string; // normalized comparison key, e.g. "IS875-P2"
  page: number | null;
  context: string; // surrounding snippet as evidence
}

// IS <number> [(Part <n> ...)] [: year] — number 2-5 digits, optional ISO prefix
const IS_PATTERN = /\bIS(?:\/ISO|\/IEC)?\s*(\d{2,5})\s*(?:\(\s*Part\s*(\d+)[^)]*\))?\s*(?::\s*(\d{4}))?/gi;

export function normalizeIsCore(parts: { number: string; part?: string | null }): string {
  const num = (parts.number || '').replace(/^0+/, '');
  const part = parts.part ? `-P${parts.part.replace(/^0+/, '')}` : '';
  return `IS${num}${part}`.toUpperCase();
}

export function normalizeIsString(raw: string): string | null {
  IS_PATTERN.lastIndex = 0;
  const m = IS_PATTERN.exec(raw);
  IS_PATTERN.lastIndex = 0;
  if (!m) return null;
  return normalizeIsCore({ number: m[1], part: m[2] || null });
}

function snippet(text: string, index: number, length: number, radius = 70): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
}

export function findExplicitIsReferences(
  pages: { page: number; text: string }[]
): ExplicitReference[] {
  const seen = new Map<string, ExplicitReference>();
  for (const { page, text } of pages) {
    IS_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IS_PATTERN.exec(text)) !== null) {
      const raw = m[0].trim();
      const core = normalizeIsCore({ number: m[1], part: m[2] || null });
      const key = `${core}`;
      if (!seen.has(key)) {
        seen.set(key, { raw, core, page, context: snippet(text, m.index, m[0].length) });
      }
    }
  }
  IS_PATTERN.lastIndex = 0;
  return [...seen.values()];
}
