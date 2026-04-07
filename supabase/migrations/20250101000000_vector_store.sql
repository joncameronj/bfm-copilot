-- Migration: Add pgvector tables for document embeddings
-- This enables RAG (Retrieval Augmented Generation) for the medical copilot

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Document metadata table
-- ============================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN (
        'medical_protocol',
        'lab_interpretation',
        'diagnostic_report',
        'ip_material',
        'other'
    )),
    mime_type TEXT NOT NULL,
    storage_path TEXT,
    source_diagnostic_id UUID REFERENCES public.diagnostic_files(id) ON DELETE SET NULL,
    total_chunks INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'indexed', 'error'
    )),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Document chunks with embeddings
-- ============================================
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),  -- text-embedding-3-small dimension
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================

-- Vector similarity search index (IVFFlat)
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
    ON public.document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
    ON public.document_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_documents_user_id
    ON public.documents(user_id);

CREATE INDEX IF NOT EXISTS idx_documents_file_type
    ON public.documents(file_type);

CREATE INDEX IF NOT EXISTS idx_documents_status
    ON public.documents(status);

-- ============================================
-- Updated at trigger
-- ============================================
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Documents: Users can only access their own documents
CREATE POLICY "Users can view own documents" ON public.documents
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own documents" ON public.documents
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own documents" ON public.documents
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own documents" ON public.documents
    FOR DELETE USING (user_id = auth.uid());

-- Document chunks: Users can access chunks of their own documents
CREATE POLICY "Users can view own document chunks" ON public.document_chunks
    FOR SELECT USING (
        document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert own document chunks" ON public.document_chunks
    FOR INSERT WITH CHECK (
        document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can delete own document chunks" ON public.document_chunks
    FOR DELETE USING (
        document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
    );

-- ============================================
-- Similarity search function
-- ============================================
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    filter_user_id UUID DEFAULT NULL,
    filter_file_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    content TEXT,
    chunk_index INTEGER,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        dc.chunk_index,
        dc.metadata,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    JOIN public.documents d ON dc.document_id = d.id
    WHERE
        d.status = 'indexed'
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
        AND (filter_user_id IS NULL OR d.user_id = filter_user_id)
        AND (filter_file_types IS NULL OR d.file_type = ANY(filter_file_types))
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================
-- Helper function to get document statistics
-- ============================================
CREATE OR REPLACE FUNCTION get_document_stats(p_user_id UUID)
RETURNS TABLE (
    file_type TEXT,
    document_count BIGINT,
    total_chunks BIGINT,
    indexed_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.file_type,
        COUNT(DISTINCT d.id) AS document_count,
        COALESCE(SUM(d.total_chunks), 0) AS total_chunks,
        COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'indexed') AS indexed_count
    FROM public.documents d
    WHERE d.user_id = p_user_id
    GROUP BY d.file_type;
END;
$$;

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE public.documents IS 'Stores metadata for uploaded documents used in RAG';
COMMENT ON TABLE public.document_chunks IS 'Stores text chunks and embeddings for similarity search';
COMMENT ON FUNCTION match_document_chunks IS 'Performs vector similarity search on document chunks';
COMMENT ON FUNCTION get_document_stats IS 'Returns statistics about indexed documents by file type';
