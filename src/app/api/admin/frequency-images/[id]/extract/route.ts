// Extract Frequency Names from Reference Image
// Uses Vision API to identify text with red boxes

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractFrequencyNames } from '@/lib/vision'

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // 2 minutes for extraction

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/admin/frequency-images/[id]/extract - Extract frequency names from image
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id: imageId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get the image record
    const { data: image, error: imageError } = await supabase
      .from('frequency_reference_images')
      .select('*')
      .eq('id', imageId)
      .single()

    if (imageError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Update status to processing
    await supabase
      .from('frequency_reference_images')
      .update({ status: 'processing' })
      .eq('id', imageId)

    // Get file URL from storage
    const { data: urlData } = supabase.storage
      .from('diagnostics')
      .getPublicUrl(image.storage_path)

    if (!urlData?.publicUrl) {
      await supabase
        .from('frequency_reference_images')
        .update({
          status: 'error',
          error_message: 'Failed to get file URL',
        })
        .eq('id', imageId)

      return NextResponse.json({ error: 'Failed to get file URL' }, { status: 500 })
    }

    // Extract frequency names using Vision API
    const result = await extractFrequencyNames(urlData.publicUrl)

    if (!result.success) {
      await supabase
        .from('frequency_reference_images')
        .update({
          status: 'error',
          error_message: result.error || 'Extraction failed',
        })
        .eq('id', imageId)

      return NextResponse.json(
        { error: result.error || 'Extraction failed' },
        { status: 500 }
      )
    }

    // Get extracted names
    const extractedNames = (result.data as { names?: string[] }).names || []

    // Update image record with extracted names
    await supabase
      .from('frequency_reference_images')
      .update({
        status: 'extracted',
        extracted_names: extractedNames,
        extraction_confidence: result.confidence,
      })
      .eq('id', imageId)

    // Create approved_frequency_names records for each extracted name
    const insertedNames: string[] = []
    const skippedNames: string[] = []

    for (const name of extractedNames) {
      // Check if name already exists
      const { data: existing } = await supabase
        .from('approved_frequency_names')
        .select('id')
        .ilike('name', name)
        .single()

      if (existing) {
        skippedNames.push(name)
        continue
      }

      // Insert new approved frequency name
      const { error: insertError } = await supabase
        .from('approved_frequency_names')
        .insert({
          name,
          source_image_id: imageId,
          category: image.category,
          is_active: true,
          created_by: user.id,
        })

      if (!insertError) {
        insertedNames.push(name)
      } else {
        console.warn(`Failed to insert frequency name: ${name}`, insertError)
        skippedNames.push(name)
      }
    }

    // Log usage event
    await supabase.from('usage_events').insert({
      user_id: user.id,
      event_type: 'frequency_names_extracted' as never,
      metadata: {
        image_id: imageId,
        total_extracted: extractedNames.length,
        inserted_count: insertedNames.length,
        skipped_count: skippedNames.length,
        confidence: result.confidence,
      },
    })

    return NextResponse.json({
      message: 'Extraction complete',
      data: {
        imageId,
        totalExtracted: extractedNames.length,
        insertedNames,
        skippedNames,
        confidence: result.confidence,
      },
    })
  } catch (error) {
    console.error('Extraction error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
