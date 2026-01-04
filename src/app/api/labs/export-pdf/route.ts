import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { LabResultPdf } from '@/components/labs/LabResultPdf';
import { labMarkers } from '@/data/lab-data';
import { LAB_CATEGORIES } from '@/lib/labs/categories';
export const dynamic = 'force-dynamic'

interface ExportRequest {
  labResultId?: string;
  patientName?: string;
  testDate?: string;
  results?: {
    markerId: string;
    value: number;
    evaluation: string | null;
    deltaFromTarget: number | null;
  }[];
  ominousCount?: number;
  ominousMarkers?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ExportRequest = await request.json();

    let labData;

    // If labResultId is provided, fetch from database
    if (body.labResultId) {
      const { data: labResult, error } = await supabase
        .from('lab_results')
        .select(
          `
          *,
          lab_values (*),
          patients (
            first_name,
            last_name,
            date_of_birth,
            gender
          )
        `
        )
        .eq('id', body.labResultId)
        .eq('user_id', user.id)
        .single();

      if (error || !labResult) {
        return NextResponse.json({ error: 'Lab result not found' }, { status: 404 });
      }

      // Transform database result
      const patient = Array.isArray(labResult.patients)
        ? labResult.patients[0]
        : labResult.patients;

      labData = {
        patientName: patient
          ? `${patient.first_name} ${patient.last_name}`
          : 'Unknown Patient',
        testDate: labResult.test_date,
        ominousCount: labResult.ominous_count,
        ominousMarkers: labResult.ominous_markers_triggered || [],
        results: labResult.lab_values.map(
          (v: {
            marker_id: string;
            value: number;
            evaluation: string | null;
            delta_from_target: number | null;
          }) => {
            const marker = labMarkers.find((m) => m.id === v.marker_id);
            const category = LAB_CATEGORIES.find((c) => c.id === marker?.category);
            return {
              markerName: marker?.displayName || v.marker_id,
              categoryName: category?.name || 'Other',
              value: v.value,
              unit: marker?.unit || '',
              targetRange: marker?.targetRange || '',
              evaluation: v.evaluation,
              deltaFromTarget: v.delta_from_target,
            };
          }
        ),
      };
    } else if (body.results) {
      // Use provided results directly
      labData = {
        patientName: body.patientName || 'Unknown Patient',
        testDate: body.testDate || new Date().toISOString().split('T')[0],
        ominousCount: body.ominousCount || 0,
        ominousMarkers: body.ominousMarkers || [],
        results: body.results.map((r) => {
          const marker = labMarkers.find((m) => m.id === r.markerId);
          const category = LAB_CATEGORIES.find((c) => c.id === marker?.category);
          return {
            markerName: marker?.displayName || r.markerId,
            categoryName: category?.name || 'Other',
            value: r.value,
            unit: marker?.unit || '',
            targetRange: marker?.targetRange || '',
            evaluation: r.evaluation,
            deltaFromTarget: r.deltaFromTarget,
          };
        }),
      };
    } else {
      return NextResponse.json(
        { error: 'Either labResultId or results must be provided' },
        { status: 400 }
      );
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(LabResultPdf({ data: labData }));

    // Return PDF as response
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="lab-results-${labData.testDate}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
