-- Migration: Role Scope and RAG Logging
-- Enables role-based content filtering (educational vs clinical)
-- Adds telemetry logging for admin monitoring

-- ============================================
-- Add role_scope column to documents table
-- ============================================
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS role_scope TEXT DEFAULT 'clinical';

-- Add check constraint for role_scope
ALTER TABLE public.documents
    ADD CONSTRAINT check_role_scope CHECK (
        role_scope IN ('educational', 'clinical', 'both')
    );

-- Index for role_scope filtering
CREATE INDEX IF NOT EXISTS idx_documents_role_scope
    ON public.documents(role_scope);

COMMENT ON COLUMN public.documents.role_scope IS
    'Content visibility: educational (members only), clinical (practitioners only), both (all roles)';

-- ============================================
-- Backfill existing documents
-- ============================================
UPDATE public.documents
SET role_scope = CASE
    WHEN file_type IN ('medical_protocol', 'ip_material') THEN 'clinical'
    WHEN document_category = 'patient_education' THEN 'educational'
    ELSE 'both'
END
WHERE role_scope IS NULL;

-- ============================================
-- RAG Logs Table for Admin Telemetry
-- ============================================
CREATE TABLE IF NOT EXISTS public.rag_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    user_role TEXT NOT NULL CHECK (user_role IN ('admin', 'practitioner', 'member')),
    role_scope_filter TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    top_match_similarity FLOAT,
    chunks_retrieved JSONB DEFAULT '[]',
    response_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_rag_logs_user_id
    ON public.rag_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_logs_created_at
    ON public.rag_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_logs_user_role
    ON public.rag_logs(user_role);
CREATE INDEX IF NOT EXISTS idx_rag_logs_conversation
    ON public.rag_logs(conversation_id);

COMMENT ON TABLE public.rag_logs IS
    'Telemetry logs for RAG queries, admin-only access for monitoring and debugging';

-- ============================================
-- RLS for RAG Logs
-- ============================================
ALTER TABLE public.rag_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read logs
CREATE POLICY "Admins can read all rag logs" ON public.rag_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Allow service role to insert logs (from Python agent)
CREATE POLICY "Service can insert rag logs" ON public.rag_logs
    FOR INSERT WITH CHECK (TRUE);

