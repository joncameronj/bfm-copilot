import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseLabPdf } from '@/lib/labs/pdf-parser';
export const dynamic = 'force-dynamic'
// eslint-disable-next-line
const pdf = require('pdf-parse');

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

    // Validate file type
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are accepted' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    const pdfData = await pdf(buffer);

    // Extract lab values from text
    const parseResult = await parseLabPdf(pdfData.text);

    // Return parsed values
    return NextResponse.json({
      success: parseResult.success,
      values: parseResult.values.filter((v) => v.markerId !== null), // Only return matched markers
      unmatchedCount: parseResult.values.filter((v) => v.markerId === null).length,
      warnings: parseResult.warnings.slice(0, 10), // Limit warnings
      pageCount: pdfData.numpages,
    });
  } catch (error) {
    console.error('PDF parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse PDF' },
      { status: 500 }
    );
  }
}
