-- ============================================
-- Admin Users Setup
-- ============================================
-- This sets up admin roles for specific users.
-- Note: Users must be created via Supabase Auth first.
-- This script just ensures they have admin roles.

-- Set admin role for JonCameron Johnson
UPDATE public.profiles
SET role = 'admin', full_name = COALESCE(full_name, 'JonCameron Johnson')
WHERE email = 'joncameron@etho.net';

-- Set admin role for Dr. Rob DeMartino (product owner)
UPDATE public.profiles
SET role = 'admin', full_name = COALESCE(full_name, 'Dr. Rob DeMartino')
WHERE email = 'drrob@shslasvegas.com';

-- Set admin role for Kayla Costa
UPDATE public.profiles
SET role = 'admin', full_name = COALESCE(full_name, 'Kayla Costa')
WHERE email = 'patientadvocate@shslasvegas.com';

-- Insert admin profiles if users exist in auth but not in profiles
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name',
             CASE
                 WHEN u.email = 'joncameron@etho.net' THEN 'JonCameron Johnson'
                 WHEN u.email = 'drrob@shslasvegas.com' THEN 'Dr. Rob DeMartino'
                 WHEN u.email = 'patientadvocate@shslasvegas.com' THEN 'Kayla Costa'
             END),
    'admin'
FROM auth.users u
WHERE u.email IN ('joncameron@etho.net', 'drrob@shslasvegas.com', 'patientadvocate@shslasvegas.com')
ON CONFLICT (id) DO UPDATE
SET role = 'admin',
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
