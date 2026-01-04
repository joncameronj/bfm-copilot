import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateLabResults } from '@/lib/labs/calculator';
import type { PatientContext, LabFormValues } from '@/types/labs';
export const dynamic = 'force-dynamic'

// POST /api/labs/calculate - Calculate lab results
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { values, context } = body as {
      values: LabFormValues;
      context: PatientContext;
    };

    // Validate input
    if (!values || typeof values !== 'object') {
      return NextResponse.json(
        { error: 'Values object is required' },
        { status: 400 }
      );
    }

    if (!context || !context.gender || context.age === undefined) {
      return NextResponse.json(
        { error: 'Patient context (gender, age) is required' },
        { status: 400 }
      );
    }

    // Perform calculation
    const results = calculateLabResults(values, context);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error calculating lab results:', error);
    return NextResponse.json(
      { error: 'Failed to calculate lab results' },
      { status: 500 }
    );
  }
}
