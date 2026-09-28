import { extractPageTexts } from '@/lib/ocr/pdfText';
import { readProvenance } from '@/lib/ocr/provenance';
import { findExplicitIsReferences, ExplicitReference } from './explicitRefs';
import { computeCoverageDiff, CoverageDiff } from './coverageDiff';

export interface CoverageRequirement {
  id: string;
  category: string | null;
  requirement: string | null;
  value: string | null;
  unit: string | null;
  source_text: string | null;
  page_number: number | null;
  method: string | null;
}

export interface CoverageCandidate {
  id: string;
  standard_number: string;
  title: string;
  score: number;
  relevance: string;
  review_status: string;
  reasons: string[];
  reason: string;
  source_url: string | null;
}

export interface CoverageRelationship {
  from_id: string;
  to_id: string;
  from_number: string;
  to_number: string;
  relationship_type: string;
  evidence: string | null;
  source_url: string | null;
}

export interface CoverageData {
  tenderId: string;
  requirements: CoverageRequirement[];
  requirementCount: number;
  explicitReferences: ExplicitReference[];
  textUnavailable: boolean;
  candidates: CoverageCandidate[];
  retrievalPending: boolean;
  relationships: CoverageRelationship[];
  diff: CoverageDiff;
}

// Single source of truth for Standards Coverage, used by both the
// recommendations UI (via /api/coverage) and the report (server import).
// Every fact comes from stored rows, the stored PDF, or the verified
// relationships table — nothing is inferred or invented.
export async function buildCoverage(supabase: any, tenderId: string): Promise<CoverageData> {
  const { data: tender, error: tenderErr } = await supabase
    .from('tenders')
    .select('id, storage_path')
    .eq('id', tenderId)
    .single();
  if (tenderErr || !tender) throw new Error('Tender not found');

  const { data: reqRows } = await supabase
    .from('tender_requirements')
    .select('id, category, requirement, value, unit, source_text, page_number')
    .eq('tender_id', tenderId);

  const provenance = await readProvenance(supabase, tenderId);
  const requirements: CoverageRequirement[] = (reqRows || []).map((r: any) => ({
    id: r.id,
    category: r.category,
    requirement: r.requirement,
    value: r.value,
    unit: r.unit,
    source_text: r.source_text,
    page_number: r.page_number,
    method: (provenance?.requirementMethods?.[r.id] as string) || null,
  }));

  // Full tender text for the explicit-citation scan (real document bytes)
  let explicitReferences: ExplicitReference[] = [];
  let textUnavailable = false;
  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('tenders')
      .download(tender.storage_path);
    if (dlErr || !fileData) throw new Error('download failed');
    const pages = await extractPageTexts(Buffer.from(await fileData.arrayBuffer()));
    explicitReferences = findExplicitIsReferences(pages);
  } catch {
    textUnavailable = true;
  }

  // Persisted candidates (never recomputed here — retrieval stays authoritative)
  const { data: recRows } = await supabase
    .from('recommendations')
    .select('standard_id, relevance, reason, confidence, review_status, standards ( standard_number, title, source_url, sector )')
    .eq('tender_id', tenderId)
    .order('confidence', { ascending: false });

  const candidates: CoverageCandidate[] = (recRows || []).map((r: any) => ({
    id: r.standard_id,
    standard_number: r.standards?.standard_number || 'Unknown standard',
    title: r.standards?.title || '',
    score: typeof r.confidence === 'number' ? r.confidence : Number(r.confidence) || 0,
    relevance: r.relevance,
    review_status: r.review_status,
    reasons: (r.reason || '').split(' | ').filter(Boolean),
    reason: r.reason || '',
    source_url: r.standards?.source_url || null,
  }));

  // Verified relationships touching the candidate set (verified-by-construction table)
  let relationships: CoverageRelationship[] = [];
  const candidateIds = candidates.map(c => c.id);
  if (candidateIds.length > 0) {
    const numberById = new Map(candidates.map(c => [c.id, c.standard_number]));
    // Also resolve cited/outside endpoints for complete display
    const { data: rels } = await supabase
      .from('standard_relationships')
      .select('source_standard_id, target_standard_id, relationship_type, evidence, source_url')
      .or(
        `source_standard_id.in.(${candidateIds.join(',')}),target_standard_id.in.(${candidateIds.join(',')})`
      );
    const outsideIds = [...new Set(
      (rels || []).flatMap((r: any) => [r.source_standard_id, r.target_standard_id])
        .filter((id: string) => !numberById.has(id))
    )];
    if (outsideIds.length > 0) {
      const { data: outsiders } = await supabase
        .from('standards')
        .select('id, standard_number')
        .in('id', outsideIds);
      for (const o of outsiders || []) numberById.set(o.id, o.standard_number);
    }
    relationships = (rels || []).map((r: any) => ({
      from_id: r.source_standard_id,
      to_id: r.target_standard_id,
      from_number: numberById.get(r.source_standard_id) || 'Unknown standard',
      to_number: numberById.get(r.target_standard_id) || 'Unknown standard',
      relationship_type: r.relationship_type || 'related',
      evidence: r.evidence || null,
      source_url: r.source_url || null,
    }));
  }

  const diff = computeCoverageDiff(
    explicitReferences.map(e => e.core),
    candidates
  );

  return {
    tenderId,
    requirements,
    requirementCount: requirements.length,
    explicitReferences,
    textUnavailable,
    candidates,
    retrievalPending: candidates.length === 0,
    relationships,
    diff,
  };
}
