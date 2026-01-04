-- Migration: System Prompts with Versioning
-- Enables versioned, database-stored system prompts for the AI agent

-- ============================================
-- System Prompts Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,

    -- Ensure unique version per prompt key
    CONSTRAINT unique_prompt_version UNIQUE (prompt_key, version)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_system_prompts_key
    ON public.system_prompts(prompt_key);

CREATE INDEX IF NOT EXISTS idx_system_prompts_active
    ON public.system_prompts(prompt_key, is_active)
    WHERE is_active = TRUE;

-- ============================================
-- Get Active Prompt Function
-- ============================================
CREATE OR REPLACE FUNCTION get_active_prompt(p_prompt_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_content TEXT;
BEGIN
    SELECT content INTO v_content
    FROM public.system_prompts
    WHERE prompt_key = p_prompt_key
      AND is_active = TRUE
    LIMIT 1;

    RETURN v_content;
END;
$$;

-- ============================================
-- Get Prompt with Metadata Function
-- ============================================
CREATE OR REPLACE FUNCTION get_prompt_with_metadata(p_prompt_key TEXT)
RETURNS TABLE (
    id UUID,
    prompt_key TEXT,
    version INTEGER,
    content TEXT,
    description TEXT,
    created_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.id,
        sp.prompt_key,
        sp.version,
        sp.content,
        sp.description,
        sp.created_at,
        sp.activated_at
    FROM public.system_prompts sp
    WHERE sp.prompt_key = p_prompt_key
      AND sp.is_active = TRUE
    LIMIT 1;
END;
$$;

-- ============================================
-- Activate Prompt Version Function
-- ============================================
CREATE OR REPLACE FUNCTION activate_prompt_version(
    p_prompt_key TEXT,
    p_version INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Deactivate all versions of this prompt
    UPDATE public.system_prompts
    SET is_active = FALSE, activated_at = NULL
    WHERE prompt_key = p_prompt_key;

    -- Activate the specified version
    UPDATE public.system_prompts
    SET is_active = TRUE, activated_at = NOW()
    WHERE prompt_key = p_prompt_key
      AND version = p_version;

    -- Return whether we found and activated the version
    RETURN FOUND;
END;
$$;

-- ============================================
-- Create New Prompt Version Function
-- ============================================
CREATE OR REPLACE FUNCTION create_prompt_version(
    p_prompt_key TEXT,
    p_content TEXT,
    p_description TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_activate BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_version INTEGER;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
    FROM public.system_prompts
    WHERE prompt_key = p_prompt_key;

    -- Insert new version
    INSERT INTO public.system_prompts (
        prompt_key, version, content, description, created_by, is_active, activated_at
    ) VALUES (
        p_prompt_key,
        v_new_version,
        p_content,
        p_description,
        p_created_by,
        p_activate,
        CASE WHEN p_activate THEN NOW() ELSE NULL END
    );

    -- If activating, deactivate other versions
    IF p_activate THEN
        UPDATE public.system_prompts
        SET is_active = FALSE, activated_at = NULL
        WHERE prompt_key = p_prompt_key
          AND version != v_new_version;
    END IF;

    RETURN v_new_version;
END;
$$;

-- ============================================
-- Get Prompt History Function
-- ============================================
CREATE OR REPLACE FUNCTION get_prompt_history(p_prompt_key TEXT)
RETURNS TABLE (
    id UUID,
    version INTEGER,
    description TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.id,
        sp.version,
        sp.description,
        sp.is_active,
        sp.created_at,
        sp.activated_at
    FROM public.system_prompts sp
    WHERE sp.prompt_key = p_prompt_key
    ORDER BY sp.version DESC;
END;
$$;

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read prompts (needed for AI to function)
CREATE POLICY "Authenticated users can read prompts" ON public.system_prompts
    FOR SELECT TO authenticated
    USING (TRUE);

-- Only admins can modify prompts (we'll check role in app layer)
-- For now, allow authenticated users to insert/update for seeding
CREATE POLICY "Authenticated users can manage prompts" ON public.system_prompts
    FOR ALL TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE public.system_prompts IS 'Versioned system prompts for the AI agent';
COMMENT ON FUNCTION get_active_prompt IS 'Get the currently active prompt content by key';
COMMENT ON FUNCTION activate_prompt_version IS 'Activate a specific version of a prompt';
COMMENT ON FUNCTION create_prompt_version IS 'Create a new version of a prompt';
COMMENT ON FUNCTION get_prompt_history IS 'Get version history for a prompt';
