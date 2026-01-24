-- Migration: Add Admin RLS Policy for Feedback Table
-- Allows admin users to read all feedback for analytics purposes

-- Add admin read policy to feedback table
CREATE POLICY "Admins read all feedback" ON public.feedback
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );
