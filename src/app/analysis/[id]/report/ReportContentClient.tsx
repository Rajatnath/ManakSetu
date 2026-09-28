'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import SimilarityMeter from '@/components/standards/SimilarityMeter';

interface MatchedRequirement {
  req?: string;
  val?: string | null;
  sim?: number;
  source?: string | null;
  page?: number | null;
  method?: string | null;
}

interface ReportRecommendation {
  id: string;
  standard_number: string;
  title: string;
  scope_summary: string | null;
  source_url: string | null;
  relevance: string;
  score: number;
  review_status: 'pending' | 'included' | 'needs_verification';
  reasons: string[];
  tender_evidence: string[];
  matched_requirements: MatchedRequirement[];
}

export interface ReportIntel {
  metadataAvailable: boolean;
  lastVerifiedAt: string | null;
  verifiedRelationships: number;
  qcoFound: boolean;
  qcoProduct: string | null;
}

// Locale-independent date formatting (SSR/client identical — no hydration risk)
function formatIsoDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 600);
      setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}</>;
}

function statusPill(status: ReportRecommendation['review_status']) {
  if (status === 'included')
    return <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Included in Report</span>;
  if (status === 'needs_verification')
    return <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200">Needs Verification</span>;
  return <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">Pending Review</span>;
}

function verificationLabel(status: ReportRecommendation['review_status']) {
  if (status === 'included') return 'Included in report by human reviewer — BIS verification still required';
  if (status === 'needs_verification') return 'Flagged as needs verification — do not use before BIS verification';
  return 'Awaiting human review — BIS verification required';
}

function evidencePages(rec: ReportRecommendation): number[] {
  const pages = new Set<number>();
  for (const m of rec.matched_requirements || []) {
    if (typeof m?.page === 'number') pages.add(m.page);
  }
  return [...pages].sort((a, b) => a - b);
}

function matrixRequirement(rec: ReportRecommendation): string {
  if (rec.reasons.length === 0) return '—';
  if (rec.reasons.length === 1) return rec.reasons[0];
  return `${rec.reasons[0]} (+${rec.reasons.length - 1} more)`;
}

