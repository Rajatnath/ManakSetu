import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Returns verified BIS relationships (from standard_relationships) plus
// same-sector corpus neighbours, explicitly labelled as a heuristic.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const standardId = searchParams.get('standardId');

    if (!standardId) {
      return NextResponse.json({ error: 'Missing standardId' }, { status: 400 });
    }

    const { data: standard, error: stdErr } = await supabase
      .from('standards')
      .select('id, standard_number, title, sector')
      .eq('id', standardId)
      .single();

    if (stdErr || !standard) {
      return NextResponse.json({ error: 'Standard not found' }, { status: 404 });
    }

    // Verified relationships in either direction.
    // Rows in this table are verified-by-construction: each was seeded from
    // an authoritative source cited in evidence/source_url.
    const { data: rels } = await supabase
      .from('standard_relationships')
      .select('id, source_standard_id, target_standard_id, relationship_type, evidence, source_url')
      .or(`source_standard_id.eq.${standardId},target_standard_id.eq.${standardId}`);

    const otherIds = [...new Set((rels || []).map((r: any) =>
      r.source_standard_id === standardId ? r.target_standard_id : r.source_standard_id
    ))];

    let others: any[] = [];
    if (otherIds.length > 0) {
      const { data } = await supabase
        .from('standards')
        .select('id, standard_number, title')
        .in('id', otherIds);
      others = data || [];
    }
    const otherById = new Map(others.map((s: any) => [s.id, s]));

    const verified = (rels || [])
      .map((r: any) => {
        const otherId = r.source_standard_id === standardId ? r.target_standard_id : r.source_standard_id;
        const other = otherById.get(otherId) as any;
        if (!other) return null;
        return {
          id: other.id,
          standard_number: other.standard_number,
          title: other.title,
          relationship_type: r.relationship_type || 'related',
          evidence: r.evidence || null,
          source_url: r.source_url || null,
          verified: true,
        };
      })
      .filter(Boolean);

    // Same-sector neighbours: corpus heuristic, NOT a BIS reference
    let sameSector: any[] = [];
    if (standard.sector) {
      const { data } = await supabase
        .from('standards')
        .select('id, standard_number, title')
        .eq('sector', standard.sector)
        .neq('id', standardId)
        .limit(3);
      sameSector = (data || []).map((s: any) => ({
        id: s.id,
        standard_number: s.standard_number,
        title: s.title,
      }));
    }

    return NextResponse.json({ standard, verified, sameSector });
  } catch (err: any) {
    console.error('Relationships API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
