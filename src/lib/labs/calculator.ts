import type {
  LabMarker,
  LabCategory,
  PatientContext,
  MarkerResult,
  LabCalculationResult,
  LabFormValues,
} from '@/types/labs';
import { labMarkers, ominousMarkers, findMarker, getMarkersByCategory } from '@/data/lab-data';
import { evaluateMarkerValue } from '@/data/evaluation-rules';
import { LAB_CATEGORIES } from './categories';

/**
 * Calculate the delta from target range
 */
function calculateDelta(
  value: number,
  marker: LabMarker
): number | null {
  const targetRange = marker.targetRange;

  // Parse the target range
  if (targetRange.includes(' - ')) {
    // Range like "85 - 130"
    const [min, max] = targetRange.split(' - ').map((v) => parseFloat(v.trim()));
    if (!isNaN(min) && !isNaN(max)) {
      const midpoint = (min + max) / 2;
      return parseFloat((value - midpoint).toFixed(2));
    }
  } else if (targetRange.startsWith('<')) {
    // Less than range like "<125"
    const threshold = parseFloat(targetRange.replace(/[<>=]/g, '').trim());
    if (!isNaN(threshold)) {
      if (value < threshold) return 0;
      return parseFloat((value - threshold).toFixed(2));
    }
  } else if (targetRange.startsWith('>')) {
    // Greater than range like ">44"
    const threshold = parseFloat(targetRange.replace(/[<>=]/g, '').trim());
    if (!isNaN(threshold)) {
      if (value > threshold) return 0;
      return parseFloat((threshold - value).toFixed(2));
    }
  } else if (targetRange.includes('–') || targetRange.includes('-')) {
    // Handle different dash characters
    const parts = targetRange.split(/[–-]/).map((v) => parseFloat(v.replace(/[^0-9.]/g, '')));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const midpoint = (parts[0] + parts[1]) / 2;
      return parseFloat((value - midpoint).toFixed(2));
    }
  }

  return null;
}

/**
 * Check if a marker triggers an ominous alert
 */
function checkOminousMarker(
  markerId: string,
  value: number,
  allValues: LabFormValues,
  context: PatientContext
): { isOminous: boolean; markerName: string | null } {
  // Albumin below 4.0
  if (markerId === 'albumin' && value < 4.0) {
    return { isOminous: true, markerName: 'Albumin below 4.0' };
  }

  // Calcium/Albumin ratio above 2.7
  if (markerId === 'calcium') {
    const albumin = allValues['albumin'];
    if (albumin && albumin > 0) {
      const ratio = value / albumin;
      if (ratio > 2.7) {
        return { isOminous: true, markerName: 'Calcium/Albumin ratio above 2.7' };
      }
    }
  }

  // Albumin/Globulin ratio below 1
  // Globulin = Total Protein - Albumin
  if (markerId === 'albumin') {
    const totalProtein = allValues['total-protein'];
    if (totalProtein) {
      const globulin = totalProtein - value;
      if (globulin > 0) {
        const ratio = value / globulin;
        if (ratio < 1) {
          return { isOminous: true, markerName: 'Albumin/Globulin ratio below 1' };
        }
      }
    }
  }

  // Absolute Lymphocytes below 1,500 (1.5 K/µL)
  if (markerId === 'absolute-lymphocytes' && value < 1.5) {
    return { isOminous: true, markerName: 'Absolute Lymphocytes below 1,500' };
  }

  // Lymphocytes % below 20
  if (markerId === 'lymphocytes' && value < 20) {
    return { isOminous: true, markerName: 'Lymphocytes % below 20' };
  }

  // Total cholesterol below 150 (fasting)
  const cholesterolMarkers = [
    'total-cholesterol-male-18-34',
    'total-cholesterol-male-35-plus',
    'total-cholesterol-female-18-34',
    'total-cholesterol-female-35-44',
    'total-cholesterol-female-45-plus',
  ];
  if (cholesterolMarkers.includes(markerId) && value < 150) {
    return { isOminous: true, markerName: 'Total cholesterol below 150' };
  }

  // Platelets below 150
  if (markerId === 'platelets' && value < 150) {
    return { isOminous: true, markerName: 'Platelets below 150' };
  }

  return { isOminous: false, markerName: null };
}

/**
 * Find the appropriate marker for a given context
 */
function findApplicableMarker(
  markerId: string,
  context: PatientContext
): LabMarker | undefined {
  // First try exact match
  let marker = labMarkers.find((m) => m.id === markerId);
  if (marker) {
    // Check if marker applies to this context
    if (marker.gender && marker.gender !== context.gender) {
      // Try to find gender-specific version
      const genderSuffix = context.gender;
      const genderMarkerId = `${markerId.replace(/-male|-female/g, '')}-${genderSuffix}`;
      marker = labMarkers.find((m) => m.id === genderMarkerId);
    }
    if (marker?.ageMin !== undefined && context.age < marker.ageMin) {
      return undefined;
    }
    if (marker?.ageMax !== undefined && context.age > marker.ageMax) {
      return undefined;
    }
  }
  return marker;
}

/**
 * Main calculation function
 */
