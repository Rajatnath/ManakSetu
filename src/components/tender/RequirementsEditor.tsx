'use client';

import { useState } from 'react';
import { Pencil, Check, X, Box, Layers, Ruler, Cog, Zap, FlaskConical, ShieldCheck, Wrench } from 'lucide-react';
import { useAccessibility } from '@/components/layout/AccessibilityProvider';

// Deterministic icon per category string — a scanability marker, not decoration.
const CATEGORY_ICONS = [Box, Layers, Ruler, Cog, Zap, FlaskConical, ShieldCheck, Wrench];

function iconForCategory(cat: string) {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) >>> 0;
  return CATEGORY_ICONS[h % CATEGORY_ICONS.length];
}

interface Requirement {
  id: string;
  category: string | null;
  requirement: string | null;
  value: string | null;
  unit: string | null;
  source_text: string | null;
  page_number: number | null;
}

const FIELDS: { key: 'category' | 'requirement' | 'value' | 'unit'; label: string }[] = [
  { key: 'category', label: 'Category' },
  { key: 'requirement', label: 'Requirement name' },
  { key: 'value', label: 'Value' },
  { key: 'unit', label: 'Unit' },
];

export default function RequirementsEditor({
  initialRequirements,
  pageCount,
  provenance,
  ocrUsed,
}: {
  initialRequirements: Requirement[];
  pageCount: number | null;
  provenance: Record<string, string> | null;
  ocrUsed: boolean;
}) {
  const { t } = useAccessibility();
  const [requirements, setRequirements] = useState<Requirement[]>(initialRequirements);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic category breakdown from the actual extracted rows
  const categoryCounts = (() => {
    const map = new Map<string, number>();
    for (const r of requirements) {
      const cat = (r.category || 'Other').trim() || 'Other';
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  })();

  const startEdit = (req: Requirement) => {
    setEditingId(req.id);
    setError(null);
    setDraft({
      category: req.category || '',
      requirement: req.requirement || '',
      value: req.value || '',
      unit: req.unit || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
    setError(null);
  };

  const saveEdit = async (id: string) => {
    if (!draft.requirement?.trim()) {
      setError('Requirement name cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/requirements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setRequirements(prev => prev.map(r => (r.id === id ? data.requirement : r)));
      setEditingId(null);
      setDraft({});
    } catch (e: any) {
      setError(e.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="p-4">
        {requirements.length === 0 ? (
          <div className="text-center p-8 text-text-secondary">
            <p>No requirements extracted yet. If analysis is still running, wait for it to complete, then reload this page.</p>
            <p className="mt-2 text-sm">If extraction finished with no results, the document contained no measurable technical specifications — try another PDF or the demo tender from the landing page.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 pb-4 border-b border-border-primary">
              <p className="text-sm text-text-primary font-medium">
                Extraction complete • {requirements.length} requirements identified{pageCount ? ` from ${pageCount} pages` : ''}
              </p>
              {ocrUsed && (
                <p className="text-xs text-warning font-medium mt-1">
                  Text extracted with OCR — verify values against the source PDF.
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {categoryCounts.map(([cat, n]) => {
                  const Icon = iconForCategory(cat);
                  return (
                    <span key={cat} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded inline-flex items-center gap-1.5">
                      <Icon size={12} />
                      {n} {cat}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requirements.map((req, i) => (
              <div
                key={req.id}
                className="animate-enter p-3 border border-border-primary rounded bg-background-primary"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                {editingId === req.id ? (
                  <div className="flex flex-col gap-2">
                    {FIELDS.map(f => (
                      <label key={f.key} className="text-xs text-secondary font-medium">
                        {f.label}
                        <input
                          value={draft[f.key] || ''}
                          onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="mt-1 w-full text-sm text-text-primary bg-white border border-border-primary rounded px-2 py-1"
                        />
                      </label>
                    ))}
                    {error && <p className="text-xs text-danger">{error}</p>}
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => saveEdit(req.id)}
                        disabled={saving}
                        className="px-3 py-1.5 bg-success text-surface rounded text-sm font-medium flex items-center gap-1 hover:bg-success/90 disabled:opacity-50"
                      >
                        <Check size={14} /> {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="px-3 py-1.5 bg-text-secondary/10 text-text-primary rounded text-sm font-medium flex items-center gap-1 hover:bg-text-secondary/20 disabled:opacity-50"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                    <p className="text-xs text-text-secondary">Saving updates the stored requirement used for retrieval.</p>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-secondary font-semibold uppercase tracking-wide mb-1">{req.category || 'Uncategorized'}</div>
                    <p className="text-text-primary font-medium leading-snug">{req.requirement}</p>
                    <p className="text-primary font-bold text-lg leading-tight mt-1">
                      {req.value || '—'}
                      {req.unit ? <span className="font-semibold text-base"> {req.unit}</span> : null}
                    </p>
                    {!req.unit && (
                      <p className="text-xs text-text-secondary mt-0.5 italic">Unit not specified</p>
                    )}
                    {req.source_text && (
                      <blockquote className="text-xs text-text-secondary mt-2 pl-2 border-l-2 border-border-primary font-mono truncate" title={req.source_text}>
                        &quot;{req.source_text}&quot;
                      </blockquote>
                    )}
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-text-secondary">
                        {req.page_number ? `Source: Page ${req.page_number}` : 'Source location unavailable'}
                        {provenance?.[req.id] === 'ocr'
                          ? ` • ${t('sourceMethod')}: ${t('ocrExtracted')}`
                          : provenance?.[req.id] === 'pdf_text'
                            ? ` • ${t('sourceMethod')}: ${t('pdfTextLabel')}`
                            : ''}
                      </span>
                      <button
                        onClick={() => startEdit(req)}
                        className="text-secondary text-xs font-medium flex items-center gap-1 hover:underline"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
