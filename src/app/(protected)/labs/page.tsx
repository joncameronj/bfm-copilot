import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LabCalculatorClient } from './LabCalculatorClient';

export const metadata: Metadata = {
  title: 'Labs Clarity Calculator | Clinic Copilot',
  description: 'Analyze lab results with gender and age-specific optimal ranges',
};

export default async function LabsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get recent lab results
  const { data: recentResults } = await supabase
    .from('lab_results')
    .select(`
      id,
      test_date,
      ominous_count,
      patients (
        first_name,
        last_name
      )
    `)
    .eq('user_id', user.id)
    .order('test_date', { ascending: false })
    .limit(5);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-[-0.05em] text-neutral-900 dark:text-neutral-50">Labs</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Analyze lab results with optimal ranges</p>
        </div>
        <LabCalculatorClient
          recentResults={recentResults || []}
        />
      </div>
    </div>
  );
}
