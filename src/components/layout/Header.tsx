'use client';

import Link from 'next/link';
import { HandHelping, Volume2, VolumeX } from 'lucide-react';
import { useAccessibility } from './AccessibilityProvider';

export default function Header() {
  const {
    textSize, setTextSize,
    highContrast, setHighContrast,
    language, setLanguage,
    isReading, stopReadAloud, readAloud,
    t
  } = useAccessibility();

  const handleReadScreen = () => {
    // In a real app, this would extract text more intelligently
    const text = document.body.innerText;
    readAloud(text);
  };

  return (
    <header className="bg-primary text-surface p-4 flex flex-col md:flex-row justify-between items-center shadow-md print:hidden gap-4">
      <div className="flex items-center gap-3">
        <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="flex-shrink-0">
          <rect width="32" height="32" rx="7" fill="#0B2545" />
          <path d="M8 22V11l5 6 3-4.5L19 17l5-6v11" fill="none" stroke="#FAF7F1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="8" y1="25.5" x2="24" y2="25.5" stroke="#C99A4B" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <div>
          <h1 className="text-xl leading-tight">
            <span className="font-extrabold tracking-tight">{t('brandName')}</span>{' '}
            <span className="font-normal opacity-80">{t('brandRest')}</span>
          </h1>
          <p className="text-sm opacity-80">{t('appSubtitle')}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-center justify-center">
        <button
          onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          className="text-sm cursor-pointer hover:underline font-medium"
        >
          {t('toggleLanguage')}
        </button>

        <div className="flex gap-2 bg-black/10 px-2 py-1 rounded">
          <button
            onClick={() => setTextSize('normal')}
            className={`text-sm font-medium ${textSize === 'normal' ? 'font-bold underline' : ''}`}
            aria-label={t('defaultTextSize')}
          >A-</button>
          <button
            onClick={() => setTextSize('large')}
            className={`text-base font-medium ${textSize === 'large' ? 'font-bold underline' : ''}`}
            aria-label={t('largeTextSize')}
          >A</button>
          <button
            onClick={() => setTextSize('xlarge')}
            className={`text-lg font-medium ${textSize === 'xlarge' ? 'font-bold underline' : ''}`}
            aria-label={t('xlTextSize')}
          >A+</button>
        </div>

        <button
          onClick={() => setHighContrast(!highContrast)}
          className={`text-sm underline ${highContrast ? 'font-bold text-yellow-300' : ''}`}
          aria-label={t('toggleContrast')}
        >
          {t('contrast')}
        </button>

        {isReading ? (
          <button onClick={stopReadAloud} className="flex items-center gap-1 text-sm bg-danger text-white px-2 py-1 rounded" aria-label={t('stopReading')}>
            <VolumeX size={16} /> {t('stop')}
          </button>
        ) : (
          <button onClick={handleReadScreen} className="flex items-center gap-1 text-sm hover:underline" aria-label={t('readAloud')}>
            <Volume2 size={16} /> {t('read')}
          </button>
        )}

        <Link href="/help" className="flex items-center gap-1 text-sm underline hover:opacity-80">
          <HandHelping size={16} /> {t('help')}
        </Link>
      </div>
    </header>
  );
}
