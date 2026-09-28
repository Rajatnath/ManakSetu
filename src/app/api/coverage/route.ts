import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildCoverage } from '@/lib/coverage/buildCoverage';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenderId = searchParams.get('tenderId');
    if (!tenderId) return NextResponse.json({ error: 'Missing tenderId' }, { status: 400 });
    const coverage = await buildCoverage(supabase, tenderId);
    return NextResponse.json({ coverage });
  } catch (err: any) {
    console.error('Coverage API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
