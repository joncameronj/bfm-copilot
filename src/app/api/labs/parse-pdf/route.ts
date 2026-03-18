import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseLabPdf } from '@/lib/labs/pdf-parser';
import { extractLabPanelVision } from '@/lib/labs/vision-extractor';
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

    // Validate file size (max 50MB for images, matching diagnostics)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 50MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let parseResult;
    let pageCount = 1;

    if (fileType === 'pdf') {
      // PDF: Use text extraction
      try {
        const pdf = require('pdf-parse');
        const pdfData = await pdf(buffer);
        parseResult = await parseLabPdf(pdfData.text);
        pageCount = pdfData.numpages;
      } catch (pdfError) {
        console.error('PDF parsing failed:', pdfError);
        const errorMsg = pdfError instanceof Error ? pdfError.message : String(pdfError);
        // DOMMatrix / canvas errors are environment issues with pdf-parse
        if (errorMsg.includes('DOMMatrix') || errorMsg.includes('canvas') || errorMsg.includes('is not defined')) {
          return NextResponse.json(
            { error: 'PDF text extraction is not available in this environment. Please upload your lab report as a JPG or PNG image instead.' },
            { status: 422 }
          );
        }
        return NextResponse.json(
          { error: `Failed to parse PDF: ${errorMsg}` },
          { status: 422 }
        );
      }
    } else {
      // Image: Use Vision API extraction
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json(
          { error: 'Vision API is not configured. Please contact support.' },
          { status: 503 }
        );
      }

      const base64 = buffer.toString('base64');
      const mimeType = file.type || 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${base64}`;

      parseResult = await extractLabPanelVision(dataUrl);

      if (!parseResult.success) {
        return NextResponse.json(
          { error: parseResult.warnings?.[0] || 'Could not extract lab values from this image. Please ensure the image is clear and contains lab results.' },
          { status: 422 }
        );
      }
    }

    // Return parsed values
    return NextResponse.json({
      success: parseResult.success,
      values: parseResult.values.filter((v) => v.markerId !== null), // Only return matched markers
      unmatchedCount: parseResult.values.filter((v) => v.markerId === null).length,
      warnings: parseResult.warnings.slice(0, 10), // Limit warnings
      pageCount,
      extractionMethod: fileType === 'pdf' ? 'text' : 'vision',
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.constructor.name : 'Unknown';
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Lab file parse error [${errorName}]:`, errorMsg);
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    return NextResponse.json(
      { error: `Failed to parse lab file: ${errorMsg}` },
      { status: 500 }
    );
  }
}
