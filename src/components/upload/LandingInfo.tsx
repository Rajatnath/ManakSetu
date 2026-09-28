'use client';

import { FileSearch, Database, ClipboardCheck } from 'lucide-react';
import { useAccessibility } from '@/components/layout/AccessibilityProvider';

export default function LandingInfo() {
  const { t } = useAccessibility();
  const steps = [
    { n: '01', icon: FileSearch, title: t('step1t'), desc: t('step1d') },
    { n: '02', icon: Database, title: t('step2t'), desc: t('step2d') },
    { n: '03', icon: ClipboardCheck, title: t('step3t'), desc: t('step3d') },
  ];
  return (
    <div className="w-full max-w-2xl mb-6">
      <h2 className="text-center text-xl font-bold text-primary tracking-tight">{t('productStatement')}</h2>
      <p className="text-center text-text-secondary text-sm mt-1 mb-5">{t('productSupport')}</p>
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((s, i) => (
          <li
            key={s.n}
            className="animate-enter bg-surface border border-border-primary rounded-lg px-4 py-3 flex gap-3 items-start"
            style={{ animationDelay: `${Math.min(i * 80, 240)}ms` }}
          >
            <s.icon size={18} className="text-secondary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-secondary tracking-wide">{s.n} {s.title}</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
