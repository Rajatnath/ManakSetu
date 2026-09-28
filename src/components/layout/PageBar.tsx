'use client';

import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { useAccessibility } from './AccessibilityProvider';
import type { DictKey } from '@/lib/i18n/dictionary';
import type { ReactNode } from 'react';

// Shared translated page bar for the analysis flow screens.
export default function PageBar({
  titleKey,
  backHref,
  backLabelKey,
  actionHref,
  actionLabelKey,
  children,
}: {
  titleKey: DictKey;
  backHref?: string;
  backLabelKey?: DictKey;
  actionHref?: string;
  actionLabelKey?: DictKey;
  children?: ReactNode;
}) {
  const { t } = useAccessibility();
  return (
    <div className="bg-surface p-4 flex justify-between items-center shadow-sm border-b border-border-primary print:hidden gap-4 flex-wrap">
      <h2 className="text-lg font-bold">{t(titleKey)}</h2>
      <div className="flex gap-4 items-center flex-wrap">
        {backHref && backLabelKey && (
          <Link href={backHref} className="flex items-center gap-2 text-sm text-secondary hover:underline">
            <ArrowLeft size={16} /> {t(backLabelKey)}
          </Link>
        )}
        {actionHref && actionLabelKey && (
          <Link
            href={actionHref}
            className="bg-secondary text-surface px-4 py-2 rounded text-sm font-medium flex items-center gap-2 hover:bg-secondary/90 transition-colors"
          >
            <FileText size={16} /> {t(actionLabelKey)}
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}
