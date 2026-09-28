import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { VERIFIED_RELATIONSHIPS } from '../src/data/verifiedRelationships';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase URL or Service Role Key.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Small verified relationship set (see src/data/verifiedRelationships.ts).
// Every row must be backed by an authoritative source cited in
// `evidence`/`source_url`. Rows in this table are verified-by-construction;
// corpus heuristics are computed at runtime and never written here.
const VERIFIED = VERIFIED_RELATIONSHIPS;

async function seed() {
  console.log('Seeding verified standard relationships...');
  const { data: standards, error: stdErr } = await supabase
    .from('standards')
    .select('id, standard_number');
  if (stdErr || !standards) {
    console.error('Failed to fetch standards:', stdErr?.message);
    process.exit(1);
  }
  const byNumber = new Map(standards.map((s: any) => [s.standard_number, s.id]));

  let inserted = 0;
  let skipped = 0;
  for (const rel of VERIFIED) {
    const sourceId = byNumber.get(rel.source);
    const targetId = byNumber.get(rel.target);
    if (!sourceId || !targetId) {
      console.warn(`  SKIP ${rel.source} -> ${rel.target}: standard not in corpus`);
      skipped++;
      continue;
    }
    const { data: existing } = await supabase
      .from('standard_relationships')
      .select('id')
      .eq('source_standard_id', sourceId)
      .eq('target_standard_id', targetId)
      .eq('relationship_type', rel.relationship_type)
      .maybeSingle();
    if (existing) {
      console.log(`  SKIP ${rel.source} -> ${rel.target}: already recorded`);
      skipped++;
      continue;
    }
    const { error } = await supabase.from('standard_relationships').insert({
      source_standard_id: sourceId,
      target_standard_id: targetId,
      relationship_type: rel.relationship_type,
      evidence: rel.evidence,
      source_url: rel.source_url,
    });
    if (error) {
      console.error(`  FAIL ${rel.source} -> ${rel.target}: ${error.message}`);
    } else {
      console.log(`  OK ${rel.source} -> ${rel.target} (${rel.relationship_type})`);
      inserted++;
    }
  }
  console.log(`Done. Inserted ${inserted}, skipped ${skipped}.`);
}

seed().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
