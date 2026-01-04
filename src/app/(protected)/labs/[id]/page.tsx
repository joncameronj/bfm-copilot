import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { LabResultDetail } from './LabResultDetail';

export const metadata: Metadata = {
  title: 'Lab Result Details | Clinic Copilot',
  description: 'View detailed lab result analysis',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LabResultPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch the lab result with values and patient info
  const { data: labResult, error } = await supabase
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

  if (error || !labResult) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="p-6">
        <LabResultDetail labResult={labResult} />
      </div>
    </div>
  );
}
