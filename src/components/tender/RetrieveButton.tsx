'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Check, Loader2 } from 'lucide-react';
import { useAccessibility } from '@/components/layout/AccessibilityProvider';

// Honest retrieval transition: the first two milestones are verified facts
// (we hold the requirements client-side); the corpus search itself runs on
// the next screen, so it is shown as the pending next step — never as done.
export default function RetrieveButton({
  tenderId,
  requirementCount,
  disabled,
}: {
  tenderId: string;
  requirementCount: number;
  disabled: boolean;
}) {
  const { t } = useAccessibility();
  const router = useRouter();
  const [transitioning, setTransitioning] = useState(false);

  const handleClick = () => {
    if (disabled || transitioning) return;
    setTransitioning(true);
    // Brief beat so the evaluator perceives the handoff; the actual
    // search + ranking execute on the recommendations screen.
    setTimeout(() => router.push(`/analysis/${tenderId}/recommendations`), 1200);
  };

  return (
    <div className="flex flex-col items-end gap-3">
      {transitioning && (
        <div className="animate-enter w-full max-w-md bg-surface border border-border-primary rounded-lg p-4">
          <p className="text-sm font-bold uppercase text-primary tracking-wide mb-2">{t('prepTitle')}</p>
          <ul className="flex flex-col gap-1.5">
            <li className="flex items-center gap-2 text-sm text-text-primary font-medium">
              <Check size={16} className="text-success animate-pop flex-shrink-0" />
              {requirementCount} {t('reqsConfirmed')}
            </li>
            <li className="flex items-center gap-2 text-sm text-text-primary font-medium">
              <Check size={16} className="text-success animate-pop flex-shrink-0" />
              {t('reqsNormalized')}
            </li>
            <li className="flex items-center gap-2 text-sm text-text-primary font-medium">
              <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <span className="pulse-dot block w-2.5 h-2.5 rounded-full bg-secondary" />
              </span>
              {t('searchingCorpus')}
            </li>
            <li className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 size={14} className="animate-spin flex-shrink-0" />
              {t('rankingCandidates')} • {t('preparingEvidence')}
            </li>
          </ul>
        </div>
      )}
      <button
        onClick={handleClick}
        disabled={disabled || transitioning}
        className="bg-primary text-surface px-6 py-3 rounded font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {transitioning ? <Loader2 className="animate-spin" size={20} /> : null}
        {t('retrieveButton')}
        {!transitioning && <ChevronRight size={20} />}
      </button>
    </div>
  );
}
