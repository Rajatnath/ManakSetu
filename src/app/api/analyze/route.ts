import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { splitValueUnit } from '@/lib/requirements/normalize';
import { extractPageTexts, isPageScanned } from '@/lib/ocr/pdfText';
import { ocrPages } from '@/lib/ocr/mistral';
import { writeProvenance, SourceMethod } from '@/lib/ocr/provenance';
import { chatCompletionWithRetry, embedTexts } from '@/lib/llm/mistral';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || '';
// Cheap default: Mistral Small (~$0.15/$0.60 per 1M tokens). Override with MISTRAL_MODEL.
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-small-latest';
const MISTRAL_EMBEDDING_MODEL = process.env.MISTRAL_EMBEDDING_MODEL || 'mistral-embed';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

if (!MISTRAL_API_KEY) {
  console.warn('MISTRAL_API_KEY is not set. Analysis requests will fail until it is configured.');
}

// Primary extraction model first, stronger (pricier) Medium as last-resort fallback.
const CHAT_MODEL_FALLBACKS = [MISTRAL_MODEL, 'mistral-medium-latest'].filter(
  (value, index, array) => value && array.indexOf(value) === index
);

const BASE_INSTRUCTIONS = `
  You are an expert procurement and technical standards extractor.
  Read this tender document and extract specific, measurable technical requirements (e.g., dimensions, load limits, electrical specs, safety codes, material grades, IP ratings).
  Ignore generic clauses. Focus on the core physical product or service specifications!

  Preserve the exact value and unit exactly as stated in the document (for example: "25 MPa", "2 storeys", "Fe500", "20 mm").
  Return the value WITHOUT its unit in the "value" field and put the unit only in the "unit" field
  (for example: value "25", unit "MPa" — never value "25 MPa" with unit "MPa").
  If the document states no unit for a requirement, return null for the unit. Do not guess or invent units.
  If the page number is unknown, return null for page_number. Do not guess page numbers.

  Return the results as a JSON array of objects strictly in this format:
  [
    {
      "category": "Electrical / Physical / Safety / etc",
      "requirement": "Clean name of requirement, e.g. Power Output or Material",
      "value": "e.g. 90W or 304 Grade",
      "unit": "W",
      "source_text": "A brief quote from the document proving this",
      "page_number": 1
    }
  ]

  Respond with ONLY the raw JSON array. Do not include markdown code block formatting like \`\`\`json.
  If you find no measurable technical requirements, return [].
`;

