-- User preferences table for settings
CREATE TABLE public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Notification preferences
    email_lab_results BOOLEAN DEFAULT true,
    email_protocol_updates BOOLEAN DEFAULT true,
    email_system_announcements BOOLEAN DEFAULT true,
    email_weekly_digest BOOLEAN DEFAULT false,

    -- Practitioner-specific preferences
    default_patient_view TEXT DEFAULT 'list' CHECK (default_patient_view IN ('list', 'grid')),
    auto_save_notes BOOLEAN DEFAULT true,

    -- Member-specific preferences
    health_reminder_frequency TEXT DEFAULT 'weekly' CHECK (health_reminder_frequency IN ('daily', 'weekly', 'monthly', 'never')),
    share_progress_with_practitioner BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own preferences
CREATE POLICY "Users manage own preferences" ON public.user_preferences
    FOR ALL USING (user_id = auth.uid());

-- Index for faster lookups
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Trigger for updated_at
CREATE TRIGGER user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
