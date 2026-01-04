import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LAB_CATEGORIES } from '@/lib/labs/categories';
export const dynamic = 'force-dynamic'

// GET /api/labs/categories - List all categories
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ categories: LAB_CATEGORIES });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
