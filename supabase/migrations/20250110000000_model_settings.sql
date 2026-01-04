-- ============================================
-- MODEL SETTINGS
-- Allows admins to configure AI model settings
-- via the admin panel without code changes
-- ============================================

-- Enable RLS on system_config if not already enabled
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can manage system config" ON public.system_config;
DROP POLICY IF EXISTS "Authenticated users can read system config" ON public.system_config;

-- Policy: Admins can read and write system config
CREATE POLICY "Admins can manage system config" ON public.system_config
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy: All authenticated users can read system config (needed for Python agent)
CREATE POLICY "Authenticated users can read system config" ON public.system_config
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Seed default model settings
INSERT INTO public.system_config (key, value, description)
VALUES
    ('chat_model', '"gpt-5.2"', 'The OpenAI model used for the main chat agent'),
    ('reasoning_effort', '"high"', 'Reasoning effort level for extended thinking (low, medium, high)'),
    ('reasoning_summary', '"detailed"', 'Reasoning summary verbosity (auto, concise, detailed)')
ON CONFLICT (key) DO NOTHING;

-- Create trigger to auto-update updated_at on changes
CREATE OR REPLACE FUNCTION public.update_system_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS system_config_updated_at ON public.system_config;
CREATE TRIGGER system_config_updated_at
    BEFORE UPDATE ON public.system_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_system_config_updated_at();

-- Helper function to get a config value by key
CREATE OR REPLACE FUNCTION public.get_system_config(config_key TEXT)
RETURNS JSONB AS $$
    SELECT value FROM public.system_config WHERE key = config_key;
$$ LANGUAGE sql STABLE;

-- Helper function to get all model-related settings
CREATE OR REPLACE FUNCTION public.get_model_settings()
RETURNS TABLE (
    chat_model TEXT,
    reasoning_effort TEXT,
    reasoning_summary TEXT
) AS $$
    SELECT
        (SELECT value::text FROM public.system_config WHERE key = 'chat_model')::text,
        (SELECT value::text FROM public.system_config WHERE key = 'reasoning_effort')::text,
        (SELECT value::text FROM public.system_config WHERE key = 'reasoning_summary')::text;
$$ LANGUAGE sql STABLE;
