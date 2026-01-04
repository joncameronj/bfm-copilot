// Lab Category types
export type LabCategory =
  | 'cardiac'
  | 'inflammation'
  | 'anemia'
  | 'lipids'
  | 'diabetes'
  | 'bone_mineral'
  | 'renal'
  | 'hepatic'
  | 'thyroid'
  | 'hormones'
  | 'cbc';

export interface CategoryInfo {
  id: LabCategory;
  name: string;
  order: number;
}

// Core marker type
export interface LabMarker {
  id: string;
  name: string;
  displayName: string;
  category: LabCategory;
  unit: string | null;
  description: string;
  displayOrder: number;
  targetRange: string;
  gender?: 'male' | 'female' | 'all';
  ageMin?: number;
  ageMax?: number;
}

// Target range for a marker
export interface TargetRange {
  id: string;
  markerId: string;
  gender: 'male' | 'female' | 'all' | null;
  ageMin: number | null;
  ageMax: number | null;
  rangeMin: number | null;
  rangeMax: number | null;
  rangeType: 'between' | 'less_than' | 'greater_than';
  displayRange: string;
}

// Evaluation rule for determining status
export interface EvaluationRule {
  id: string;
  markerId: string;
  markerName: string;
  evaluation: 'low' | 'normal' | 'moderate' | 'high';
  valueThreshold: number | null;
  comparison: 'lt' | 'lte' | 'gt' | 'gte' | 'between' | null;
  valueMin: number | null;
  valueMax: number | null;
  gender: 'male' | 'female' | 'all' | null;
  ageMin: number | null;
  ageMax: number | null;
  highlight: boolean;
  weaknessText: string | null;
  displayOrder: number;
}

// Ominous marker definition
export interface OminousMarker {
  id: string;
  name: string;
  testName: string;
  threshold: number;
  direction: 'above' | 'below';
  description: string;
}

// Patient context for calculations
export interface PatientContext {
  gender: 'male' | 'female';
  age: number;
  dateOfBirth?: Date;
}

// Individual marker result after calculation
export interface MarkerResult {
  markerId: string;
  markerName: string;
  displayName: string;
  category: LabCategory;
  value: number | null;
  targetRange: string;
  delta: number | null;
  evaluation: 'low' | 'normal' | 'moderate' | 'high' | null;
  weaknessText: string | null;
  description: string;
  isOminous: boolean;
  isFlagged: boolean;
  unit: string | null;
}

// Complete lab calculation result
export interface LabCalculationResult {
  results: MarkerResult[];
  ominousCount: number;
  ominousMarkersTriggered: string[];
  hasOminousAlert: boolean;
  categorizedResults: Record<LabCategory, MarkerResult[]>;
  patientContext: PatientContext;
  calculatedAt: Date;
}

// For saving to database
export interface LabResult {
  id: string;
  patientId: string;
  userId: string;
  testDate: Date;
  ominousCount: number;
  ominousMarkersTriggered: string[];
  notes?: string;
  sourceFileUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LabValue {
  id: string;
  labResultId: string;
  markerId: string;
  value: number;
  evaluation: string | null;
  deltaFromTarget: number | null;
  weaknessText: string | null;
  isOminous: boolean;
  createdAt: Date;
}

// Form state
export interface LabFormValues {
  [markerId: string]: number | null;
}
