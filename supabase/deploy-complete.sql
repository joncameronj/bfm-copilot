-- ===========================================
-- CLINIC COPILOT - COMPLETE DATABASE SETUP
-- ===========================================
-- Run this entire file in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/awdvlfjiusotgbumoojt/sql/new
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'practitioner'
        CHECK (role IN ('admin', 'practitioner', 'member')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    self_patient_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PATIENTS
-- ============================================
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    email TEXT,
    phone TEXT,
    chief_complaints TEXT,
    medical_history TEXT,
    current_medications TEXT[],
    allergies TEXT[],
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key to profiles for self_patient_id after patients table exists
ALTER TABLE public.profiles
    ADD CONSTRAINT fk_self_patient
    FOREIGN KEY (self_patient_id)
    REFERENCES public.patients(id) ON DELETE SET NULL;

-- ============================================
-- LAB MARKERS (reference data)
-- ============================================
CREATE TYPE lab_category AS ENUM (
    'cardiac', 'inflammation', 'anemia', 'lipids', 'diabetes',
    'bone_mineral', 'renal', 'hepatic', 'thyroid', 'hormones', 'cbc'
);

CREATE TABLE public.lab_markers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    category lab_category NOT NULL,
    unit TEXT,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TARGET RANGES (gender/age specific)
-- ============================================
CREATE TABLE public.target_ranges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marker_id UUID NOT NULL REFERENCES public.lab_markers(id) ON DELETE CASCADE,
    gender TEXT CHECK (gender IN ('male', 'female', 'all')),
    age_min INTEGER,
    age_max INTEGER,
    range_min NUMERIC,
    range_max NUMERIC,
    range_type TEXT NOT NULL CHECK (range_type IN ('between', 'less_than', 'greater_than')),
    display_range TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EVALUATION RULES
-- ============================================
CREATE TABLE public.evaluation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marker_id UUID NOT NULL REFERENCES public.lab_markers(id) ON DELETE CASCADE,
    evaluation TEXT NOT NULL CHECK (evaluation IN ('low', 'normal', 'moderate', 'high')),
    value_threshold NUMERIC,
    comparison TEXT CHECK (comparison IN ('lt', 'lte', 'gt', 'gte', 'between')),
    value_min NUMERIC,
    value_max NUMERIC,
    gender TEXT CHECK (gender IN ('male', 'female', 'all')),
    age_min INTEGER,
    age_max INTEGER,
    highlight BOOLEAN DEFAULT FALSE,
    weakness_text TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- OMINOUS MARKERS
-- ============================================
CREATE TABLE public.ominous_markers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    test_name TEXT NOT NULL,
    threshold NUMERIC NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LAB RESULTS
-- ============================================
CREATE TABLE public.lab_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    test_date DATE NOT NULL,
    source_file_url TEXT,
    ominous_count INTEGER DEFAULT 0,
    ominous_markers_triggered TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LAB VALUES
-- ============================================
CREATE TABLE public.lab_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lab_result_id UUID NOT NULL REFERENCES public.lab_results(id) ON DELETE CASCADE,
    marker_id UUID NOT NULL REFERENCES public.lab_markers(id),
    value NUMERIC NOT NULL,
    evaluation TEXT,
    delta_from_target NUMERIC,
    weakness_text TEXT,
    is_ominous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    thread_id TEXT,
    conversation_type TEXT DEFAULT 'general'
        CHECK (conversation_type IN ('general', 'lab_analysis', 'diagnostics', 'brainstorm')),
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DIAGNOSTIC UPLOADS
-- ============================================
CREATE TABLE public.diagnostic_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'uploading', 'uploaded', 'processing', 'complete', 'error')),
    analysis_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DIAGNOSTIC FILES
-- ============================================
CREATE TYPE diagnostic_type AS ENUM ('d_pulse', 'hrv', 'mold_toxicity', 'blood_panel', 'other');

CREATE TABLE public.diagnostic_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_id UUID NOT NULL REFERENCES public.diagnostic_uploads(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type diagnostic_type NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'processed', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FEEDBACK
-- ============================================
CREATE TABLE public.feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('response_quality', 'protocol_outcome', 'general')),
    rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative', 'neutral')),
    outcome TEXT CHECK (outcome IN ('success', 'partial', 'no_improvement')),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USAGE EVENTS (for Analytics)
-- ============================================
CREATE TABLE public.usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'login',
        'lab_analysis',
        'protocol_generated',
        'conversation_started',
        'diagnostic_uploaded',
        'patient_created',
        'feedback_submitted'
    )),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_events_user_id ON public.usage_events(user_id);
