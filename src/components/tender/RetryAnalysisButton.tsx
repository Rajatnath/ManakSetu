'use client';

import { useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { useAccessibility } from '@/components/layout/AccessibilityProvider';

export default function RetryAnalysisButton({ tenderId }: { tenderId: string }) {
  const { t } = useAccessibility();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retry failed');
      window.location.reload();
    } catch (e: any) {
      setError(e.message || 'Retry failed. Please try again.');
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 mt-3">
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="bg-primary text-surface px-5 py-2.5 rounded font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
      >
        {retrying ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
        {retrying ? t('retrying') : t('retryAnalysis')}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
