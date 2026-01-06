// Diagnostic File Extraction API
// Uses Vision API to extract structured data from diagnostic images

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractDiagnosticValues } from '@/lib/vision'
import type { DiagnosticType } from '@/types/shared'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes for complex extractions

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/diagnostics/files/[id]/extract - Extract values from a diagnostic file
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id: fileId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the diagnostic file with upload info
    const { data: file, error: fileError } = await supabase
      .from('diagnostic_files')
      .select(
        `
        id,
        filename,
        file_type,
        mime_type,
        storage_path,
        status,
        upload_id,
        diagnostic_uploads!inner(user_id)
      `
      )
      .eq('id', fileId)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Verify ownership
    const diagnosticUploads = file.diagnostic_uploads as unknown as { user_id: string }
    const uploadUserId = diagnosticUploads.user_id
    if (uploadUserId !== user.id) {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Check if already extracted
    const { data: existing } = await supabase
      .from('diagnostic_extracted_values')
      .select('id, status, extracted_data')
      .eq('diagnostic_file_id', fileId)
      .single()

    if (existing && existing.status === 'complete') {
      return NextResponse.json({
        message: 'Values already extracted',
        data: {
          extractionId: existing.id,
          status: existing.status,
          extractedData: existing.extracted_data,
        },
      })
    }

    // Create or update extraction record
    let extractionId = existing?.id
    if (!extractionId) {
      const { data: newExtraction, error: createError } = await supabase
        .from('diagnostic_extracted_values')
        .insert({
          diagnostic_file_id: fileId,
          status: 'processing',
          extraction_method: 'vision_api',
          extraction_model: 'gpt-4o',
        })
        .select('id')
        .single()

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }
      extractionId = newExtraction?.id
    } else {
      await supabase
        .from('diagnostic_extracted_values')
        .update({ status: 'processing' })
        .eq('id', extractionId)
    }

    // Get file URL from Supabase Storage
    const { data: urlData } = supabase.storage
      .from('diagnostics')
      .getPublicUrl(file.storage_path)

    if (!urlData?.publicUrl) {
      await supabase
        .from('diagnostic_extracted_values')
        .update({
          status: 'error',
          error_message: 'Failed to get file URL from storage',
        })
        .eq('id', extractionId)

      return NextResponse.json({ error: 'Failed to get file URL' }, { status: 500 })
    }

    // Perform extraction based on file type
    const result = await extractDiagnosticValues(
      urlData.publicUrl,
      file.file_type as DiagnosticType,
      file.mime_type
    )

    // Determine status based on confidence
    const CONFIDENCE_THRESHOLD = 0.7
    const status = !result.success
      ? 'error'
      : result.confidence < CONFIDENCE_THRESHOLD
        ? 'needs_review'
        : 'complete'

    // Update extraction record with results
    const { error: updateError } = await supabase
      .from('diagnostic_extracted_values')
      .update({
        extracted_data: result.data,
        extraction_confidence: result.confidence,
        raw_response: { response: result.rawResponse },
        status,
        error_message: result.error || null,
      })
      .eq('id', extractionId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Mark file as processed
    await supabase.from('diagnostic_files').update({ status: 'processed' }).eq('id', fileId)

    // Log usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'diagnostic_extraction_completed' as never, // Type will be updated by migration
      metadata: {
        file_id: fileId,
        file_type: file.file_type,
        extraction_confidence: result.confidence,
        status,
      },
    })

    return NextResponse.json({
      message: result.success ? 'Extraction complete' : 'Extraction failed',
      data: {
        extractionId,
        fileId,
        fileType: file.file_type,
        extractedData: result.data,
        confidence: result.confidence,
        status,
        needsReview: status === 'needs_review',
      },
    })
  } catch (error) {
    console.error('Extraction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/diagnostics/files/[id]/extract - Get extraction status/results
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: fileId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get extraction record
    const { data: extraction, error } = await supabase
      .from('diagnostic_extracted_values')
      .select(
        `
        id,
        extracted_data,
        extraction_confidence,
        extraction_method,
        status,
        error_message,
        created_at,
        updated_at,
        diagnostic_files!inner(
          id,
          filename,
          file_type,
          diagnostic_uploads!inner(user_id)
        )
      `
      )
      .eq('diagnostic_file_id', fileId)
      .single()

    if (error || !extraction) {
      return NextResponse.json(
        { error: 'Extraction not found', status: 'not_extracted' },
        { status: 404 }
      )
    }

    // Type assertion for nested data
    const diagnosticFiles = extraction.diagnostic_files as unknown as {
      id: string
      filename: string
      file_type: string
      diagnostic_uploads: { user_id: string }
    }

    // Verify ownership
    if (diagnosticFiles.diagnostic_uploads.user_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    return NextResponse.json({
      data: {
        extractionId: extraction.id,
        fileId,
        fileName: diagnosticFiles.filename,
        fileType: diagnosticFiles.file_type,
        extractedData: extraction.extracted_data,
        confidence: extraction.extraction_confidence,
        status: extraction.status,
        errorMessage: extraction.error_message,
        createdAt: extraction.created_at,
        updatedAt: extraction.updated_at,
      },
    })
  } catch (error) {
    console.error('Get extraction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
