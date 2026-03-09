-- Migration: Background Jobs for Chat Execution
-- Allows users to fire off chats and navigate away while agent continues processing

-- ============================================
-- 1. Create agent_jobs table
-- ============================================
CREATE TABLE public.agent_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Job state
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'streaming', 'completed', 'failed', 'cancelled')),

    -- Input
    input_message TEXT NOT NULL,
    input_context JSONB DEFAULT '{}',

    -- Output (accumulated during execution)
    output_content TEXT DEFAULT '',
    output_reasoning TEXT DEFAULT '',
    output_metadata JSONB DEFAULT '{}',

    -- Progress tracking
    current_step TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Read status (for notification badges)
    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_agent_jobs_user_status ON public.agent_jobs(user_id, status);
CREATE INDEX idx_agent_jobs_user_unread ON public.agent_jobs(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_agent_jobs_conversation ON public.agent_jobs(conversation_id);
CREATE INDEX idx_agent_jobs_pending ON public.agent_jobs(status, created_at) WHERE status = 'pending';

-- ============================================
-- 2. Add has_unread_completion to conversations
-- ============================================
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS has_unread_completion BOOLEAN DEFAULT FALSE;

-- ============================================
-- 3. Row Level Security
-- ============================================
ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view their own jobs"
    ON public.agent_jobs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create jobs for themselves
CREATE POLICY "Users can create their own jobs"
    ON public.agent_jobs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs (mark as read, cancel)
CREATE POLICY "Users can update their own jobs"
    ON public.agent_jobs
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can do everything (for the worker)
CREATE POLICY "Service role has full access"
    ON public.agent_jobs
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- 4. Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_agent_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_jobs_updated_at
    BEFORE UPDATE ON public.agent_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_jobs_updated_at();

-- ============================================
-- 5. Function to mark conversation as having unread completion
-- ============================================
CREATE OR REPLACE FUNCTION mark_conversation_unread_on_job_complete()
RETURNS TRIGGER AS $$
BEGIN
    -- When a job completes, mark the conversation as having unread completion
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE public.conversations
        SET has_unread_completion = TRUE, updated_at = NOW()
        WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_conversation_unread
    AFTER UPDATE ON public.agent_jobs
    FOR EACH ROW
    EXECUTE FUNCTION mark_conversation_unread_on_job_complete();

-- ============================================
-- 6. Enable realtime for job updates
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_jobs;

-- ============================================
-- 7. Helper function: Get active jobs count for a user
-- ============================================
CREATE OR REPLACE FUNCTION get_active_jobs_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.agent_jobs
        WHERE user_id = p_user_id
        AND status IN ('pending', 'running', 'streaming')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. Helper function: Get unread completed jobs count
-- ============================================
CREATE OR REPLACE FUNCTION get_unread_jobs_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.agent_jobs
        WHERE user_id = p_user_id
        AND status = 'completed'
        AND is_read = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
