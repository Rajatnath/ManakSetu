'use client';

import { useEffect, useState } from 'react';
import { FileUp, Search, FileText, Loader2, Check, ExternalLink, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAccessibility } from '@/components/layout/AccessibilityProvider';

interface Inspection {
  pageCount: number;
  scannedPages: number[];
  ocrAvailable: boolean;
}

function StageRow({ state, label }: { state: 'done' | 'active' | 'todo' | 'warn'; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {state === 'done' ? (
        <Check size={16} className="text-success animate-pop flex-shrink-0" />
      ) : state === 'active' ? (
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          <span className="pulse-dot block w-2.5 h-2.5 rounded-full bg-secondary" />
        </span>
      ) : state === 'warn' ? (
        <AlertTriangle size={16} className="text-warning flex-shrink-0" />
      ) : (
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          <span className="block w-2.5 h-2.5 rounded-full border border-border-primary" />
        </span>
      )}
      <span className={state === 'todo' ? 'text-text-secondary' : 'text-text-primary font-medium'}>{label}</span>
    </li>
  );
}

export default function FileUploader() {
  const { t } = useAccessibility();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tenderId, setTenderId] = useState<string | null>(null);
  const [docInfo, setDocInfo] = useState<{ name: string; size: string; pages: number | null } | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const router = useRouter();

  // Elapsed timer drives the honest sub-phase indicator while the single
  // monolithic analysis request is in flight. Completion is set ONLY by the
  // actual API response — never by the timer.
  useEffect(() => {
    if (!analyzing) return;
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [analyzing]);

  const facet = elapsed < 6 ? 0 : elapsed < 14 ? 1 : 2;
  const normalFacets = [t('identifyingReqs'), t('normalizingSpecs'), t('preparingRetrieval')];
  const ocrFacets = [t('extractingOcr'), t('identifyingReqs'), t('preparingRetrieval')];
  const isScannedFlow = !!inspection && inspection.scannedPages.length > 0;
  const facets = isScannedFlow ? ocrFacets : normalFacets;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleTryDemo = async () => {
    try {
      const res = await fetch('/demo-tender.pdf');
      if (!res.ok) throw new Error('Demo tender could not be loaded.');
      const blob = await res.blob();
      const demoFile = new File([blob], 'demo-tender-school-block.pdf', { type: 'application/pdf' });
      setFile(demoFile);
      await handleUploadAndAnalyze(demoFile);
    } catch (e: any) {
      setErrorMessage(e.message || 'Demo failed. Please try again later.');
    }
  };

  const handleUploadAndAnalyze = async (uploadFile?: File) => {
    const activeFile = uploadFile || file;
    if (!activeFile) return;

    setErrorMessage(null);
    setTenderId(null);
    setInspection(null);
    setDocInfo({
      name: activeFile.name,
      size: `${(activeFile.size / 1024 / 1024).toFixed(2)} MB`,
      pages: null,
    });
    setUploading(true);

    try {
      // 1. Upload — completion of this request IS the "document received" milestone
      const formData = new FormData();
      formData.append('file', activeFile, activeFile.name);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);
      const newTenderId: string = data.tenderId;
      setTenderId(newTenderId);

      // 2. Inspect — fast, genuine pre-flight: page count + scanned-page detection
      setUploading(false);
      setAnalyzing(true);

      const inspectRes = await fetch(`/api/inspect?tenderId=${newTenderId}`);
      const inspectData = await inspectRes.json();
      if (!inspectRes.ok) throw new Error(inspectData.error);

      const insp: Inspection = {
        pageCount: inspectData.pageCount,
        scannedPages: inspectData.scannedPages || [],
        ocrAvailable: !!inspectData.ocrAvailable,
      };
      setInspection(insp);
      setDocInfo(prev => (prev ? { ...prev, pages: insp.pageCount || null } : prev));

      if (insp.scannedPages.length > 0 && !insp.ocrAvailable) {
        throw new Error(
          `Scanned pages detected (pages ${insp.scannedPages.join(', ')}) with no extractable text, and OCR is not configured. Ask the administrator to enable OCR, then retry analysis.`
        );
      }

      // 3. Analyze (single operation; OCR fallback happens server-side when needed)
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tenderId: newTenderId })
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error);

      // Successfully processed! Push!
      router.push(`/analysis/${newTenderId}`);

    } catch (e: any) {
      setErrorMessage(e.message || 'Pipeline failed. Please try again later.');
      setUploading(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-surface border border-border-primary rounded-lg p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-primary mb-6 text-center">{t('uploadTitle')}</h2>

      {analyzing && docInfo ? (
        <div className="animate-enter">
          <div className="border border-border-primary rounded-lg p-4 mb-4 bg-background-primary/50">
            <p className="text-xs font-bold uppercase text-secondary tracking-wide mb-2">{t('docLabel')}</p>
            <div className="flex items-start gap-3">
              <FileText size={28} className="text-secondary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-text-primary font-medium truncate">{docInfo.name}</p>
                <p className="text-text-secondary text-sm">
                  {docInfo.pages ? `${docInfo.pages} ${t('pagesWord')} • ` : ''}PDF • {docInfo.size}
                </p>
                {tenderId && (
                  <a
                    href={`/api/tender-file?tenderId=${tenderId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-secondary text-sm font-medium inline-flex items-center gap-1 hover:underline mt-1"
                  >
                    <ExternalLink size={14} /> {t('viewSource')}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="border border-border-primary rounded-lg p-4">
            <p className="text-sm font-bold uppercase text-primary tracking-wide mb-1 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-secondary" /> {t('analyzing')}
            </p>
            {isScannedFlow ? (
              <ul className="flex flex-col gap-1.5 mt-3 mb-3">
                <StageRow state="done" label={t('docReceived')} />
                <StageRow state="done" label={t('pdfInspected')} />
                <StageRow state="warn" label={`${t('scannedDetected')}: ${t('pagesWord')} ${inspection.scannedPages.join(', ')}`} />
                <StageRow state={facet === 0 ? 'active' : 'done'} label={facets[0]} />
                <StageRow state={facet === 1 ? 'active' : facet > 1 ? 'done' : 'todo'} label={facets[1]} />
                <StageRow state={facet === 2 ? 'active' : 'todo'} label={facets[2]} />
              </ul>
            ) : (
              <ul className="flex flex-col gap-1.5 mt-3 mb-3">
                <StageRow state="done" label={t('docReceived')} />
                <StageRow state="done" label={t('pdfExtracted')} />
                <StageRow state={facet === 0 ? 'active' : 'done'} label={facets[0]} />
                <StageRow state={facet === 1 ? 'active' : facet > 1 ? 'done' : 'todo'} label={facets[1]} />
                <StageRow state={facet === 2 ? 'active' : 'todo'} label={facets[2]} />
              </ul>
            )}
            <p className="text-text-secondary text-sm">{isScannedFlow ? t('ocrNote') : t('extractingNote')}</p>
          </div>
        </div>
      ) : (
        <>
          <label className={`border-2 border-dashed border-border-primary rounded-lg p-10 flex flex-col items-center justify-center mb-6 cursor-pointer hover:bg-background-primary hover:border-secondary/50 transition-colors ${uploading ? 'bg-background-primary opacity-50 cursor-not-allowed' : 'bg-background-primary/50'}`}>
            <input
              type="file"
              className="hidden"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <span className="bg-secondary/10 rounded-lg p-3 mb-3">
              <FileText size={28} className="text-secondary" />
            </span>
            <p className="text-text-primary font-semibold mb-0.5">
              {file ? file.name : t('dropTitle')}
            </p>
            {!file && (
              <p className="text-text-secondary text-sm mb-2">{t('dropBrowse')}</p>
            )}
            <p className="text-text-secondary text-xs uppercase tracking-wide">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : t('pdfNote')}
            </p>
          </label>

          {errorMessage && (
            <div className="mb-4 rounded border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => handleUploadAndAnalyze()}
              disabled={!file || uploading}
              className="bg-primary text-surface px-6 py-3 rounded font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="animate-spin" size={20} /> : <FileUp size={20} />}
              {uploading ? t('uploading') : t('startButton')}
            </button>

            <div className="flex items-center gap-3 w-full max-w-xs">
              <div className="flex-grow border-t border-border-primary" />
              <span className="text-text-secondary text-sm">{t('orDivider')}</span>
              <div className="flex-grow border-t border-border-primary" />
            </div>

            <button
              onClick={handleTryDemo}
              disabled={uploading}
              className="text-secondary font-medium text-sm flex items-center gap-2 hover:underline disabled:opacity-50"
            >
              <Search size={16} /> {t('demoButton')}
            </button>
            <p className="text-text-secondary text-xs text-center">
              {t('demoNote')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
