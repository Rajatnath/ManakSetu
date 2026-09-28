// Curated QCO / conformity-assessment records for the demo corpus.
//
// A record here means "a QCO record was found in the prototype dataset" —
// NEVER a legal determination that certification is mandatory for a given
// procurement. Standards WITHOUT a record resolve to "Not found in current
// prototype dataset". Never infer certification from a standard's existence.

export interface QcoRecord {
  standardNumber: string;
  product: string;
  qcoTitle: string;
  authority: string;
  notificationDate: string | null;
  notificationRef: string | null;
  enforcementDate: string | null;
  certificationScheme: string | null;
  sourceUrl: string;
  sourceType: string;
  verifiedAt: string; // ISO date this record was verified against the source
}

export const QCO_RECORDS: Record<string, QcoRecord> = {
  'IS 269:2015': {
    standardNumber: 'IS 269:2015',
    product: 'Ordinary Portland Cement (OPC 33 / 43 / 53 grades)',
    qcoTitle: 'Cement (Quality Control) Order, 2003',
    authority: 'Ministry of Commerce and Industry (DPIIT)',
    notificationDate: '2003-02-17',
    notificationRef: 'S.O. 191(E)',
    enforcementDate: null,
    certificationScheme: 'BIS Scheme-I (ISI Mark licensing)',
    sourceUrl: 'https://www.bis.gov.in/wp-content/uploads/2023/10/PM_IS_269-Oct-2023.pdf',
    sourceType: 'BIS product manual (bis.gov.in) + QCO trade references',
    verifiedAt: '2026-09-27',
  },
};

export function getQcoRecord(standardNumber: string): QcoRecord | null {
  return QCO_RECORDS[standardNumber.trim()] || null;
}
