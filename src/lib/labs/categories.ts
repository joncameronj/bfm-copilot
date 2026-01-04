import type { CategoryInfo, LabCategory } from '@/types/labs';

// Re-export CategoryInfo for convenience
export type { CategoryInfo };

export const LAB_CATEGORIES: CategoryInfo[] = [
  { id: 'cardiac', name: 'Cardiac Function', order: 1 },
  { id: 'inflammation', name: 'Inflammation', order: 2 },
  { id: 'anemia', name: 'Anemia', order: 3 },
  { id: 'lipids', name: 'Lipids', order: 4 },
  { id: 'diabetes', name: 'Diabetes & Weight Management', order: 5 },
  { id: 'bone_mineral', name: 'Calcium, Bone & Mineral Health', order: 6 },
  { id: 'renal', name: 'Renal', order: 7 },
  { id: 'hepatic', name: 'Hepatic', order: 8 },
  { id: 'thyroid', name: 'Thyroid', order: 9 },
  { id: 'hormones', name: 'Hormones', order: 10 },
  { id: 'cbc', name: 'CBC with Differential', order: 11 },
] as const;

export function getCategoryName(categoryId: LabCategory): string {
  const category = LAB_CATEGORIES.find((c) => c.id === categoryId);
  return category?.name || categoryId;
}

export function getCategoryOrder(categoryId: LabCategory): number {
  const category = LAB_CATEGORIES.find((c) => c.id === categoryId);
  return category?.order || 99;
}
