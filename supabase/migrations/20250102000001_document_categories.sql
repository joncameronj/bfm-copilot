-- Migration: Document Categories, Tags, and Condition Relationships
-- Enables smart RAG search with condition cross-referencing

-- ============================================
-- Add new columns to documents table
-- ============================================
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS body_system TEXT,
    ADD COLUMN IF NOT EXISTS document_category TEXT,
    ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0',
    ADD COLUMN IF NOT EXISTS title TEXT;

-- Add check constraint for body_system
ALTER TABLE public.documents
    ADD CONSTRAINT check_body_system CHECK (
        body_system IS NULL OR body_system IN (
            'endocrine',
            'cardiovascular',
            'digestive',
            'immune',
            'nervous',
            'musculoskeletal',
            'reproductive',
            'respiratory',
            'integumentary',
            'urinary',
            'lymphatic',
            'multi_system'
        )
    );

-- Add check constraint for document_category
ALTER TABLE public.documents
    ADD CONSTRAINT check_document_category CHECK (
        document_category IS NULL OR document_category IN (
            'protocol',
            'lab_guide',
            'care_guide',
            'reference',
            'patient_education',
            'case_study'
        )
    );

-- Index for new columns
CREATE INDEX IF NOT EXISTS idx_documents_body_system
    ON public.documents(body_system);

CREATE INDEX IF NOT EXISTS idx_documents_category
    ON public.documents(document_category);

CREATE INDEX IF NOT EXISTS idx_documents_global
    ON public.documents(is_global);