CREATE INDEX idx_usage_events_type ON public.usage_events(event_type);
CREATE INDEX idx_usage_events_created_at ON public.usage_events(created_at);

-- ============================================
-- SYSTEM CONFIG (Admin)
-- ============================================
CREATE TABLE public.system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_patients_user_id ON public.patients(user_id);
CREATE INDEX idx_patients_status ON public.patients(status);
CREATE INDEX idx_lab_results_patient_id ON public.lab_results(patient_id);
CREATE INDEX idx_lab_results_user_id ON public.lab_results(user_id);
CREATE INDEX idx_lab_values_lab_result_id ON public.lab_values(lab_result_id);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON public.conversations(updated_at DESC);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_target_ranges_marker_id ON public.target_ranges(marker_id);
CREATE INDEX idx_evaluation_rules_marker_id ON public.evaluation_rules(marker_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ominous_markers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Profiles
CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Patients
CREATE POLICY "Users manage own patients" ON public.patients
    FOR ALL USING (user_id = auth.uid());

-- Lab Results
CREATE POLICY "Users manage own lab results" ON public.lab_results
    FOR ALL USING (user_id = auth.uid());

-- Lab Values
CREATE POLICY "Users access lab values" ON public.lab_values
    FOR ALL USING (
        lab_result_id IN (SELECT id FROM public.lab_results WHERE user_id = auth.uid())
    );

-- Conversations
CREATE POLICY "Users manage own conversations" ON public.conversations
    FOR ALL USING (user_id = auth.uid());

-- Messages
CREATE POLICY "Users access conversation messages" ON public.messages
    FOR ALL USING (
        conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid())
    );

-- Diagnostic Uploads
CREATE POLICY "Users manage own diagnostic uploads" ON public.diagnostic_uploads
    FOR ALL USING (user_id = auth.uid());

-- Diagnostic Files
CREATE POLICY "Users access diagnostic files" ON public.diagnostic_files
    FOR ALL USING (
        upload_id IN (SELECT id FROM public.diagnostic_uploads WHERE user_id = auth.uid())
    );

-- Feedback
CREATE POLICY "Users manage own feedback" ON public.feedback
    FOR ALL USING (user_id = auth.uid());

-- Usage Events
CREATE POLICY "Users insert own usage events" ON public.usage_events
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all usage events" ON public.usage_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Public read for reference tables
CREATE POLICY "Public read lab markers" ON public.lab_markers
    FOR SELECT USING (true);
CREATE POLICY "Public read target ranges" ON public.target_ranges
    FOR SELECT USING (true);
CREATE POLICY "Public read evaluation rules" ON public.evaluation_rules
    FOR SELECT USING (true);
CREATE POLICY "Public read ominous markers" ON public.ominous_markers
    FOR SELECT USING (true);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER patients_updated_at BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER lab_results_updated_at BEFORE UPDATE ON public.lab_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER diagnostic_uploads_updated_at BEFORE UPDATE ON public.diagnostic_uploads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- PROFILE CREATION TRIGGER (for new signups)
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SEED OMINOUS MARKERS
-- ============================================
INSERT INTO public.ominous_markers (name, test_name, threshold, direction, description) VALUES
    ('Albumin below 4.0', 'Albumin', 4.0, 'below', 'Low albumin indicates potential serious disease'),
    ('Calcium/Albumin ratio above 2.7', 'Calcium/Albumin', 2.7, 'above', 'High ratio indicates calcium dysregulation'),
    ('Albumin/Globulin ratio below 1', 'Albumin/Globulin', 1, 'below', 'Low A/G ratio indicates potential disease'),
    ('Absolute Lymphocytes below 1500', 'Absolute Lymphocytes', 1500, 'below', 'Low lymphocyte count is concerning'),
    ('Lymphocytes % below 20', 'Lymphocytes', 20, 'below', 'Low lymphocyte percentage is concerning'),
    ('Total cholesterol below 150', 'Total Cholesterol', 150, 'below', 'Very low cholesterol can indicate disease'),
    ('Platelets below 150', 'Platelets', 150000, 'below', 'Low platelet count is concerning');

-- ============================================
-- CREATE ADMIN PROFILE FOR joncameron@etho.net
-- ============================================
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, raw_user_meta_data->>'full_name', 'admin'
FROM auth.users
WHERE email = 'joncameron@etho.net'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database setup complete! joncameron@etho.net is now an admin.';
END $$;
