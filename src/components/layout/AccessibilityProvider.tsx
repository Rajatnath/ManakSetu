'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { en, hi, DictKey } from '@/lib/i18n/dictionary';

type TextSize = 'normal' | 'large' | 'xlarge';
type Language = 'en' | 'hi';

interface AccessibilityContextType {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  highContrast: boolean;
  setHighContrast: (contrast: boolean) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  readAloud: (text: string) => void;
  stopReadAloud: () => void;
  isReading: boolean;
  t: (key: DictKey) => string;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [textSize, setTextSize] = useState<TextSize>('normal');
  const [highContrast, setHighContrast] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [isReading, setIsReading] = useState(false);

  useEffect(() => {
    // Apply classes to body based on state
    if (textSize === 'large') {
      document.body.classList.add('text-large');
      document.body.classList.remove('text-xlarge');
    } else if (textSize === 'xlarge') {
      document.body.classList.add('text-xlarge');
      document.body.classList.remove('text-large');
    } else {
      document.body.classList.remove('text-large', 'text-xlarge');
    }

    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [textSize, highContrast]);

  const readAloud = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
      
      utterance.onstart = () => setIsReading(true);
      utterance.onend = () => setIsReading(false);
      utterance.onerror = () => setIsReading(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopReadAloud = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsReading(false);
    }
  };

  const t = useCallback((key: DictKey) => {
    return language === 'hi' ? hi[key] : en[key];
  }, [language]);

  return (
    <AccessibilityContext.Provider value={{
      textSize, setTextSize,
      highContrast, setHighContrast,
      language, setLanguage,
      readAloud, stopReadAloud,
      isReading, t
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