-- ============================================
-- Document Tags Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.document_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name TEXT NOT NULL UNIQUE,
    tag_type TEXT NOT NULL CHECK (tag_type IN (
        'condition',
        'symptom',
        'lab_marker',
        'treatment',
        'body_system',
        'general'
    )),
    display_name TEXT,
    description TEXT,
    parent_tag_id UUID REFERENCES public.document_tags(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_tags_type
    ON public.document_tags(tag_type);

CREATE INDEX IF NOT EXISTS idx_document_tags_name
    ON public.document_tags(tag_name);

-- ============================================
-- Document Tag Mappings (Many-to-Many)
-- ============================================
CREATE TABLE IF NOT EXISTS public.document_tag_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.document_tags(id) ON DELETE CASCADE,
    relevance FLOAT DEFAULT 1.0 CHECK (relevance >= 0 AND relevance <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_document_tag UNIQUE (document_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_document_tag_mappings_document
    ON public.document_tag_mappings(document_id);

CREATE INDEX IF NOT EXISTS idx_document_tag_mappings_tag
    ON public.document_tag_mappings(tag_id);

-- ============================================
-- Condition Relationships Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.condition_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condition_tag_id UUID NOT NULL REFERENCES public.document_tags(id) ON DELETE CASCADE,
    related_tag_id UUID NOT NULL REFERENCES public.document_tags(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN (
        'comorbidity',
        'contraindication',
        'underlying_cause',
        'symptom_overlap',
        'treatment_interaction',
        'differential_diagnosis'
    )),
    strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    bidirectional BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent self-referencing
    CONSTRAINT no_self_reference CHECK (condition_tag_id != related_tag_id),
    -- Unique relationship pair (we'll handle bidirectional in queries)
    CONSTRAINT unique_relationship UNIQUE (condition_tag_id, related_tag_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_condition_relationships_condition
    ON public.condition_relationships(condition_tag_id);

CREATE INDEX IF NOT EXISTS idx_condition_relationships_related
    ON public.condition_relationships(related_tag_id);

CREATE INDEX IF NOT EXISTS idx_condition_relationships_type
    ON public.condition_relationships(relationship_type);

-- ============================================
-- Get Related Conditions Function
-- ============================================
CREATE OR REPLACE FUNCTION get_related_conditions(
    p_tag_names TEXT[],
    p_min_strength FLOAT DEFAULT 0.3,
    p_relationship_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    original_tag TEXT,
    related_tag TEXT,
    related_tag_id UUID,
    relationship_type TEXT,
    strength FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t1.tag_name AS original_tag,
        t2.tag_name AS related_tag,
        t2.id AS related_tag_id,
        cr.relationship_type,
        cr.strength
    FROM public.document_tags t1
    JOIN public.condition_relationships cr ON t1.id = cr.condition_tag_id
    JOIN public.document_tags t2 ON cr.related_tag_id = t2.id
    WHERE t1.tag_name = ANY(p_tag_names)
      AND cr.strength >= p_min_strength
      AND (p_relationship_types IS NULL OR cr.relationship_type = ANY(p_relationship_types))

    UNION

    -- Also get reverse relationships where bidirectional is true
    SELECT
        t1.tag_name AS original_tag,
        t2.tag_name AS related_tag,
        t2.id AS related_tag_id,
        cr.relationship_type,
        cr.strength
    FROM public.document_tags t1
    JOIN public.condition_relationships cr ON t1.id = cr.related_tag_id
    JOIN public.document_tags t2 ON cr.condition_tag_id = t2.id
    WHERE t1.tag_name = ANY(p_tag_names)
      AND cr.bidirectional = TRUE
      AND cr.strength >= p_min_strength
      AND (p_relationship_types IS NULL OR cr.relationship_type = ANY(p_relationship_types))

    ORDER BY strength DESC;
END;
$$;

-- ============================================
-- Smart Document Search Function
-- ============================================
CREATE OR REPLACE FUNCTION smart_search_documents(
    p_query_embedding vector(1536),
    p_user_id UUID,
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
BEGIN
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

-- ============================================
-- Get Documents by Tags Function
-- ============================================
CREATE OR REPLACE FUNCTION get_documents_by_tags(
    p_user_id UUID,
    p_tag_names TEXT[],
    p_include_related BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    document_id UUID,
    title TEXT,
    filename TEXT,
    body_system TEXT,
    document_category TEXT,
    matched_tags TEXT[],
    match_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_related_tags TEXT[];
BEGIN
    IF p_include_related THEN
        SELECT ARRAY_AGG(DISTINCT rc.related_tag)
        INTO v_related_tags
        FROM get_related_conditions(p_tag_names, 0.4) rc;
    END IF;

    RETURN QUERY
    SELECT DISTINCT ON (d.id)
        d.id AS document_id,
        d.title,
        d.filename,
        d.body_system,
        d.document_category,
        ARRAY(
            SELECT dt.tag_name
            FROM public.document_tag_mappings dtm
            JOIN public.document_tags dt ON dtm.tag_id = dt.id
            WHERE dtm.document_id = d.id
        ) AS matched_tags,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM public.document_tag_mappings dtm
                JOIN public.document_tags dt ON dtm.tag_id = dt.id
                WHERE dtm.document_id = d.id AND dt.tag_name = ANY(p_tag_names)
            ) THEN 'direct'
            ELSE 'related'
        END AS match_type
    FROM public.documents d
    JOIN public.document_tag_mappings dtm ON d.id = dtm.document_id
    JOIN public.document_tags dt ON dtm.tag_id = dt.id
    WHERE d.status = 'indexed'
      AND (d.user_id = p_user_id OR d.is_global = TRUE)
      AND (
          dt.tag_name = ANY(p_tag_names)
          OR (p_include_related AND dt.tag_name = ANY(COALESCE(v_related_tags, ARRAY[]::TEXT[])))
      )
    ORDER BY d.id, match_type;
END;
$$;

-- ============================================
-- Row Level Security for new tables
-- ============================================
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tag_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condition_relationships ENABLE ROW LEVEL SECURITY;

-- Tags are readable by all authenticated users
CREATE POLICY "Authenticated users can read tags" ON public.document_tags
    FOR SELECT TO authenticated
    USING (TRUE);

-- Only allow authenticated users to manage tags (admin check in app)
CREATE POLICY "Authenticated users can manage tags" ON public.document_tags
    FOR ALL TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

-- Tag mappings follow document access
CREATE POLICY "Users can read tag mappings for accessible documents" ON public.document_tag_mappings
    FOR SELECT TO authenticated
    USING (
        document_id IN (
            SELECT id FROM public.documents
            WHERE user_id = auth.uid() OR is_global = TRUE
        )
    );

CREATE POLICY "Users can manage tag mappings for own documents" ON public.document_tag_mappings
    FOR ALL TO authenticated
    USING (
        document_id IN (
            SELECT id FROM public.documents WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        document_id IN (
            SELECT id FROM public.documents WHERE user_id = auth.uid()
        )
    );

-- Condition relationships are readable by all
CREATE POLICY "Authenticated users can read relationships" ON public.condition_relationships
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can manage relationships" ON public.condition_relationships
    FOR ALL TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

-- ============================================
-- Update documents RLS to include global docs
-- ============================================
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
CREATE POLICY "Users can view accessible documents" ON public.documents
    FOR SELECT USING (user_id = auth.uid() OR is_global = TRUE);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE public.document_tags IS 'Tags for categorizing documents (conditions, symptoms, markers)';
COMMENT ON TABLE public.document_tag_mappings IS 'Many-to-many mapping between documents and tags';
COMMENT ON TABLE public.condition_relationships IS 'Relationships between conditions for smart search expansion';
COMMENT ON FUNCTION get_related_conditions IS 'Get conditions related to given tags based on relationships';
COMMENT ON FUNCTION smart_search_documents IS 'Smart vector search with tag expansion and relationship awareness';
COMMENT ON FUNCTION get_documents_by_tags IS 'Get documents matching tags with optional related condition expansion';
