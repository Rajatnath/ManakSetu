import { normalizeIsString } from './explicitRefs.ts';

export interface CoverageCandidate {
  id: string;
  standard_number: string;
  title: string;
  score: number;
  relevance: string;
  review_status: string;
  reasons: string[];
}

export interface CoverageDiff {
  citedCount: number;
  identifiedCount: number;
  overlapCount: number;
  uncitedCount: number;
  // candidate ids also explicitly cited in the tender
  citedCandidateIds: string[];
  // candidate ids NOT explicitly cited (discovery, not a violation)
  uncitedCandidateIds: string[];
}

// Compares cited cores against candidate standard numbers. Edition-insensitive:
// "IS 456" cited matches candidate "IS 456:2000". Pure set math, no scoring.
export function computeCoverageDiff(
  citedCores: string[],
  candidates: CoverageCandidate[]
): CoverageDiff {
  const cited = new Set(citedCores);
  const citedCandidateIds: string[] = [];
  const uncitedCandidateIds: string[] = [];
  for (const c of candidates) {
    const core = normalizeIsString(c.standard_number);
    if (core && cited.has(core)) citedCandidateIds.push(c.id);
    else uncitedCandidateIds.push(c.id);
  }
  return {
    citedCount: cited.size,
    identifiedCount: candidates.length,
    overlapCount: citedCandidateIds.length,
    uncitedCount: uncitedCandidateIds.length,
    citedCandidateIds,
    uncitedCandidateIds,
  };
}
