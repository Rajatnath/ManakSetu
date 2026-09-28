'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, ExternalLink, Network, FileSearch, Loader2, BookOpen, Gauge } from 'lucide-react';
import Link from 'next/link';
import RelationshipGraph from '@/components/graph/RelationshipGraph';
import SimilarityMeter from '@/components/standards/SimilarityMeter';
import CoveragePanel from '@/components/coverage/CoveragePanel';
import { useAccessibility } from '@/components/layout/AccessibilityProvider';

interface Recommendation {
  id: string;
  standard_number: string;
  title: string;
  scope_summary: string | null;
  source_url: string | null;
  sector: string | null;
  relevance: string;
  score: number;
  review_status: 'pending' | 'included' | 'needs_verification';
  reasons: string[];
  matches: { req: string; val: string | null; unit: string | null; source: string | null; page: number | null; method: string | null }[];
  tender_evidence: string[];
  ai_note: string;
}

export default function RecommendationsClient({ tenderId }: { tenderId: string }) {
  const { t } = useAccessibility();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [requirementCount, setRequirementCount] = useState<number | null>(null);
  const [selectedRec, setSelectedRec] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecs() {
      try {
        const res = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenderId })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to fetch recommendations');

        setRecommendations(data.recommendations);
        setRequirementCount(typeof data.requirementCount === 'number' ? data.requirementCount : null);
        if (data.recommendations.length > 0) {
          setSelectedRec(data.recommendations[0].id);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchRecs();
  }, [tenderId]);

  const patchStatus = async (recId: string, status: Recommendation['review_status']) => {
    const res = await fetch('/api/recommendations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenderId, standardId: recId, reviewStatus: status })
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Review update failed') as Error & { code?: string };
      err.code = data.code;
      throw err;
    }
    return data;
  };

  const refreshRecs = async () => {
    const res = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenderId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to refresh recommendations');
    setRecommendations(data.recommendations);
    if (data.recommendations.length > 0 && !data.recommendations.some((r: Recommendation) => r.id === selectedRec)) {
      setSelectedRec(data.recommendations[0].id);
    }
    return data.recommendations as Recommendation[];
  };

  const setReviewStatus = async (rec: Recommendation, status: Recommendation['review_status']) => {
    // Toggle back to pending when clicking the active state
    const next = rec.review_status === status ? 'pending' : status;
    setUpdatingId(rec.id);
    setError('');
    try {
      await patchStatus(rec.id, next);
      setRecommendations(prev => prev.map(r => (r.id === rec.id ? { ...r, review_status: next } : r)));
    } catch (err: any) {
      // The stored rows may have been rebuilt between list-load and click.
      // Refresh once and retry against the fresh list before giving up.
      try {
        const fresh = await refreshRecs();
        if (!fresh.some((r: Recommendation) => r.id === rec.id)) throw err;
        await patchStatus(rec.id, next);
        setRecommendations(prev => prev.map(r => (r.id === rec.id ? { ...r, review_status: next } : r)));
      } catch (retryErr: any) {
        setError(retryErr.message || err.message);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const activeRec = recommendations.find(r => r.id === selectedRec);
  const includedCount = recommendations.filter(r => r.review_status === 'included').length;

  // Standards intelligence (metadata + QCO + verified-relationship count).
  // NOTE: hooks must stay above the early returns below (Rules of Hooks).
  const [intel, setIntel] = useState<{ metadata: any | null; qco: any | null; verifiedRelationshipCount: number } | null>(null);
  useEffect(() => {
    if (!activeRec) {
      setIntel(null);
      return;
    }
    let cancelled = false;
    setIntel(null);
    fetch(`/api/standard-intel?standardNumber=${encodeURIComponent(activeRec.standard_number)}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d && !d.error) setIntel(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeRec]);

  if (loading) {
    return <div className="flex flex-col items-center justify-center h-64 text-secondary"><Loader2 className="animate-spin w-8 h-8 mb-4" /><p>Finding relevant standards...</p></div>;
  }

  if (error) {
    return <div className="text-danger p-4 border border-danger/20 bg-danger/5 rounded-lg flex items-center gap-2"><ShieldAlert /> {error}</div>;
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-text-secondary text-center p-8 bg-surface rounded-lg border border-border-primary">
        <p className="font-medium text-text-primary mb-1">No candidate standards above the similarity threshold.</p>
        <p className="text-sm">
          {requirementCount !== null ? `${requirementCount} ${t('reqsAnalyzed')}, but ` : ''}none matched the corpus strongly enough.
          Check the extracted requirements for missing units or values, then run retrieval again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Left panel - List of Recommendations */}
      <div className={`w-full ${selectedRec ? 'hidden md:flex md:w-1/3' : 'flex md:w-full'} flex-col gap-4 overflow-y-auto`}>
        <div className="bg-surface border border-border-primary rounded-lg p-4 flex-shrink-0">
          <p className="text-xs font-bold uppercase text-secondary tracking-wide mb-1">Recommended Standards</p>
          <p className="text-sm text-text-primary font-medium">
            {requirementCount !== null ? `${requirementCount} ${t('reqsAnalyzed')} • ` : ''}{recommendations.length} {t('candidatesIdentified')}
          </p>
          <p className="text-xs text-success font-medium mt-1 flex items-center gap-1">
            <CheckCircle size={12} /> {t('retrievalComplete')}
          </p>
          <p className="text-xs text-text-secondary mt-1">{t('recHeaderNote')}</p>
        </div>

        <div className="bg-warning/10 border-l-4 border-warning p-4 rounded-r flex gap-3 text-sm text-text-primary mb-2 flex-shrink-0">
          <ShieldAlert className="text-warning flex-shrink-0" />
          <p>
            <strong>Disclaimer:</strong> AI recommendations — requires technical/BIS verification. Ensure current BIS status before final procurement use.
          </p>
        </div>

        <CoveragePanel tenderId={tenderId} onInspect={(id) => setSelectedRec(id)} />

        {includedCount > 0 && (
          <p className="text-sm text-text-secondary flex-shrink-0">{includedCount} of {recommendations.length} marked for inclusion in report.</p>
        )}

        {recommendations.map((rec, i) => (
          <div
            key={rec.id}
            className={`animate-enter flex-shrink-0 border rounded-lg p-5 pl-4 cursor-pointer transition-all ${
              selectedRec === rec.id
                ? 'border-secondary border-l-4 border-l-secondary bg-secondary/5 shadow-sm'
                : 'border-border-primary bg-surface hover:border-secondary/60'
            }`}
            style={{ animationDelay: `${Math.min(i * 60, 300)}ms` }}
            onClick={() => setSelectedRec(rec.id)}
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-bold text-text-secondary">#{i + 1}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                rec.relevance === 'High' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              }`}>
                {rec.relevance} Relevance
              </span>
            </div>

            <h3 className="font-bold text-lg text-primary leading-snug">{rec.standard_number}</h3>
            <p className="text-text-secondary text-sm mb-3 line-clamp-2">{rec.title}</p>

            <div className="mb-3">
              <SimilarityMeter value={rec.score} />
            </div>

            <ul className="text-sm space-y-1 mb-4">
              {rec.reasons.map((reason: string, idx: number) => (
                <li key={idx} className="flex gap-2 items-center text-text-primary">
                  <CheckCircle size={14} className="text-success flex-shrink-0" />
                  <span className="truncate">{reason}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <button
                className="text-secondary text-sm font-medium flex items-center gap-1 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRec(rec.id);
                }}
              >
                <FileSearch size={16} /> {t('viewEvidence')}
              </button>
              {rec.review_status === 'included' && (
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-success/10 text-success">{t('includedInReport')}</span>
              )}
              {rec.review_status === 'needs_verification' && (
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-warning/10 text-warning">{t('needsVerification')}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Right panel - Evidence + Relationships */}
      {selectedRec && activeRec && (
        <div className="w-full md:w-2/3 bg-surface border border-border-primary rounded-lg flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-border-primary flex justify-between items-center bg-gray-50 flex-shrink-0">
            <h2 className="font-bold text-primary">{activeRec.standard_number} <span className="text-text-secondary font-normal block sm:inline ml-0 sm:ml-2 text-sm">{activeRec.title}</span></h2>
            <button
              className="text-text-secondary hover:text-text-primary text-sm font-medium underline block md:hidden"
              onClick={() => setSelectedRec(null)}
            >
              {t('closePanel')}
            </button>
          </div>

          <div className="p-6 flex-grow overflow-y-auto flex flex-col gap-6">
            <div className="border border-border-primary rounded-lg p-4 bg-surface shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase text-primary tracking-wide">{t('standardStatus')}</h3>
                {intel ? (
                  intel.metadata ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-success/10 text-success">{t('verified')}</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-text-secondary/10 text-text-secondary">{t('unavailable')}</span>
                  )
                ) : null}
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text-secondary">{t('rowStandard')}</dt>
                  <dd className="font-bold text-text-primary">{activeRec.standard_number}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">{t('rowMetadata')}</dt>
                  <dd className="text-text-primary">{intel ? (intel.metadata ? t('available') : t('unavailable')) : t('loadingDots')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">{t('rowRevision')}</dt>
                  <dd className="text-text-primary">
                    {intel?.metadata
                      ? [intel.metadata.revision, intel.metadata.editionYear ? `(${intel.metadata.editionYear})` : null].filter(Boolean).join(' ') +
                        (intel.metadata.reaffirmedYear ? ` • Reaffirmed ${intel.metadata.reaffirmedYear}` : '')
                      : intel ? 'Metadata verification unavailable' : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">{t('rowAmendments')}</dt>
                  <dd className="text-text-primary">
                    {intel?.metadata
                      ? intel.metadata.amendmentCount !== null
                        ? `${intel.metadata.amendmentCount} recorded — manual verification required`
                        : 'Amendment information available — manual verification required'
                      : intel ? 'Metadata verification unavailable' : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">{t('rowLastVerified')}</dt>
                  <dd className="text-text-primary">{intel?.metadata?.lastVerifiedAt || (intel ? '—' : '—')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">{t('rowSource')}</dt>
                  <dd className="text-text-primary">
                    {intel?.metadata ? (
                      <>BIS <span className="text-text-secondary">({intel.metadata.sourceType})</span> —{' '}
                        <a href={intel.metadata.sourceUrl} target="_blank" rel="noreferrer" className="text-secondary hover:underline font-medium">
                          {t('viewBisRecord')}
                        </a>
                      </>
                    ) : (
                      t('bisUnavail')
                    )}
                  </dd>
                </div>
              </dl>
              {intel?.metadata?.amendmentNote && (
                <p className="text-xs text-text-secondary mt-2">{intel.metadata.amendmentNote}</p>
              )}
            </div>

            <div className="border border-border-primary rounded-lg p-4 bg-surface shadow-sm">
              <h3 className="text-sm font-bold uppercase text-primary tracking-wide mb-1">{t('whyStandard')}</h3>
              <div className="text-sm text-text-primary divide-y divide-border-primary">
                <div className="flex gap-3 py-3">
                  <CheckCircle size={16} className="text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">{t('requirementMatch')}</p>
                    <ul className="space-y-1">
                      {activeRec.reasons.map((reason: string, i: number) => (
                        <li key={i} className="text-text-primary">{reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex gap-3 py-3">
                  <FileSearch size={16} className="text-secondary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">{t('tenderEvidence')}</p>
                    {activeRec.matches && activeRec.matches.length > 0 ? (
                      <ul className="space-y-1 text-text-secondary">
                        {[...new Map(activeRec.matches.map(m => [
                          `${m.source}|${m.page}|${m.method}`,
                          m,
                        ])).values()].map((m: any, i: number) => (
                          <li key={i}>
                            Tender Source{m.page ? `: Page ${m.page}` : ''}{m.method === 'ocr' ? ' • OCR extracted' : m.method === 'pdf_text' ? ' • PDF text' : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-text-secondary">Relevant tender statement found (see Tender Evidence below).</p>
                    )}
                  </div>
                </div>
                {activeRec.scope_summary && (
                  <div className="flex gap-3 py-3">
                    <BookOpen size={16} className="text-secondary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">{t('scopeAlignment')}</p>
                      <p className="text-text-secondary">{activeRec.scope_summary}</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 py-3">
                  <Gauge size={16} className="text-secondary flex-shrink-0 mt-0.5" />
                  <div className="flex-grow">
                    <p className="font-semibold mb-1">{t('retrieval')}</p>
                    <SimilarityMeter value={activeRec.score} />
                    <p className="text-text-secondary text-xs mt-1">{activeRec.relevance} relevance</p>
                  </div>
                </div>
                {intel && (
                  <>
                    <div className="flex gap-3 py-3">
                      <BookOpen size={16} className="text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">{t('bisMetadata')}</p>
                        <p className="text-text-secondary">
                          {intel.metadata ? 'Metadata record available' : 'Metadata verification unavailable'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 py-3">
                      <Network size={16} className="text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">{t('relationships')}</p>
                        <p className="text-text-secondary">
                          {intel.verifiedRelationshipCount > 0
                            ? `${intel.verifiedRelationshipCount} verified BIS relationship${intel.verifiedRelationshipCount === 1 ? '' : 's'} (see graph below)`
                            : 'No verified BIS relationships recorded'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 py-3">
                      <ShieldAlert size={16} className="text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold mb-1">{t('qcoConformity')}</p>
                        {intel.qco ? (
                          <div className="text-text-secondary space-y-0.5">
                            <p><span className="font-medium text-text-primary">{t('qcoRecord')}: {t('foundState')}</span> — {intel.qco.qcoTitle}</p>
                            <p>{t('qcoProduct')}: {intel.qco.product}</p>
                            <p>{t('qcoAuthority')}: {intel.qco.authority}</p>
                            <p>
                              {t('enforcementDate')}: {intel.qco.enforcementDate || 'not stated'} • {t('statusLabel')}: {t('requiresVerification')}{' '}
                              <a href={intel.qco.sourceUrl} target="_blank" rel="noreferrer" className="text-secondary hover:underline font-medium">
                                {t('viewQco')}
                              </a>
                            </p>
                          </div>
                        ) : (
                          <div className="text-text-secondary space-y-0.5">
                            <p>{t('qcoRecord')}: {t('qcoNotFound')}</p>
                            <p>{t('certNotDetermined')}</p>
                            <p>{t('verification')}: {t('checkQcoText')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div className="flex gap-3 py-3">
                  <ShieldAlert size={16} className="text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">{t('verification')}</p>
                    <p className="text-text-secondary">Potentially applicable — current BIS status requires verification before procurement use.</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase text-secondary mb-3 flex items-center gap-2">
                <FileSearch size={16} /> {t('tenderEvidence')}
              </h3>
              <div className="bg-background-primary p-4 rounded text-sm font-mono border border-border-primary flex flex-col gap-2">
                {activeRec.tender_evidence.map((ev: string, i: number) => (
                  <p key={i}>{ev}</p>
                ))}
              </div>
              <a
                href={`/api/tender-file?tenderId=${tenderId}`}
                target="_blank"
                rel="noreferrer"
                className="text-secondary text-sm font-medium flex items-center gap-1 hover:underline mt-2"
              >
                <ExternalLink size={14} /> {t('viewSource')}
              </a>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase text-secondary mb-3">{t('aiAssessment')}</h3>
              <p className="text-text-primary text-sm leading-relaxed">{activeRec.ai_note}</p>
            </div>

            <div className="mt-4 pt-4 border-t border-border-primary flex-grow min-h-[300px] flex flex-col">
              <h3 className="text-sm font-bold uppercase text-secondary mb-3 flex items-center gap-2">
                <Network size={16} /> {t('relatedGraph')}
              </h3>
              <div className="animate-enter bg-background-primary w-full h-full rounded border border-border-primary overflow-hidden">
                <RelationshipGraph standardId={activeRec.id} standardNumber={activeRec.standard_number} />
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border-primary bg-gray-50 flex gap-4 justify-end items-center flex-shrink-0 flex-wrap">
            {activeRec.source_url ? (
              <Link
                href={activeRec.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-secondary font-medium text-sm flex items-center gap-2 hover:underline mr-auto"
              >
                <ExternalLink size={16} /> {t('bisSource')}
              </Link>
            ) : (
              <span className="text-text-secondary text-sm mr-auto">BIS source unavailable — verify manually</span>
            )}

            <button
              onClick={() => setReviewStatus(activeRec, 'needs_verification')}
              disabled={updatingId === activeRec.id}
              className={`px-4 py-2 rounded font-medium text-sm transition-colors disabled:opacity-50 ${
                activeRec.review_status === 'needs_verification'
                  ? 'bg-warning/80 text-surface'
                  : 'bg-text-secondary/10 text-text-primary hover:bg-text-secondary/20'
              }`}
            >
              {activeRec.review_status === 'needs_verification' ? t('markedForVerification') : t('needsVerification')}
            </button>
            <button
              onClick={() => setReviewStatus(activeRec, 'included')}
              disabled={updatingId === activeRec.id}
              className={`px-4 py-2 rounded font-medium text-sm transition-colors disabled:opacity-50 ${
                activeRec.review_status === 'included'
                  ? 'bg-success/80 text-surface'
                  : 'bg-success text-surface hover:bg-success/90'
              }`}
            >
              {updatingId === activeRec.id
                ? t('saving')
                : activeRec.review_status === 'included'
                  ? `${t('includedInReport')} ✓`
                  : t('includeInReport')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
