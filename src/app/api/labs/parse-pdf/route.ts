import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPythonAgentUrl } from '@/lib/agent/url';
export const dynamic = 'force-dynamic'

// Accepted file types
const ACCEPTED_TYPES = {
  pdf: ['application/pdf'],
  image: ['image/jpeg', 'image/jpg', 'image/png'],
};

// File extensions for fallback detection
const FILE_EXTENSIONS = {
  pdf: ['.pdf'],
  image: ['.jpg', '.jpeg', '.png'],
};

function detectFileType(file: File): 'pdf' | 'image' | null {
  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  // Check by MIME type first
  if (ACCEPTED_TYPES.pdf.some((t) => mimeType.includes(t))) {
    return 'pdf';
  }
  if (ACCEPTED_TYPES.image.some((t) => mimeType.includes(t))) {
    return 'image';
  }

  // Fallback to extension
  if (FILE_EXTENSIONS.pdf.some((ext) => fileName.endsWith(ext))) {
    return 'pdf';
  }
  if (FILE_EXTENSIONS.image.some((ext) => fileName.endsWith(ext))) {
    return 'image';
  }

  return null;
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Detect and validate file type
    const fileType = detectFileType(file);
    if (!fileType) {
      return NextResponse.json(
        { error: 'Only PDF, JPEG, JPG, and PNG files are accepted' },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 50MB' },
        { status: 400 }
      );
    }

    // Forward to Python agent for extraction
    const agentUrl = getPythonAgentUrl();
    const agentForm = new FormData();
    agentForm.append('file', file);
    agentForm.append('user_id', user.id);

    const agentResponse = await fetch(`${agentUrl}/agent/labs/extract`, {
      method: 'POST',
      body: agentForm,
    });

    if (!agentResponse.ok) {
      const errorData = await agentResponse.json().catch(() => null);
      const errorMsg = errorData?.detail || `Python agent returned ${agentResponse.status}`;
      console.error('Lab extraction failed:', errorMsg);
      return NextResponse.json({ error: errorMsg }, { status: agentResponse.status });
    }

    const result = await agentResponse.json();

    if (!result.success) {
      return NextResponse.json(
        { error: result.warnings?.[0] || 'Could not extract lab values from this file.' },
        { status: 422 }
      );
    }

    // Map to frontend-expected format (markerName, markerId, value, unit, confidence)
    const { matchedValues, unmatchedCount } = mapToFrontendFormat(result.values);

    return NextResponse.json({
      success: true,
      values: matchedValues,
      unmatchedCount,
      warnings: (result.warnings || []).slice(0, 10),
      extractionMethod: 'vision',
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.constructor.name : 'Unknown';
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Lab file parse error [${errorName}]:`, errorMsg);
    return NextResponse.json(
      { error: `Failed to parse lab file: ${errorMsg}` },
      { status: 500 }
    );
  }
}

/**
 * Map Python agent response values to the format the frontend PdfUpload component expects.
 * The frontend needs { markerName, markerId, value, unit, confidence }.
 */
function mapToFrontendFormat(values: Array<{
  markerName: string;
  value: number;
  unit: string | null;
  rawName?: string;
  flag?: string | null;
}>) {
  // Lazy-import lab markers to match by name
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { labMarkers } = require('@/data/lab-data');

  const matched: Array<{
    markerName: string;
    markerId: string | null;
    value: number;
    unit: string | null;
    confidence: number;
  }> = [];

  let unmatchedCount = 0;
  const seenIds = new Set<string>();

  for (const v of values) {
    const marker = findMarker(v.markerName, labMarkers);
    if (marker && !seenIds.has(marker.id)) {
      seenIds.add(marker.id);
      matched.push({
        markerName: marker.displayName,
        markerId: marker.id,
        value: v.value,
        unit: v.unit,
        confidence: 0.85,
      });
    } else if (!marker) {
      unmatchedCount++;
    }
  }

  return { matchedValues: matched, unmatchedCount };
}

function findMarker(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labMarkers: Array<{ id: string; name: string; displayName: string }>
) {
  const lower = name.toLowerCase().trim();
  // Direct match
  for (const m of labMarkers) {
    if (m.displayName.toLowerCase() === lower || m.name.toLowerCase() === lower) {
      return m;
    }
  }
  // Partial match
  for (const m of labMarkers) {
    if (lower.includes(m.displayName.toLowerCase()) || m.displayName.toLowerCase().includes(lower)) {
      return m;
    }
  }
  return null;
}