async function failTender(tenderId: string, message: string, status = 503) {
  await supabase.from('tenders').update({ status: 'analysis_failed' }).eq('id', tenderId);
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const { tenderId } = await request.json();

    if (!tenderId) return NextResponse.json({ error: 'Missing tenderId' }, { status: 400 });

    const { data: tender, error: fetchErr } = await supabase
      .from('tenders')
      .select('storage_path, status, id, filename')
      .eq('id', tenderId)
      .single();

    if (fetchErr || !tender) throw new Error('Tender not found');

    // Download the PDF from storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('tenders')
      .download(tender.storage_path);

    if (downloadErr || !fileData) throw new Error(`Download failed: ${downloadErr?.message}`);

    const arrayBuffer = await fileData.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Document metadata + per-page native text (shared with /api/inspect)
    let pageTexts: { page: number; text: string }[] = [];
    try {
      pageTexts = await extractPageTexts(pdfBuffer);
    } catch (e: any) {
      return failTender(tender.id, `PDF text inspection failed: ${e.message}. The file may be corrupted.`);
    }
    const pageCount = pageTexts.length > 0 ? pageTexts.length : null;
    if (pageCount) {
      await supabase.from('tenders').update({ page_count: pageCount }).eq('id', tender.id);
    }

    const scannedPages = pageTexts.filter(p => isPageScanned(p.text)).map(p => p.page);
    const pageMethods: Record<string, SourceMethod> = {};
    for (const p of pageTexts) pageMethods[p.page] = 'pdf_text';

    let useOcr = false;
    let ocrPagesDone: number[] = [];

    // Mistral chat takes text, not a PDF blob — so the tender text is always
    // assembled page by page (native PDF text + OCR only for scanned pages).
    let merged: { page: number; text: string; method: SourceMethod }[] =
      pageTexts.map(p => ({ page: p.page, text: p.text, method: 'pdf_text' as SourceMethod }));

    if (scannedPages.length > 0) {
      // OCR fallback — only for pages with no usable native text.
      if (!MISTRAL_API_KEY) {
        return failTender(
          tender.id,
          `Scanned pages detected (pages ${scannedPages.join(', ')}) with no extractable text, and OCR is not configured (MISTRAL_API_KEY). Ask the administrator to enable OCR, then retry analysis.`
        );
      }
      const { data: signed, error: signErr } = await supabase.storage
        .from('tenders')
        .createSignedUrl(tender.storage_path, 300);
      if (signErr || !signed?.signedUrl) {
        return failTender(tender.id, `Could not prepare the document for OCR: ${signErr?.message}. Retry analysis.`);
      }
      let ocrResults: { page: number; markdown: string }[] = [];
      try {
        ocrResults = await ocrPages({
          apiKey: MISTRAL_API_KEY,
          documentUrl: signed.signedUrl,
          documentName: tender.filename || 'tender.pdf',
          pagesZeroBased: scannedPages.map(p => p - 1),
        });
      } catch (e: any) {
        console.error('Mistral OCR failed:', e);
        return failTender(tender.id, `OCR fallback failed: ${e.message || 'OCR service error'}. Retry analysis.`);
      }

      const ocrByPage = new Map(ocrResults.map(r => [r.page, r.markdown]));
      merged = pageTexts.map(p => {
        if (!isPageScanned(p.text)) return { page: p.page, text: p.text, method: 'pdf_text' as SourceMethod };
        pageMethods[p.page] = 'ocr';
        ocrPagesDone.push(p.page);
        return { page: p.page, text: ocrByPage.get(p.page) || '', method: 'ocr' as SourceMethod };
      });
      useOcr = true;
    }

    const extractionPrompt = `
      ${BASE_INSTRUCTIONS}

      The tender text below was assembled page by page. Native PDF text was used where available;
      pages marked [OCR text] were read with OCR because the PDF page contained no extractable text.
      Page markers look like [Page 1 — PDF text] or [Page 3 — OCR text]. Use the marker number for
      page_number. Quote source_text from the provided text only.

      ${merged.map(m => `[Page ${m.page} — ${m.method === 'ocr' ? 'OCR text' : 'PDF text'}]\n${m.text}`).join('\n\n')}
    `;

    let extractedReqs: any[] = [];

    try {
      const content = await chatCompletionWithRetry({
        apiKey: MISTRAL_API_KEY,
        models: CHAT_MODEL_FALLBACKS,
        messages: [{ role: 'user', content: extractionPrompt }],
      });

      let textResp = content.trim();
      if (textResp.startsWith('```')) {
        textResp = textResp.replace(/```json/g, '').replace(/```/g, '').trim();
      }
      // Tolerate prose around the array (smaller models sometimes add a preamble).
      const arrayStart = textResp.indexOf('[');
      const arrayEnd = textResp.lastIndexOf(']');
      if (arrayStart !== -1 && arrayEnd > arrayStart) {
        textResp = textResp.slice(arrayStart, arrayEnd + 1);
      }

      extractedReqs = JSON.parse(textResp);
      if (!Array.isArray(extractedReqs)) throw new Error('Model did not return a JSON array.');
    } catch (err: any) {
      console.error('Mistral extraction failed:', err);
      await supabase.from('tenders').update({ status: 'analysis_failed' }).eq('id', tender.id);
      const rateLimited = err?.status === 429;
      return NextResponse.json({
        error: rateLimited
          ? 'Mistral AI rate limit reached. Please wait a few minutes and retry analysis (or raise the limits on your Mistral API plan).'
          : 'Mistral AI is temporarily unavailable. Please try again later or check the service status.',
        retryable: true,
      }, { status: rateLimited ? 429 : 503 });
    }

    console.log(`Extracted ${extractedReqs.length} requirements (ocr=${useOcr})`);

    // Generate Embeddings and Insert (batched: one mistral-embed call for all rows)
    const requirementMethods: Record<string, SourceMethod> = {};
    const validReqs = extractedReqs.filter((req) => req?.requirement && req?.value);

    // Normalize so value and unit never duplicate (e.g. value "25", unit "MPa")
    for (const req of validReqs) {
      const normalized = splitValueUnit(req.value, req.unit);
      req.value = normalized.value;
      req.unit = normalized.unit;
    }

    let embeddings: number[][] = validReqs.map(() => new Array(768).fill(0));
    if (validReqs.length > 0) {
      try {
        const vectors = await embedTexts({
          apiKey: MISTRAL_API_KEY,
          model: MISTRAL_EMBEDDING_MODEL,
          inputs: validReqs.map(
            (req) => `${req.category} | ${req.requirement} | ${req.value} | ${req.source_text}`
          ),
        });
        // mistral-embed is 1024 dims; DB stores vector(768) — truncate like before.
        embeddings = vectors.map((v) => v.slice(0, 768));
      } catch (embedErr) {
        console.warn('Embedding failed, using zero vector fallback:', embedErr);
      }
    }

    for (let i = 0; i < validReqs.length; i++) {
      const req = validReqs[i];
      const embedding = embeddings[i];
      const { data: inserted } = await supabase.from('tender_requirements').insert({
        tender_id: tender.id,
        category: req.category,
        requirement: req.requirement,
        value: req.value,
        unit: req.unit,
        source_text: req.source_text,
        page_number: req.page_number ?? null,
        embedding: embedding
      }).select('id').maybeSingle();

      // Provenance follows the attributed page; unknown page → unavailable (never guessed)
      const method = typeof req.page_number === 'number' ? pageMethods[req.page_number] || null : null;
      if (inserted?.id && method) requirementMethods[inserted.id] = method;
    }

    try {
      await writeProvenance(supabase, tender.id, {
        ocrUsed: useOcr,
        scannedPages,
        pageMethods,
        requirementMethods,
      });
    } catch (provErr) {
      console.warn('Provenance sidecar write failed (non-fatal):', provErr);
    }

    // Update status to analyzed
    await supabase.from('tenders').update({ status: 'analyzed' }).eq('id', tender.id);

    return NextResponse.json({
      success: true,
      count: extractedReqs.length,
      pageCount,
      ocrUsed: useOcr,
      scannedPages,
      ocrPages: ocrPagesDone,
    });

  } catch (err: any) {
    console.error('Analyze Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
