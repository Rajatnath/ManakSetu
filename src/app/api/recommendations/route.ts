import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readProvenance } from '@/lib/ocr/provenance';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SIMILARITY_THRESHOLD = 0.65;
const TOP_K = 5;

export const REVIEW_STATUSES = ['pending', 'included', 'needs_verification'] as const;

function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function relevanceFor(score: number) {
  if (score > 0.8) return 'High';
  if (score > 0.70) return 'Medium';
  return 'Low';
}

export async function POST(request: Request) {
  try {
    const { tenderId } = await request.json();

    if (!tenderId) return NextResponse.json({ error: 'Missing tenderId' }, { status: 400 });

    // 1. Fetch requirements for this tender
    const { data: reqs, error: reqErr } = await supabase
      .from('tender_requirements')
      .select('*')
      .eq('tender_id', tenderId);

    if (reqErr || !reqs || reqs.length === 0) throw new Error('No requirements found. Did extraction finish?');

    // 2. Fetch all standards (curated demo corpus)
    const { data: standards, error: stdErr } = await supabase
      .from('standards')
      .select('id, standard_number, title, embedding, scope_summary, requirement_cues, source_url, sector');

    if (stdErr || !standards) throw new Error('Failed to fetch standards');

    let recommendationsMap = new Map();

    // Requirement provenance (native PDF text vs OCR), if recorded
    const provenance = await readProvenance(supabase, tenderId);
    const methodFor = (reqId: string): string | null =>
      (provenance?.requirementMethods?.[reqId] as string) || null;

    // Match each requirement against all standards
    reqs.forEach((req: any) => {
      // req.embedding might be a JSON array or string, parse it.
      const reqVec = typeof req.embedding === 'string' ? JSON.parse(req.embedding) : req.embedding;
      if (!reqVec || reqVec.length === 0) return;

      standards.forEach((std: any) => {
        const stdVec = typeof std.embedding === 'string' ? JSON.parse(std.embedding) : std.embedding;
        if (!stdVec || stdVec.length === 0) return;

        const sim = cosineSimilarity(reqVec, stdVec);

        if (sim > SIMILARITY_THRESHOLD) {
          const match = { req: req.requirement, val: req.value, unit: req.unit, sim, source: req.source_text, page: req.page_number, method: methodFor(req.id) };
          if (!recommendationsMap.has(std.id)) {
            recommendationsMap.set(std.id, {
              ...std,
              maxSimilarity: sim,
              matchedReqs: [match]
            });
          } else {
            const current = recommendationsMap.get(std.id);
            if (sim > current.maxSimilarity) current.maxSimilarity = sim;
            current.matchedReqs.push(match);
          }
        }
      });
    });

    // Sort by max similarity
    let finalRecs = Array.from(recommendationsMap.values()).sort((a, b) => b.maxSimilarity - a.maxSimilarity).slice(0, TOP_K);

    // 3. Preserve existing human review decisions for this tender
    const { data: existing } = await supabase
      .from('recommendations')
      .select('standard_id, review_status, reviewer_note')
      .eq('tender_id', tenderId);
    const priorStatus = new Map((existing || []).map((r: any) => [r.standard_id, r]));

    // Replace the candidate set for this tender (fresh scores), keeping prior decisions
    await supabase.from('recommendations').delete().eq('tender_id', tenderId);

    const rows = finalRecs.map(r => {
      const prior = priorStatus.get(r.id) as any;
      const reasons = r.matchedReqs.map((m: any) => `Requirement Match: ${m.req} = ${m.val || '—'}`);
      const tender_evidence = [...new Set(r.matchedReqs.map((m: any) => `Tender Source: "${m.source || 'statement on file'}"`))];
      return {
        tender_id: tenderId,
        standard_id: r.id,
        relevance: relevanceFor(r.maxSimilarity),
        reason: reasons.join(' | '),
        matched_requirements: r.matchedReqs,
        evidence: tender_evidence,
        confidence: r.maxSimilarity,
        review_status: prior?.review_status || 'pending',
        reviewer_note: prior?.reviewer_note || null,
      };
    });

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from('recommendations').insert(rows);
      if (insertErr) throw new Error(`Failed to save recommendations: ${insertErr.message}`);
    }

    // 4. Format for Frontend — one canonical score (raw cosine similarity)
    const results = finalRecs.map(r => {
      const prior = priorStatus.get(r.id) as any;
      return {
        id: r.id,
        standard_number: r.standard_number,
        title: r.title,
        scope_summary: r.scope_summary,
        source_url: r.source_url,
        sector: r.sector,
        relevance: relevanceFor(r.maxSimilarity),
        score: r.maxSimilarity,
        review_status: prior?.review_status || 'pending',
        reasons: r.matchedReqs.map((m: any) => `Requirement Match: ${m.req} = ${m.val || '—'}`),
        matches: r.matchedReqs.map((m: any) => ({
          req: m.req, val: m.val, unit: m.unit, source: m.source, page: m.page ?? null, method: m.method || null,
        })),
        tender_evidence: [...new Set(r.matchedReqs.map((m: any) => `Tender Source: "${m.source || 'statement on file'}"`))],
        ai_note: `Candidate identified by semantic similarity ${r.maxSimilarity.toFixed(2)}. Scope: ${r.scope_summary}`
      };
    });

    return NextResponse.json({ recommendations: results, requirementCount: reqs.length });

  } catch (err: any) {
    console.error('Recommendations API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenderId, standardId, reviewStatus } = await request.json();

    if (!tenderId || !standardId) {
      return NextResponse.json({ error: 'Missing tenderId or standardId' }, { status: 400 });
    }
    if (!REVIEW_STATUSES.includes(reviewStatus)) {
      return NextResponse.json({ error: 'Invalid review status' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('recommendations')
      .update({ review_status: reviewStatus })
      .eq('tender_id', tenderId)
      .eq('standard_id', standardId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Review PATCH Error:', { tenderId, standardId, message: error.message });
      throw new Error(`Review update failed: ${error.message}`);
    }
    if (!data) {
      return NextResponse.json(
        { error: 'Recommendation not found. The list may have been refreshed — please try again.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ recommendation: data });
  } catch (err: any) {
    console.error('Review PATCH Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
