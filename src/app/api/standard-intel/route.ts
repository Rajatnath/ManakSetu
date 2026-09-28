import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStandardMetadata } from '@/data/standardsMetadata';
import { getQcoRecord } from '@/data/qcoRecords';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Combined standards intelligence for one standard, by IS number:
// curated metadata record (or null), QCO record (or null), and the count of
// verified BIS relationships. Absent data resolves to explicit unavailable
// states in the UI — never fabricated.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const standardNumber = (searchParams.get('standardNumber') || '').trim();

    if (!standardNumber) {
      return NextResponse.json({ error: 'Missing standardNumber' }, { status: 400 });
    }

    const metadata = getStandardMetadata(standardNumber);
    const qco = getQcoRecord(standardNumber);

    let verifiedRelationshipCount = 0;
    const { data: standard } = await supabase
      .from('standards')
      .select('id')
      .eq('standard_number', standardNumber)
      .maybeSingle();
    if (standard) {
      const { count } = await supabase
        .from('standard_relationships')
        .select('id', { count: 'exact', head: true })
        .or(`source_standard_id.eq.${standard.id},target_standard_id.eq.${standard.id}`);
      verifiedRelationshipCount = count || 0;
    }

    return NextResponse.json({ standardNumber, metadata, qco, verifiedRelationshipCount });
  } catch (err: any) {
    console.error('Standard Intel API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
