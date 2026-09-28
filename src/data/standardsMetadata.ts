// Curated, source-backed Indian Standards metadata for the demo corpus.
//
// Every record carries provenance (sourceUrl, sourceType, lastVerifiedAt).
// Standards WITHOUT a record here resolve to "Metadata verification
// unavailable" in the UI. Never invent edition/amendment/status facts.

export interface StandardAmendment {
  note: string;
  sourceUrl: string;
}

export interface StandardMetadata {
  standardNumber: string;
  title: string;
  editionYear: number | null;
  revision: string | null;
  // NEVER a legal currency claim — display only, always beside verification copy.
  status: string | null;
  reaffirmedYear: number | null;
  amendmentCount: number | null;
  amendmentNote: string | null;
  amendments: StandardAmendment[];
  sourceUrl: string;
  sourceType: string;
  lastVerifiedAt: string; // ISO date this record was verified against the source
}

const BIS_ESALE_456 =
  'https://standardsbis.bsbedge.com/BIS_SearchStandard.aspx?Standard_Number=IS%2B456&id=0';
const BIS_PM_269 = 'https://www.bis.gov.in/wp-content/uploads/2023/10/PM_IS_269-Oct-2023.pdf';

export const STANDARDS_METADATA: Record<string, StandardMetadata> = {
  'IS 456:2000': {
    standardNumber: 'IS 456:2000',
    title: 'Plain and Reinforced Concrete — Code of Practice',
    editionYear: 2000,
    revision: 'Fourth Revision',
    status: 'Active (BIS e-sale listing)',
    reaffirmedYear: 2021,
    amendmentCount: 6,
    amendmentNote:
      'BIS e-sale records 6 amendments (including Amd. 6:2024). Verify amendment numbers and dates via the BIS portal — manual verification required.',
    amendments: [],
    sourceUrl: BIS_ESALE_456,
    sourceType: 'BIS e-sale listing',
    lastVerifiedAt: '2026-09-27',
  },
  'IS 269:2015': {
    standardNumber: 'IS 269:2015',
    title: 'Ordinary Portland Cement — Specification',
    editionYear: 2015,
    revision: 'Sixth Revision',
    status: 'Active certification scheme (Scheme-I, per BIS product manual)',
    reaffirmedYear: null,
    amendmentCount: 1,
    amendmentNote:
      'BIS Product Manual (Oct 2023) records 1 amendment. Verify amendment number and date via the BIS portal — manual verification required.',
    amendments: [],
    sourceUrl: BIS_PM_269,
    sourceType: 'BIS product manual (bis.gov.in)',
    lastVerifiedAt: '2026-09-27',
  },
};

export function getStandardMetadata(standardNumber: string): StandardMetadata | null {
  return STANDARDS_METADATA[standardNumber.trim()] || null;
}