export default function ReportContentClient({
  tenderId,
  tenderName,
  recommendations,
  intelById,
}: {
  tenderId: string;
  tenderName: string;
  recommendations: ReportRecommendation[];
  intelById: Record<string, ReportIntel>;
}) {
  void tenderId;

  const totalCandidates = recommendations.length;
  const included = recommendations.filter(r => r.review_status === 'included');
  const needsVerification = recommendations.filter(r => r.review_status === 'needs_verification');
  const pending = recommendations.filter(r => r.review_status === 'pending');

  // Locale date formatting differs between Node (SSR) and the browser, so the
  // date is filled in after mount. First render is identical on both sides.
  const [generatedOn, setGeneratedOn] = useState('');
  useEffect(() => {
    setGeneratedOn(new Date().toLocaleDateString());
  }, []);

  const kpis = [
    { label: 'Candidates Retrieved', value: totalCandidates, tone: 'navy' },
    { label: 'Included in Report', value: included.length, tone: 'green' },
    { label: 'Pending Human Review', value: pending.length, tone: 'slate' },
    { label: 'Needs Verification', value: needsVerification.length, tone: 'amber' },
  ] as const;

  const kpiTone: Record<string, string> = {
    navy: 'text-[#12355B]',
    green: 'text-emerald-700',
    slate: 'text-slate-600',
    amber: 'text-amber-700',
  };

  return (
    <main className="flex-grow px-4 md:px-8 py-6 md:py-8 w-full max-w-[1040px] mx-auto">
      <div className="report-doc bg-white border border-slate-200 shadow-sm">
        {/* Report header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-200">
          <p className="text-xs font-bold tracking-[0.18em] text-[#1A5FB4] mb-1">STANDARDS APPLICABILITY REPORT</p>
          <h1 className="text-2xl md:text-3xl font-bold text-[#12355B] tracking-tight">ManakSetu</h1>
          <p className="text-sm text-slate-600 mt-0.5">Indian Standards Intelligence for Procurement</p>

          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 mt-5 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tender</dt>
              <dd className="text-slate-800 font-medium break-words">{tenderName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Generated</dt>
              <dd className="text-slate-800 font-medium">{generatedOn}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prototype</dt>
              <dd className="text-slate-800 font-medium">SIH26108</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report Type</dt>
              <dd className="text-slate-800">Standards Applicability Assessment</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</dt>
              <dd className="text-slate-800">Tender / RFP</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</dt>
              <dd className="text-slate-800">Human review required</dd>
            </div>
          </dl>

          <p className="text-xs text-slate-500 mt-4">
            SIH26108 Prototype — decision-support output, not a compliance determination.
          </p>
        </div>

        {/* 1. Summary */}
        <section className="px-8 py-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-[#12355B] mb-4">1. Summary</h2>
          {totalCandidates === 0 ? (
            <div className="p-4 border border-slate-200 bg-slate-50 text-slate-600 rounded-md text-sm">
              No candidate standards have been retrieved for this tender yet. Run retrieval from the recommendations page first.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpis.map(k => (
                <div key={k.label} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-center">
                  <div className={`text-3xl font-bold ${kpiTone[k.tone]}`}><AnimatedNumber value={k.value} /></div>
                  <div className="text-xs font-medium text-slate-600 mt-1">{k.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 mt-4 flex items-start gap-2">
            <AlertTriangle className="text-amber-700 mt-0.5 shrink-0" size={18} />
            <p className="text-sm text-slate-700 leading-6">
              This report contains potentially applicable Indian Standards based on the technical requirements extracted from the tender document.
              <span className="font-semibold text-slate-900"> Human verification required: verify current BIS status and legal applicability before final procurement use.</span>
            </p>
          </div>
        </section>

        {/* 2. Review status matrix */}
        {totalCandidates > 0 && (
          <section className="px-8 py-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-[#12355B] mb-4">2. Review Status</h2>
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-3 py-2 border-b border-slate-200">Standard</th>
                    <th className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-3 py-2 border-b border-slate-200">Matched Requirement</th>
                    <th className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-3 py-2 border-b border-slate-200">Similarity</th>
                    <th className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-3 py-2 border-b border-slate-200">Assessment</th>
                    <th className="text-xs font-semibold uppercase tracking-wide text-slate-500 px-3 py-2 border-b border-slate-200">Review Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map(rec => (
                    <tr key={rec.id} className="border-b border-slate-100 last:border-0 avoid-break">
                      <td className="px-3 py-2 font-bold text-[#12355B] whitespace-nowrap">{rec.standard_number}</td>
                      <td className="px-3 py-2 text-slate-700">{matrixRequirement(rec)}</td>
                      <td className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">{rec.score.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">Potentially applicable</td>
                      <td className="px-3 py-2">{statusPill(rec.review_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 3. Detailed included sections */}
        <section className="px-8 py-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-[#12355B] mb-4">3. Standards Included in Report</h2>

          {included.length === 0 ? (
            <div className="p-4 border border-slate-200 bg-slate-50 text-slate-600 rounded-md text-sm">
              {totalCandidates === 0
                ? 'No candidate standards were matched for this tender yet.'
                : 'The reviewer has not included any standard yet. Mark candidates via “Include in Report” on the recommendations page.'}
            </div>
          ) : (
            included.map((rec, index) => {
              const pages = evidencePages(rec);
              return (
                <article key={rec.id} className={`avoid-break ${index < included.length - 1 ? 'pb-6 mb-6 border-b border-slate-200' : ''}`}>
                  <h3 className="text-2xl font-extrabold text-[#12355B] tracking-tight">{rec.standard_number}</h3>
                  <p className="text-base font-medium text-slate-700 mt-0.5 mb-3">{rec.title}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#1A5FB4] mb-1">Matched Requirement</p>
                      <ul className="space-y-1 text-sm text-slate-700">
                        {(rec.reasons || []).map((reason: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="text-emerald-600 mt-0.5 shrink-0" size={16} />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#1A5FB4] mb-1">Retrieval</p>
                      <SimilarityMeter value={rec.score} />
                      <p className="text-xs text-slate-600 mt-1">{rec.relevance} relevance</p>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#1A5FB4] mt-3 mb-1">Assessment</p>
                      <p className="text-sm text-slate-700">Potentially applicable</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-slate-300 bg-slate-50/60 pl-4 pr-3 py-3 mb-3 avoid-break">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#1A5FB4] mb-1">Tender Evidence</p>
                    {pages.length > 0 && (
                      <p className="text-xs text-slate-500 mb-1">Source: Page{pages.length === 1 ? '' : 's'} {pages.join(', ')}</p>
                    )}
                    <div className="text-sm text-slate-700 leading-6 space-y-1">
                      {Array.isArray(rec.tender_evidence) && rec.tender_evidence.length > 0
                        ? rec.tender_evidence.map((ev: string, i: number) => <p key={i}>{ev}</p>)
                        : <p>No tender evidence recorded.</p>}
                    </div>
                  </div>

                  {rec.scope_summary && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#1A5FB4] mb-1">Scope Alignment</p>
                      <p className="text-sm text-slate-700 leading-6">{rec.scope_summary}</p>
                    </div>
                  )}

                  {(() => {
                    const intel = intelById[rec.id];
                    if (!intel) return null;
                    const verifiedDate = formatIsoDate(intel.lastVerifiedAt);
                    return (
                      <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 text-sm">
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-[#1A5FB4] mb-1">BIS Metadata</dt>
                          <dd className="text-slate-700">
                            {intel.metadataAvailable
                              ? `Record available${verifiedDate ? ` • Last verified ${verifiedDate}` : ''}`
                              : 'Metadata verification unavailable'}
                          </dd>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-[#1A5FB4] mb-1">Relationships</dt>
                          <dd className="text-slate-700">
                            {intel.verifiedRelationships > 0
                              ? `${intel.verifiedRelationships} verified reference${intel.verifiedRelationships === 1 ? '' : 's'}`
                              : 'No verified references recorded'}
                          </dd>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-[#1A5FB4] mb-1">QCO</dt>
                          <dd className="text-slate-700">
                            {intel.qcoFound
                              ? `QCO record found${intel.qcoProduct ? ` — ${intel.qcoProduct}` : ''}`
                              : 'No verified QCO record in prototype dataset'}
                          </dd>
                        </div>
                      </dl>
                    );
                  })()}

                  <p className="text-xs text-slate-600 border-t border-slate-100 pt-2">
                    <span className="font-semibold uppercase tracking-wide">Verification Status: </span>
                    {verificationLabel(rec.review_status)}
                  </p>
                </article>
              );
            })
          )}
        </section>

        {/* 4. Pending list */}
        {pending.length > 0 && (
          <section className="px-8 py-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-[#12355B] mb-4">4. Standards Pending Human Review</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pending.map(rec => (
                <li key={rec.id} className="border border-slate-200 rounded-md p-3 bg-white avoid-break">
                  <p className="font-bold text-[#12355B]">{rec.standard_number}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{rec.title}</p>
                  <p className="text-xs text-slate-500 mt-1">Similarity {rec.score.toFixed(2)} • Pending Review</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 5. Needs verification */}
        {needsVerification.length > 0 && (
          <section className="px-8 py-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-[#12355B] mb-4">
              {pending.length > 0 ? '5' : '4'}. Standards Requiring Verification
            </h2>
            <ul className="space-y-2">
              {needsVerification.map(rec => (
                <li key={rec.id} className="p-3 border border-amber-200 bg-amber-50 rounded-md avoid-break">
                  <p className="font-bold text-[#12355B] text-sm">{rec.standard_number}</p>
                  <p className="text-sm text-slate-700">{rec.title}</p>
                  <p className="text-xs text-slate-600 mt-1">Semantic similarity: {rec.score.toFixed(2)} — flagged by reviewer, do not use before BIS verification.</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Report footer */}
        <div className="px-8 py-4 text-center">
          <p className="text-xs text-slate-500">ManakSetu • SIH26108 Prototype</p>
          <p className="text-xs text-slate-400">Decision-support output — not a compliance determination</p>
        </div>
      </div>
    </main>
  );
}
