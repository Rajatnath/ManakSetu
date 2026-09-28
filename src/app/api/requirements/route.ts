import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { splitValueUnit } from '@/lib/requirements/normalize';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EDITABLE_FIELDS = ['category', 'requirement', 'value', 'unit'] as const;

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing requirement id' }, { status: 400 });
    }

    const updates: Record<string, string | null> = {};
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        const v = typeof body[field] === 'string' ? body[field].trim() : body[field];
        updates[field] = v === '' ? null : v;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
    }

    if (updates.requirement !== undefined && !updates.requirement) {
      return NextResponse.json({ error: 'Requirement name cannot be empty' }, { status: 400 });
    }

    // Normalize the value/unit pair against the stored row so edited values
    // never duplicate the unit (e.g. value "25 MPa" + unit "MPa" → "25" + "MPa")
    if (updates.value !== undefined || updates.unit !== undefined) {
      const { data: current } = await supabase
        .from('tender_requirements')
        .select('value, unit')
        .eq('id', id)
        .maybeSingle();
      const merged = splitValueUnit(
        updates.value !== undefined ? updates.value : current?.value ?? null,
        updates.unit !== undefined ? updates.unit : current?.unit ?? null
      );
      updates.value = merged.value || null;
      updates.unit = merged.unit;
    }

    const { data, error } = await supabase
      .from('tender_requirements')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(`Update failed: ${error.message}`);
    if (!data) return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });

    return NextResponse.json({ requirement: data });
  } catch (err: any) {
    console.error('Requirements PATCH Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
