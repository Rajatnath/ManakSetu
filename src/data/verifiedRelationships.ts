// Verified BIS relationships (single source of truth).
//
// Consumed by scripts/seed_verified_relationships.ts. Every entry must cite
// an authoritative source. Rows written from here are verified-by-construction;
// runtime corpus heuristics must never be added to this list.

export interface VerifiedRelationshipSeed {
  source: string;
  target: string;
  relationship_type: 'normative_reference' | 'test_method_reference' | 'related_standard';
  evidence: string;
  source_url: string;
}

export const VERIFIED_RELATIONSHIPS: VerifiedRelationshipSeed[] = [
  {
    source: 'IS 269:2015',
    target: 'IS 4031 (Part 6):1988',
    relationship_type: 'test_method_reference',
    evidence:
      'IS 269 (Ordinary Portland Cement) conformity testing uses IS 4031 physical-test methods for hydraulic cement, including compressive-strength testing; see the BIS Product Manual for IS 269, Table 1 test methods.',
    source_url: 'https://www.bis.gov.in/wp-content/uploads/2023/10/PM_IS_269-Oct-2023.pdf',
  },
  {
    source: 'IS 456:2000',
    target: 'IS 516:1959',
    relationship_type: 'test_method_reference',
    evidence:
      'IS 456 (Plain and Reinforced Concrete) sampling and acceptance criteria for concrete strength are tested in accordance with IS 516 (Methods of Tests for Strength of Concrete).',
    source_url: 'https://law.resource.org/pub/in/bis/S03/is.456.2000.pdf',
  },
];
