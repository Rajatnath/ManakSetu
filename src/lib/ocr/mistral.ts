import { Mistral } from '@mistralai/mistralai';

export interface OcrPage {
  page: number; // 1-based
  markdown: string;
}

// OCRs ONLY the given (0-based) pages of a PDF reachable at documentUrl.
// Used strictly as a fallback for pages with no usable native text.
export async function ocrPages(opts: {
  apiKey: string;
  documentUrl: string;
  documentName: string;
  pagesZeroBased: number[];
}): Promise<OcrPage[]> {
  const client = new Mistral({ apiKey: opts.apiKey });
  const maxRetries = 2;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res: any = await client.ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          documentUrl: opts.documentUrl,
          documentName: opts.documentName,
        } as any,
        pages: opts.pagesZeroBased,
      } as any);

      // Defensive: accept both direct and Result-wrapped response shapes.
      const payload = res && typeof res === 'object' && 'data' in res && res.data ? res.data : res;
      const pages = (payload && Array.isArray(payload.pages) ? payload.pages : []) as any[];
      return pages.map((p: any) => ({
        page: (typeof p.index === 'number' ? p.index : 0) + 1,
        markdown: typeof p.markdown === 'string' ? p.markdown : '',
      }));
    } catch (e: any) {
      lastError = e;
      const msg = String(e?.message || '');
      const isRateLimit = e?.status === 429 || /429|rate.?limit|1300/i.test(msg);
      if (isRateLimit && attempt < maxRetries) {
        const waitMs = attempt === 0 ? 8000 : 25000;
        console.warn(`Mistral OCR rate-limited. Retrying in ${waitMs / 1000}s...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}
