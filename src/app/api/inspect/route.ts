import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractPageTexts, isPageScanned, usableChars } from '@/lib/ocr/pdfText';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Fast document inspection: page count + which pages lack usable native text.
// No LLM call. Lets the UI branch honestly between the normal pipeline and
// the OCR fallback before the expensive analysis starts.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenderId = searchParams.get('tenderId');
    if (!tenderId) return NextResponse.json({ error: 'Missing tenderId' }, { status: 400 });

    const { data: tender, error: fetchErr } = await supabase
      .from('tenders')
      .select('storage_path, filename')
      .eq('id', tenderId)
      .single();
    if (fetchErr || !tender) return NextResponse.json({ error: 'Tender not found' }, { status: 404 });

    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('tenders')
      .download(tender.storage_path);
    if (downloadErr || !fileData) {
      return NextResponse.json({ error: `Download failed: ${downloadErr?.message}` }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    let pages: { page: number; chars: number; scanned: boolean }[] = [];
    try {
      const pageTexts = await extractPageTexts(buffer);
      pages = pageTexts.map(p => ({ page: p.page, chars: usableChars(p.text), scanned: isPageScanned(p.text) }));
    } catch (e: any) {
      return NextResponse.json({ error: `PDF inspection failed: ${e.message}` }, { status: 500 });
    }

    const scannedPages = pages.filter(p => p.scanned).map(p => p.page);
    if (pages.length > 0) {
      await supabase.from('tenders').update({ page_count: pages.length }).eq('id', tenderId);
    }

    return NextResponse.json({
      tenderId,
      filename: tender.filename,
      pageCount: pages.length,
      scannedPages,
      ocrAvailable: !!MISTRAL_API_KEY,
    });
  } catch (err: any) {
    console.error('Inspect Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
