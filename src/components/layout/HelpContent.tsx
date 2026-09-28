'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAccessibility } from '@/components/layout/AccessibilityProvider';

export default function HelpContent() {
  const { t } = useAccessibility();

  const steps = [
    { title: t('helpStep1t'), body: t('helpStep1d') },
    { title: t('helpStep2t'), body: t('helpStep2d') },
    { title: t('helpStep3t'), body: t('helpStep3d') },
    { title: t('helpStep4t'), body: t('helpStep4d') },
    { title: t('helpStep5t'), body: t('helpStep5d') },
  ];

  return (
    <>
      <div className="bg-surface p-4 flex justify-between items-center shadow-sm border-b border-border-primary">
        <h2 className="text-lg font-bold">{t('help')}</h2>
        <Link href="/" className="flex items-center gap-2 text-sm text-secondary hover:underline">
          <ArrowLeft size={16} /> {t('backToDashboard')}
        </Link>
      </div>

      <main className="flex-grow p-4 md:p-8 max-w-3xl mx-auto w-full">
        <div className="bg-surface rounded-lg border border-border-primary shadow-sm p-6 mb-6">
          <h3 className="text-xl font-bold text-primary mb-2">{t('helpWhat')}</h3>
          <p className="text-text-primary text-sm leading-relaxed">{t('helpIntro')}</p>
        </div>

        <div className="bg-surface rounded-lg border border-border-primary shadow-sm p-6 mb-6">
          <h3 className="text-xl font-bold text-primary mb-4">{t('helpDemo')}</h3>
          <div className="flex flex-col gap-4">
            {steps.map(step => (
              <div key={step.title} className="border-l-4 border-secondary pl-4">
                <p className="font-semibold text-text-primary text-sm">{step.title}</p>
                <p className="text-text-secondary text-sm mt-1">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface rounded-lg border border-border-primary shadow-sm p-6">
          <h3 className="text-xl font-bold text-primary mb-2">{t('helpA11yTitle')}</h3>
          <p className="text-text-secondary text-sm leading-relaxed">{t('helpA11y')}</p>
        </div>
      </main>
    </>
  );
}
