// Requirement provenance sidecar.
//
// Per-requirement source method (native PDF text vs OCR) cannot live in a new
// DB column (no DDL path in this prototype), so analyze writes a small JSON
// sidecar next to the tender in Storage. Analysis + recommendations read it;
// a missing sidecar (older tenders) resolves to "unavailable" — never guessed.

export type SourceMethod = 'pdf_text' | 'ocr';

export interface ProvenanceDoc {
  tenderId: string;
  ocrUsed: boolean;
  scannedPages: number[];
  pageMethods: Record<string, SourceMethod>;
  requirementMethods: Record<string, SourceMethod>;
  generatedAt: string;
}

const PREFIX = 'provenance/';

// Dedicated private bucket (the 'tenders' bucket only allows application/pdf).
const BUCKET = 'tender-meta';

export function provenancePath(tenderId: string): string {
  return `${PREFIX}${tenderId}.json`;
}

export async function writeProvenance(
  supabase: any,
  tenderId: string,
  doc: Omit<ProvenanceDoc, 'tenderId' | 'generatedAt'>
): Promise<void> {
  const full: ProvenanceDoc = {
    ...doc,
    tenderId,
    generatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(provenancePath(tenderId), JSON.stringify(full), {
      contentType: 'application/json',
      upsert: true,
    });
  if (error) throw new Error(`Provenance write failed: ${error.message}`);
}

export async function readProvenance(supabase: any, tenderId: string): Promise<ProvenanceDoc | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(provenancePath(tenderId));
    if (error || !data) return null;
    const parsed = JSON.parse(await data.text());
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      tenderId,
      ocrUsed: !!parsed.ocrUsed,
      scannedPages: Array.isArray(parsed.scannedPages) ? parsed.scannedPages : [],
      pageMethods: parsed.pageMethods || {},
      requirementMethods: parsed.requirementMethods || {},
      generatedAt: parsed.generatedAt || '',
    };
  } catch {
    return null;
  }
}
