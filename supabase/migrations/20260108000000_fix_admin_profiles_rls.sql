-- Migration: Fix Admin Profiles RLS Recursion
-- Date: 2026-01-08
-- Description: Fix infinite recursion in admin profiles RLS policy

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

-- Create a security definer function to check admin status
-- This bypasses RLS to prevent recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();

    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create the fixed policy using the security definer function
CREATE POLICY "Admins can read all profiles" ON public.profiles
    FOR SELECT USING (
        public.is_admin()
    );

-- Also add policy for admins to update all profiles
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (
        public.is_admin()
    );
