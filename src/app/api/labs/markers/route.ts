import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { labMarkers, getMarkersByCategory, findMarker } from '@/data/lab-data';
import type { LabCategory } from '@/types/labs';
export const dynamic = 'force-dynamic'

// GET /api/labs/markers - List all markers
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as LabCategory | null;
    const gender = searchParams.get('gender') as 'male' | 'female' | null;
    const ageStr = searchParams.get('age');
    const age = ageStr ? parseInt(ageStr, 10) : undefined;

    let markers = labMarkers;

    // Filter by category if provided
    if (category) {
      markers = getMarkersByCategory(category, gender || undefined, age);
    } else if (gender || age !== undefined) {
      // Filter by gender/age if provided
      markers = markers.filter((marker) => {
        if (marker.gender && gender && marker.gender !== gender) {
          return false;
        }
        if (marker.ageMin !== undefined && age !== undefined && age < marker.ageMin) {
          return false;
        }
        if (marker.ageMax !== undefined && age !== undefined && age > marker.ageMax) {
          return false;
        }
        return true;
      });
    }

    return NextResponse.json({ markers });
  } catch (error) {
    console.error('Error fetching markers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markers' },
      { status: 500 }
    );
  }
}
