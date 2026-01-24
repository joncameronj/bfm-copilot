-- ============================================
-- DEMO MODE SETTING
-- Allows admins to toggle demo mode which returns
-- hard-coded results for case study diagnostic files
-- ============================================

-- Add demo_mode_enabled to system_config
INSERT INTO public.system_config (key, value, description)
VALUES (
    'demo_mode_enabled',
    'false',
    'When enabled, returns hard-coded results for case study diagnostic files (Thyroid CS1, Neuro CS5, Hormones CS2, Diabetes CS4)'
)
ON CONFLICT (key) DO NOTHING;
