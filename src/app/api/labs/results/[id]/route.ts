import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic'

// GET /api/labs/results/[id] - Get a specific lab result
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('lab_results')
      .select(`
        *,
        lab_values (*),
        patients (
          id,
          first_name,
          last_name,
          date_of_birth,
          gender
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Lab result not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ result: data });
  } catch (error) {
    console.error('Error fetching lab result:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab result' },
      { status: 500 }
    );
  }
}

// PUT /api/labs/results/[id] - Update a lab result
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notes, testDate } = body;

    const updates: Record<string, unknown> = {};
    if (notes !== undefined) updates.notes = notes;
    if (testDate) updates.test_date = testDate;

    const { data, error } = await supabase
      .from('lab_results')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Lab result not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ result: data });
  } catch (error) {
    console.error('Error updating lab result:', error);
    return NextResponse.json(
      { error: 'Failed to update lab result' },
      { status: 500 }
    );
  }
}

// DELETE /api/labs/results/[id] - Delete a lab result
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First delete lab values (cascade should handle this, but being explicit)
    await supabase.from('lab_values').delete().eq('lab_result_id', id);

    // Then delete the lab result
    const { error } = await supabase
      .from('lab_results')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lab result:', error);
    return NextResponse.json(
      { error: 'Failed to delete lab result' },
      { status: 500 }
    );
  }
}