-- ============================================
-- Helper function to get allowed role scopes
-- ============================================
CREATE OR REPLACE FUNCTION get_allowed_role_scopes(p_user_role TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_user_role = 'admin' THEN
        RETURN ARRAY['educational', 'clinical', 'both'];
    ELSIF p_user_role = 'practitioner' THEN
        RETURN ARRAY['clinical', 'both'];
    ELSE -- member
        RETURN ARRAY['educational', 'both'];
    END IF;
END;
$$;

COMMENT ON FUNCTION get_allowed_role_scopes IS
    'Returns array of role_scope values accessible to a given user role';

-- ============================================
-- Updated Smart Document Search Function (V2)
-- Now includes role-based filtering
-- ============================================
CREATE OR REPLACE FUNCTION smart_search_documents_v2(
    p_query_embedding vector(1536),
    p_user_id UUID,
    p_user_role TEXT DEFAULT 'member',
    p_tag_names TEXT[] DEFAULT NULL,
    p_body_systems TEXT[] DEFAULT NULL,
    p_document_categories TEXT[] DEFAULT NULL,
    p_include_related BOOLEAN DEFAULT TRUE,
    p_match_threshold FLOAT DEFAULT 0.6,
    p_match_count INT DEFAULT 10
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    title TEXT,
    filename TEXT,
    body_system TEXT,
    document_category TEXT,
    role_scope TEXT,
    similarity FLOAT,
    match_type TEXT,
    matched_tags TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expanded_tags TEXT[];
    v_related_tags TEXT[];
    v_allowed_scopes TEXT[];
BEGIN
    -- Determine allowed role_scope based on user role
    v_allowed_scopes := get_allowed_role_scopes(p_user_role);

    -- Expand tags to include related conditions if requested
    IF p_include_related AND p_tag_names IS NOT NULL THEN
        SELECT ARRAY_AGG(DISTINCT rc.related_tag)
        INTO v_related_tags
        FROM get_related_conditions(p_tag_names, 0.4) rc;

        v_expanded_tags := p_tag_names || COALESCE(v_related_tags, ARRAY[]::TEXT[]);
    ELSE
        v_expanded_tags := p_tag_names;
    END IF;

    RETURN QUERY
    WITH scored_chunks AS (
        SELECT
            dc.id AS chunk_id,
            dc.document_id,
            dc.content,
            d.title,
            d.filename,
            d.body_system,
            d.document_category,
            d.role_scope,
            1 - (dc.embedding <=> p_query_embedding) AS similarity,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM public.document_tag_mappings dtm
                    JOIN public.document_tags dt ON dtm.tag_id = dt.id
                    WHERE dtm.document_id = d.id AND dt.tag_name = ANY(p_tag_names)
                ) THEN 'direct'
                WHEN EXISTS (
                    SELECT 1 FROM public.document_tag_mappings dtm
                    JOIN public.document_tags dt ON dtm.tag_id = dt.id
                    WHERE dtm.document_id = d.id AND dt.tag_name = ANY(v_related_tags)
                ) THEN 'related'
                ELSE 'semantic'
            END AS match_type,
            ARRAY(
                SELECT dt.tag_name
                FROM public.document_tag_mappings dtm
                JOIN public.document_tags dt ON dtm.tag_id = dt.id
                WHERE dtm.document_id = d.id
                  AND (v_expanded_tags IS NULL OR dt.tag_name = ANY(v_expanded_tags))
            ) AS matched_tags
        FROM public.document_chunks dc
        JOIN public.documents d ON dc.document_id = d.id
        WHERE d.status = 'indexed'
          AND (d.user_id = p_user_id OR d.is_global = TRUE)
          AND d.role_scope = ANY(v_allowed_scopes)  -- Role-based filtering
          AND (p_body_systems IS NULL OR d.body_system = ANY(p_body_systems))
          AND (p_document_categories IS NULL OR d.document_category = ANY(p_document_categories))
          AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
    )
    SELECT * FROM scored_chunks
    ORDER BY
        CASE match_type
            WHEN 'direct' THEN 1
            WHEN 'related' THEN 2
            ELSE 3
        END,
        similarity DESC
    LIMIT p_match_count;
END;
$$;

COMMENT ON FUNCTION smart_search_documents_v2 IS
    'Smart vector search with role-based filtering, tag expansion, and relationship awareness';

-- ============================================
-- Update documents RLS to include role_scope
-- ============================================
DROP POLICY IF EXISTS "Users can view accessible documents" ON public.documents;

CREATE POLICY "Users can view role-appropriate documents" ON public.documents
    FOR SELECT USING (
        (user_id = auth.uid() OR is_global = TRUE)
        AND (
            -- Admin sees all
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role = 'admin'
            )
            OR
            -- Practitioner sees clinical + both
            (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND role = 'practitioner'
                )
                AND role_scope IN ('clinical', 'both')
            )
            OR
            -- Member sees educational + both
            (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND role = 'member'
                )
                AND role_scope IN ('educational', 'both')
            )
        )
    );

-- ============================================
-- RAG Stats View for Admin Dashboard
-- ============================================
CREATE OR REPLACE VIEW public.rag_stats AS
SELECT
    DATE_TRUNC('day', created_at) AS date,
    user_role,
    COUNT(*) AS query_count,
    AVG(results_count) AS avg_results,
    AVG(top_match_similarity) AS avg_similarity,
    AVG(response_time_ms) AS avg_response_time_ms,
    COUNT(*) FILTER (WHERE results_count = 0) AS empty_result_count
FROM public.rag_logs
GROUP BY DATE_TRUNC('day', created_at), user_role
ORDER BY date DESC, user_role;

COMMENT ON VIEW public.rag_stats IS
    'Aggregated RAG statistics for admin dashboard';

-- Grant access to the view
GRANT SELECT ON public.rag_stats TO authenticated;
