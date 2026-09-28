import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PageText {
  page: number; // 1-based
  text: string;
}

// Pages with less usable text than this are treated as scanned/image-only.
export const SCANNED_CHAR_THRESHOLD = 50;

export async function extractPageTexts(pdf: Buffer): Promise<PageText[]> {
  const doc = await pdfjs
    .getDocument({ data: new Uint8Array(pdf), verbosity: 0 } as any)
    .promise;
  const out: PageText[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const text = tc.items
        .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      out.push({ page: i, text });
    }
  } finally {
    // destroy() terminates pdf.js workers; typed loosely across pdfjs versions
    const destroyable = doc as unknown as { destroy?: () => Promise<void> };
    await destroyable.destroy?.().catch(() => undefined);
  }
  return out;
}

export function usableChars(text: string): number {
  return text.replace(/\s/g, '').length;
}

export function isPageScanned(text: string): boolean {
  return usableChars(text) < SCANNED_CHAR_THRESHOLD;
}
