'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAccessibility } from '@/components/layout/AccessibilityProvider';
import type { CoverageData } from '@/lib/coverage/buildCoverage';

function methodSuffix(method: string | null, t: (k: any) => string): string {
  if (method === 'ocr') return ` • ${t('sourceMethod')}: ${t('ocrExtracted')}`;
  if (method === 'pdf_text') return ` • ${t('sourceMethod')}: ${t('pdfTextLabel')}`;
  return '';
}

export default function CoveragePanel({
  tenderId,
  onInspect,
}: {
  tenderId: string;
  onInspect: (standardId: string) => void;
}) {
  const { t } = useAccessibility();
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/coverage?tenderId=${tenderId}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          if (d.error) setError(d.error);
          else setCoverage(d.coverage);
        }
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message || 'Coverage failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [tenderId]);

  if (error) {
    return (
      <div className="text-danger text-sm p-4 border border-danger/20 bg-danger/5 rounded-lg flex items-center gap-2 flex-shrink-0">
        <ShieldAlert size={16} /> {error}
      </div>
    );
  }

  if (!coverage) {
    return (
      <div className="bg-surface border border-border-primary rounded-lg p-4 flex items-center gap-2 text-sm text-text-secondary flex-shrink-0">
        <Loader2 size={16} className="animate-spin" /> {t('loadingDots')}
      </div>
    );
  }

  const groups = new Map<string, typeof coverage.requirements>();
  for (const r of coverage.requirements) {
    const cat = (r.category || 'Other').trim() || 'Other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(r);
  }

  const uncited = coverage.candidates.filter(c => coverage.diff.uncitedCandidateIds.includes(c.id));

  return (
    <div className="bg-surface border border-border-primary rounded-lg flex-shrink-0">
      <div className="p-4 border-b border-border-primary">
        <h3 className="text-sm font-bold uppercase text-primary tracking-wide">{t('coverageTitle')}</h3>
      </div>

      <div className="p-4 border-b border-border-primary">
        <p className="text-sm font-semibold text-text-primary mb-2">
          {t('coverageReqs')} — {coverage.requirementCount} {t('requirementsWord')}
        </p>
        <div className="flex flex-col gap-1">
          {[...groups.entries()].map(([cat, rows]) => (
            <details key={cat} className="text-sm">
              <summary className="cursor-pointer text-secondary font-medium hover:underline">
                {cat} ({rows.length})
              </summary>
              <ul className="mt-1 ml-4 space-y-1.5">
                {rows.map(r => (
                  <li key={r.id} className="text-text-primary">
                    <span className="font-medium">{r.requirement}</span>
                    {r.value ? <span> — {r.value}{r.unit ? ` ${r.unit}` : ''}</span> : null}
                    <span className="block text-xs text-text-secondary">
                      {r.page_number ? `Source: Page ${r.page_number}` : 'Source location unavailable'}
                      {methodSuffix(r.method, t)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </div>

      <div className="p-4 border-b border-border-primary">
        <p className="text-sm font-semibold text-text-primary mb-2">{t('explicitCited')}</p>
        {coverage.textUnavailable ? (
          <p className="text-xs text-text-secondary">{t('textUnavailableNote')}</p>
        ) : coverage.explicitReferences.length === 0 ? (
          <p className="text-xs text-text-secondary">{t('noExplicitRefs')}</p>
        ) : (
          <ul className="space-y-1.5">
            {coverage.explicitReferences.map(ref => (
              <li key={ref.core} className="text-sm text-text-primary">
                <span className="font-bold text-primary">{ref.raw}</span>
                <span className="block text-xs text-text-secondary font-mono">
                  Page {ref.page} — “{ref.context}”
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-text-secondary mt-2 italic">{t('docObservation')}</p>
      </div>

      <div className="p-4 border-b border-border-primary">
        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <div className="bg-background-primary border border-border-primary rounded p-2">
            <p className="text-xl font-bold text-primary">{coverage.diff.citedCount}</p>
            <p className="text-xs text-text-secondary">{t('tenderRefs')}</p>
          </div>
          <div className="bg-background-primary border border-border-primary rounded p-2">
            <p className="text-xl font-bold text-primary">{coverage.diff.identifiedCount}</p>
            <p className="text-xs text-text-secondary">{t('manaksetuIdentified')}</p>
          </div>
          <div className="bg-background-primary border border-border-primary rounded p-2">
            <p className="text-xl font-bold text-warning">{coverage.diff.uncitedCount}</p>
            <p className="text-xs text-text-secondary">{t('notExplicitlyCited')}</p>
          </div>
        </div>
        {uncited.length > 0 ? (
          <div>
            <p className="text-xs text-text-secondary mb-1">
              {coverage.diff.uncitedCount} {t('uncitedNote')}
            </p>
            <ul className="space-y-1">
              {uncited.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-text-primary">
                    <span className="font-bold text-primary">{c.standard_number}</span>
                    <span className="text-text-secondary"> · {c.score.toFixed(2)}</span>
                  </span>
                  <button
                    onClick={() => onInspect(c.id)}
                    className="text-secondary text-xs font-medium hover:underline flex-shrink-0"
                  >
                    {t('inspectBtn')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          coverage.diff.identifiedCount > 0 && (
            <p className="text-xs text-text-secondary">{t('allCited')}</p>
          )
        )}
        {coverage.diff.identifiedCount === 0 && (
          <p className="text-xs text-text-secondary">{t('coverageEmpty')}</p>
        )}
      </div>

      <div className="p-4 border-b border-border-primary">
        <p className="text-sm font-semibold text-text-primary mb-2">{t('relatedTest')}</p>
        {coverage.relationships.length === 0 ? (
          <p className="text-xs text-text-secondary">{t('noVerifiedForSet')}</p>
        ) : (
          <ul className="space-y-1.5">
            {coverage.relationships.map((rel, i) => (
              <li key={i} className="text-sm text-text-primary">
                <span className="font-bold text-primary">{rel.from_number}</span>
                <span className="text-text-secondary"> → {rel.relationship_type.replace(/_/g, ' ')} → </span>
                <span className="font-bold text-primary">{rel.to_number}</span>
                <span className="block text-xs text-text-secondary">
                  Source: BIS • Verification: Verified
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-4 bg-background-primary/50 rounded-b-lg">
        <p className="text-xs font-bold uppercase text-secondary tracking-wide mb-1">{t('whyMattersTitle')}</p>
        <p className="text-xs text-text-secondary leading-relaxed">{t('whyMattersBody')}</p>
      </div>
    </div>
  );
}