export function calculateLabResults(
  values: LabFormValues,
  context: PatientContext
): LabCalculationResult {
  const results: MarkerResult[] = [];
  const ominousTriggered: string[] = [];
  const categorizedResults: Record<LabCategory, MarkerResult[]> = {
    cardiac: [],
    inflammation: [],
    anemia: [],
    lipids: [],
    diabetes: [],
    bone_mineral: [],
    renal: [],
    hepatic: [],
    thyroid: [],
    hormones: [],
    cbc: [],
  };

  // Process each value
  for (const [markerId, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;

    const marker = findApplicableMarker(markerId, context);
    if (!marker) continue;

    // Evaluate the value
    const evaluation = evaluateMarkerValue(
      markerId,
      value,
      context.gender,
      context.age
    );

    // Calculate delta
    const delta = calculateDelta(value, marker);

    // Check for ominous marker
    const ominousCheck = checkOminousMarker(markerId, value, values, context);
    if (ominousCheck.isOminous && ominousCheck.markerName) {
      if (!ominousTriggered.includes(ominousCheck.markerName)) {
        ominousTriggered.push(ominousCheck.markerName);
      }
    }

    const result: MarkerResult = {
      markerId: marker.id,
      markerName: marker.name,
      displayName: marker.displayName,
      category: marker.category,
      value,
      targetRange: marker.targetRange,
      delta,
      evaluation: evaluation?.evaluation || null,
      weaknessText: evaluation?.weaknessText || null,
      description: marker.description,
      isOminous: ominousCheck.isOminous,
      isFlagged: evaluation?.evaluation !== 'normal',
      unit: marker.unit,
    };

    results.push(result);
    categorizedResults[marker.category].push(result);
  }

  // Sort results within each category
  for (const category of LAB_CATEGORIES) {
    categorizedResults[category.id].sort((a, b) => {
      const markerA = labMarkers.find((m) => m.id === a.markerId);
      const markerB = labMarkers.find((m) => m.id === b.markerId);
      return (markerA?.displayOrder || 0) - (markerB?.displayOrder || 0);
    });
  }

  return {
    results,
    ominousCount: ominousTriggered.length,
    ominousMarkersTriggered: ominousTriggered,
    hasOminousAlert: ominousTriggered.length >= 3,
    categorizedResults,
    patientContext: context,
    calculatedAt: new Date(),
  };
}

/**
 * Get all markers applicable for a patient context
 */
export function getApplicableMarkers(context: PatientContext): LabMarker[] {
  return labMarkers.filter((marker) => {
    // Filter by gender if marker is gender-specific
    if (marker.gender && marker.gender !== context.gender) {
      return false;
    }

    // Filter by age if marker has age restrictions
    if (marker.ageMin !== undefined && context.age < marker.ageMin) {
      return false;
    }
    if (marker.ageMax !== undefined && context.age > marker.ageMax) {
      return false;
    }

    return true;
  });
}

/**
 * Get markers by category filtered for patient context
 */
export function getApplicableMarkersByCategory(
  context: PatientContext
): Record<LabCategory, LabMarker[]> {
  const result: Record<LabCategory, LabMarker[]> = {
    cardiac: [],
    inflammation: [],
    anemia: [],
    lipids: [],
    diabetes: [],
    bone_mineral: [],
    renal: [],
    hepatic: [],
    thyroid: [],
    hormones: [],
    cbc: [],
  };

  for (const category of LAB_CATEGORIES) {
    result[category.id] = getMarkersByCategory(
      category.id,
      context.gender,
      context.age
    );
  }

  return result;
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date | string): number {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

/**
 * Parse a range string to get min/max values
 */
export function parseRangeString(rangeStr: string): { min: number | null; max: number | null; type: 'between' | 'less_than' | 'greater_than' } {
  const trimmed = rangeStr.trim();

  if (trimmed.startsWith('<')) {
    const max = parseFloat(trimmed.replace(/[<>=\s]/g, ''));
    return { min: null, max: isNaN(max) ? null : max, type: 'less_than' };
  }

  if (trimmed.startsWith('>')) {
    const min = parseFloat(trimmed.replace(/[<>=\s]/g, ''));
    return { min: isNaN(min) ? null : min, max: null, type: 'greater_than' };
  }

  // Handle range with dash
  const parts = trimmed.split(/\s*[-–]\s*/).map((p) => parseFloat(p.replace(/[^0-9.]/g, '')));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1], type: 'between' };
  }

  // Single value
  const single = parseFloat(trimmed);
  if (!isNaN(single)) {
    return { min: single, max: single, type: 'between' };
  }

  return { min: null, max: null, type: 'between' };
}

/**
 * Format a result for display
 */
export function formatResultForDisplay(result: MarkerResult): {
  statusColor: string;
  statusLabel: string;
  bgColor: string;
} {
  switch (result.evaluation) {
    case 'low':
      return {
        statusColor: 'text-blue-800',
        statusLabel: 'Low',
        bgColor: 'bg-blue-50',
      };
    case 'normal':
      return {
        statusColor: 'text-green-800',
        statusLabel: 'Normal',
        bgColor: 'bg-green-50',
      };
    case 'moderate':
      return {
        statusColor: 'text-yellow-800',
        statusLabel: 'Moderate',
        bgColor: 'bg-yellow-50',
      };
    case 'high':
      return {
        statusColor: 'text-red-800',
        statusLabel: 'High',
        bgColor: 'bg-red-50',
      };
    default:
      return {
        statusColor: 'text-neutral-600',
        statusLabel: 'Pending',
        bgColor: 'bg-neutral-100',
      };
  }
}
