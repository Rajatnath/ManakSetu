import { createClient } from '@supabase/supabase-js';
import Header from '@/components/layout/Header';
import PageBar from '@/components/layout/PageBar';
import ReportActionsClient from './ReportActionsClient';
import ReportContentClient from './ReportContentClient';
import { getStandardMetadata } from '@/data/standardsMetadata';
import { getQcoRecord } from '@/data/qcoRecords';
import { buildCoverage } from '@/lib/coverage/buildCoverage';

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function ReportPage(props: Props) {
  const params = await props.params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { data: tender, error: tenderError } = await supabase
    .from('tenders')
    .select('*')
    .eq('id', params.id)
    .single();

  if (tenderError || !tender) {
    return <div className="p-8 text-center text-red-600 font-bold">Tender not found.</div>;
  }

  // Human review state: persisted recommendation rows for this tender
  const { data: rows } = await supabase
    .from('recommendations')
    .select('*, standards ( standard_number, title, scope_summary, source_url )')
    .eq('tender_id', params.id)
    .order('confidence', { ascending: false });

  const recommendations = (rows || []).map((r: any) => ({
    id: r.standard_id,
    standard_number: r.standards?.standard_number || 'Unknown standard',
    title: r.standards?.title || '',
    scope_summary: r.standards?.scope_summary || null,
    source_url: r.standards?.source_url || null,
    relevance: r.relevance,
    score: typeof r.confidence === 'number' ? r.confidence : Number(r.confidence) || 0,
    review_status: r.review_status,
    reasons: (r.reason || '').split(' | ').filter(Boolean),
    tender_evidence: Array.isArray(r.evidence) ? r.evidence : [],
    matched_requirements: Array.isArray(r.matched_requirements) ? r.matched_requirements : [],
  }));

  // Standards intelligence per included standard (curated records + verified counts)
  const standardIds = [...new Set(recommendations.map(r => r.id))];
  let relCounts: Record<string, number> = {};
  if (standardIds.length > 0) {
    const { data: rels } = await supabase
      .from('standard_relationships')
      .select('source_standard_id, target_standard_id')
      .or(
        `source_standard_id.in.(${standardIds.join(',')}),target_standard_id.in.(${standardIds.join(',')})`
      );
    for (const rel of rels || []) {
      for (const sid of [rel.source_standard_id, rel.target_standard_id]) {
        if (standardIds.includes(sid)) relCounts[sid] = (relCounts[sid] || 0) + 1;
      }
    }
  }
  const intelById: Record<string, any> = {};
  for (const rec of recommendations) {
    const metadata = getStandardMetadata(rec.standard_number);
    const qco = getQcoRecord(rec.standard_number);
    intelById[rec.id] = {
      metadataAvailable: !!metadata,
      lastVerifiedAt: metadata?.lastVerifiedAt || null,
      verifiedRelationships: relCounts[rec.id] || 0,
      qcoFound: !!qco,
      qcoProduct: qco?.product || null,
    };
  }

  // Standards coverage: explicit citations vs ManakSetu-identified candidates
  let coverage = null;
  try {
    coverage = await buildCoverage(supabase, params.id);
  } catch (e) {
    console.warn('Coverage build failed (non-fatal):', (e as Error)?.message);
  }

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      <Header />

      <PageBar titleKey="reportTitle">
        <ReportActionsClient tenderId={params.id} />
      </PageBar>

      <ReportContentClient tenderId={params.id} tenderName={tender.filename} recommendations={recommendations} intelById={intelById} coverage={coverage} />
    </div>
  );
}
