import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Streams the original uploaded tender PDF so reviewers can verify evidence
// against the source document.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenderId = searchParams.get('tenderId');

    if (!tenderId) {
      return NextResponse.json({ error: 'Missing tenderId' }, { status: 400 });
    }

    const { data: tender, error: fetchErr } = await supabase
      .from('tenders')
      .select('storage_path, filename')
      .eq('id', tenderId)
      .single();

    if (fetchErr || !tender) {
      return NextResponse.json({ error: 'Tender not found' }, { status: 404 });
    }

    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('tenders')
      .download(tender.storage_path);

    if (downloadErr || !fileData) {
      return NextResponse.json({ error: 'Source file unavailable' }, { status: 404 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${(tender.filename || 'tender.pdf').replace(/"/g, '')}"`,
      },
    });
  } catch (err: any) {
    console.error('Tender File Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
