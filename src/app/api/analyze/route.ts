import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { splitValueUnit } from '@/lib/requirements/normalize';
import { extractPageTexts, isPageScanned } from '@/lib/ocr/pdfText';
import { ocrPages } from '@/lib/ocr/mistral';
import { writeProvenance, SourceMethod } from '@/lib/ocr/provenance';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

if (!GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set. Gemini requests will fail until it is configured.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const GEMINI_MODEL_FALLBACKS = [
  GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
].filter((value, index, array) => value && array.indexOf(value) === index);

function getGeminiModel(modelName: string) {
  return genAI.getGenerativeModel({ model: modelName });
}

function formatGeminiError(error: any) {
  if (!error) return 'Unknown Gemini error';

  const status = error.status ?? error.code ?? 'unknown';
  const message = error.message || 'No details provided';

  if (status === 404 || status === 400) {
    return `Gemini model configuration error: ${message}. Check GEMINI_MODEL and GEMINI_API_KEY.`;
  }

  return `Gemini request failed (${status}): ${message}`;
}

async function generateContentWithRetry(prompt: any, inlineData?: any, maxRetries = 3) {
  let lastError: any = null;

  for (const modelName of GEMINI_MODEL_FALLBACKS) {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const model = getGeminiModel(modelName);
        const parts = inlineData ? [prompt, inlineData] : [prompt];
        const result = await model.generateContent(parts);
        return result;
      } catch (error: any) {
        lastError = error;

        const status = error?.status ?? error?.code;
        const isRetryable = status === 503 || status === 429 || status === 500;

        if (isRetryable && attempt < maxRetries - 1) {
          attempt++;
          console.warn(`[${status}] Gemini ${modelName} is temporarily unavailable. Retrying in ${attempt * 4} seconds...`);
          await new Promise(res => setTimeout(res, attempt * 4000));
          continue;
        }

        if (status === 404 || status === 400) {
          console.warn(`Gemini model ${modelName} is unavailable; trying fallback models...`);
          break;
        }

        throw new Error(formatGeminiError(error));
      }
    }
  }

  throw new Error(formatGeminiError(lastError));
}

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
    let geminiPrompt: string;
    let geminiInlineData: any = undefined;

    if (scannedPages.length === 0) {
      // Normal path — unchanged: the PDF itself goes to Gemini.
      geminiPrompt = BASE_INSTRUCTIONS;
      geminiInlineData = { inlineData: { data: pdfBuffer.toString('base64'), mimeType: 'application/pdf' } };
    } else {
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
      const merged = pageTexts.map(p => {
        if (!isPageScanned(p.text)) return { page: p.page, text: p.text, method: 'pdf_text' as SourceMethod };
        pageMethods[p.page] = 'ocr';
        ocrPagesDone.push(p.page);
        return { page: p.page, text: ocrByPage.get(p.page) || '', method: 'ocr' as SourceMethod };
      });
      useOcr = true;

      geminiPrompt = `
      ${BASE_INSTRUCTIONS}

      The tender text below was assembled page by page. Native PDF text was used where available;
      pages marked [OCR text] were read with OCR because the PDF page contained no extractable text.
      Page markers look like [Page 1 — PDF text] or [Page 3 — OCR text]. Use the marker number for
      page_number. Quote source_text from the provided text only.

      ${merged.map(m => `[Page ${m.page} — ${m.method === 'ocr' ? 'OCR text' : 'PDF text'}]\n${m.text}`).join('\n\n')}
    `;
    }

    let extractedReqs: any[] = [];

    try {
      const result = await generateContentWithRetry(geminiPrompt, geminiInlineData);

      let textResp = result.response.text().trim();
      if (textResp.startsWith('```json')) {
        textResp = textResp.replace(/```json/g, '').replace(/```/g, '').trim();
      }

      extractedReqs = JSON.parse(textResp);
    } catch (err: any) {
      console.error('Gemini extraction failed:', err);
      await supabase.from('tenders').update({ status: 'analysis_failed' }).eq('id', tender.id);
      return NextResponse.json({
        error: 'Gemini AI is temporarily unavailable. Please try again later or check the service status.'
      }, { status: 503 });
    }

    console.log(`Extracted ${extractedReqs.length} requirements (ocr=${useOcr})`);

    // Generate Embeddings and Insert
    const requirementMethods: Record<string, SourceMethod> = {};
    for (const req of extractedReqs) {
      if (!req.requirement || !req.value) continue;

      // Normalize so value and unit never duplicate (e.g. value "25", unit "MPa")
      const normalized = splitValueUnit(req.value, req.unit);
      req.value = normalized.value;
      req.unit = normalized.unit;

      const embedText = `${req.category} | ${req.requirement} | ${req.value} | ${req.source_text}`;
      let embedding = new Array(768).fill(0);

      try {
        const embeddingModel = getGeminiModel(EMBEDDING_MODEL);
        const embedResp = await embeddingModel.embedContent(embedText);
        embedding = embedResp.embedding.values.slice(0, 768);
      } catch (embedErr) {
        console.warn('Embedding failed, using zero vector fallback:', embedErr);
      }

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
