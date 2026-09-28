import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { splitValueUnit } from '../src/lib/requirements/normalize';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase URL or Service Role Key.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function normalizeExisting() {
  console.log('Scanning tender_requirements for value/unit duplication...');
  const { data: rows, error } = await supabase
    .from('tender_requirements')
    .select('id, requirement, value, unit');

  if (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }

  let checked = 0;
  let fixed = 0;
  for (const row of rows || []) {
    checked++;
    const n = splitValueUnit(row.value, row.unit);
    const curV = (row.value ?? '').trim();
    const curU = (row.unit ?? '').trim() || null;
    if (n.value !== curV || n.unit !== curU) {
      console.log(`FIX "${row.requirement}": value "${curV}" + unit "${curU}" → value "${n.value}" + unit "${n.unit}"`);
      const { error: upErr } = await supabase
        .from('tender_requirements')
        .update({ value: n.value || null, unit: n.unit })
        .eq('id', row.id);
      if (upErr) {
        console.error(`  update failed for ${row.id}: ${upErr.message}`);
      } else {
        fixed++;
      }
    }
  }
  console.log(`Done. Checked ${checked}, normalized ${fixed}.`);
}

normalizeExisting().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
