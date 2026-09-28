// Semantic-similarity meter. Visualization of retrieval similarity ONLY —
// never labelled confidence, accuracy or probability. The exact numeric
// value always stays visible next to the bar.
export default function SimilarityMeter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs mb-1">
        <span className="text-text-secondary">Semantic similarity</span>
        <span className="font-bold text-text-primary">{value.toFixed(2)}</span>
      </div>
      <div
        className="h-1.5 rounded bg-border-primary overflow-hidden"
        role="img"
        aria-label={`Semantic similarity ${value.toFixed(2)} out of 1`}
      >
        <div className="meter-fill h-full rounded bg-secondary" style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  );
}
