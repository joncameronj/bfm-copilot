import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { LabFormValues, LabCalculationResult } from '@/types/labs';
export const dynamic = 'force-dynamic'

// GET /api/labs/results - List lab results
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    let query = supabase
      .from('lab_results')
      .select(`
        *,
        lab_values (*)
      `)
      .eq('user_id', user.id)
      .order('test_date', { ascending: false });

    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ results: data });
  } catch (error) {
    console.error('Error fetching lab results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab results' },
      { status: 500 }
    );
  }
}

// POST /api/labs/results - Save lab result
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      patientId,
      result,
      values,
      testDate,
      notes,
      isComplete = true,
      missingMarkers = [],
      sourceType = 'manual',
      extractionConfidence,
    } = body as {
      patientId?: string;
      result: LabCalculationResult;
      values: LabFormValues;
      testDate?: string;
      notes?: string;
      isComplete?: boolean;
      missingMarkers?: string[];
      sourceType?: 'manual' | 'pdf_upload' | 'imported';
      extractionConfidence?: number;
    };

    // Validate input
    if (!result || !values) {
      return NextResponse.json(
        { error: 'Result and values are required' },
        { status: 400 }
      );
    }

    // Create lab result record
    const { data: labResult, error: labResultError } = await supabase
      .from('lab_results')
      .insert({
        user_id: user.id,
        patient_id: patientId || null,
        test_date: testDate || new Date().toISOString().split('T')[0],
        ominous_count: result.ominousCount,
        ominous_markers_triggered: result.ominousMarkersTriggered,
        notes: notes || null,
        is_complete: isComplete,
        missing_markers: missingMarkers,
        source_type: sourceType,
        extraction_confidence: extractionConfidence || null,
      })
      .select()
      .single();

    if (labResultError) {
      throw labResultError;
    }

    // Create lab value records
    const labValues = result.results.map((r) => ({
      lab_result_id: labResult.id,
      marker_id: r.markerId,
      value: r.value,
      evaluation: r.evaluation,
      delta_from_target: r.delta,
      weakness_text: r.weaknessText,
      is_ominous: r.isOminous,
    }));

    if (labValues.length > 0) {
      const { error: valuesError } = await supabase
        .from('lab_values')
        .insert(labValues);

      if (valuesError) {
        // Rollback lab result if values fail
        await supabase.from('lab_results').delete().eq('id', labResult.id);
        throw valuesError;
      }
    }

    // Track usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'lab_analysis',
      metadata: {
        patient_id: patientId,
        markers_count: result.results.length,
        ominous_count: result.ominousCount,
        has_ominous_alert: result.hasOminousAlert,
      },
    });

    return NextResponse.json({
      success: true,
      labResult: {
        ...labResult,
        values: labValues,
      },
    });
  } catch (error) {
    console.error('Error saving lab result:', error);
    return NextResponse.json(
      { error: 'Failed to save lab result' },
      { status: 500 }
    );
  }
}
