-- Migration: Admin Read All Profiles
-- Date: 2026-01-07
-- Description: Add RLS policy to allow admins to read all user profiles in admin panel

-- Add policy for admins to read all profiles
CREATE POLICY "Admins can read all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
