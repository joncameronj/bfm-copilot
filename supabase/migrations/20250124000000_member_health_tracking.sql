-- ===========================================
-- MEMBER HEALTH TRACKING - LABS & PROTOCOLS
-- ===========================================
-- This migration adds:
-- 1. Extended columns on member_lab_values (for calculator integration)
-- 2. member_lab_uploads table (PDF upload tracking)
-- 3. daily_protocols table (BFM behavior tracking)
-- 4. protocol_adherence_metrics table (aggregated stats)
-- 5. Database functions for streak calculation and lab trends
-- ===========================================

-- ============================================
-- EXTEND member_lab_values TABLE
-- ============================================
-- Add calculator-computed fields for richer analysis

ALTER TABLE public.member_lab_values
ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS evaluation TEXT, -- 'low', 'normal', 'moderate', 'high'
ADD COLUMN IF NOT EXISTS delta_from_target DECIMAL,
ADD COLUMN IF NOT EXISTS is_ominous BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS weakness_text TEXT,
ADD COLUMN IF NOT EXISTS category TEXT, -- 'cardiac', 'inflammation', etc.
ADD COLUMN IF NOT EXISTS upload_id UUID;

-- Add constraint for evaluation values
ALTER TABLE public.member_lab_values DROP CONSTRAINT IF EXISTS member_lab_values_evaluation_check;
ALTER TABLE public.member_lab_values ADD CONSTRAINT member_lab_values_evaluation_check
    CHECK (evaluation IS NULL OR evaluation IN ('low', 'normal', 'moderate', 'high'));

-- ============================================
-- MEMBER LAB UPLOADS (PDF Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS public.member_lab_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size_bytes INTEGER,

    status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('pending_review', 'confirmed', 'rejected', 'error')),

    extracted_values JSONB DEFAULT '[]',
    extraction_confidence DECIMAL,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_member_lab_uploads_user ON member_lab_uploads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_lab_uploads_status ON member_lab_uploads(status);

ALTER TABLE member_lab_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage own uploads" ON member_lab_uploads;
CREATE POLICY "Members manage own uploads" ON member_lab_uploads
    FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all uploads" ON member_lab_uploads;
CREATE POLICY "Admins read all uploads" ON member_lab_uploads
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Add foreign key for upload_id in member_lab_values (after table exists)
ALTER TABLE public.member_lab_values
DROP CONSTRAINT IF EXISTS member_lab_values_upload_id_fkey;
ALTER TABLE public.member_lab_values
ADD CONSTRAINT member_lab_values_upload_id_fkey
    FOREIGN KEY (upload_id) REFERENCES member_lab_uploads(id) ON DELETE SET NULL;

-- ============================================
-- DAILY PROTOCOLS (BFM Behavior Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,

    -- Morning Light
    morning_light_time TIME,
    morning_light_duration_minutes INTEGER,

    -- Meal Timing
    first_meal_time TIME,
    wake_time TIME,
    first_meal_within_30min BOOLEAN,

    -- Macros
    breakfast_protein_grams DECIMAL(6,2),
    daily_carbs_grams DECIMAL(7,2),

    -- Evening & Sleep
    blue_blockers_worn BOOLEAN DEFAULT FALSE,
    blue_blockers_start_time TIME,
    darkness_hours DECIMAL(4,2),
    sleep_hours DECIMAL(4,2),
    sleep_quality_rating INTEGER CHECK (sleep_quality_rating IS NULL OR (sleep_quality_rating BETWEEN 1 AND 10)),
    bedtime TIME,

    -- EMF Reduction
    phone_off_time TIME,
    wifi_off BOOLEAN DEFAULT FALSE,

    -- Subjective
    energy_level_rating INTEGER CHECK (energy_level_rating IS NULL OR (energy_level_rating BETWEEN 1 AND 10)),
    symptom_notes TEXT,

    -- Auto-calculated
    completion_percentage DECIMAL(5,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One entry per user per day
    CONSTRAINT unique_user_entry_date UNIQUE(user_id, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_protocols_user_date ON daily_protocols(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_protocols_entry_date ON daily_protocols(entry_date DESC);

ALTER TABLE daily_protocols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage own protocols" ON daily_protocols;
CREATE POLICY "Members manage own protocols" ON daily_protocols
    FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all daily protocols" ON daily_protocols;
CREATE POLICY "Admins read all daily protocols" ON daily_protocols
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- PROTOCOL ADHERENCE METRICS (Aggregated Stats)
-- ============================================
CREATE TABLE IF NOT EXISTS public.protocol_adherence_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Adherence Scores (0-100)
    morning_light_score DECIMAL(5,2),
    meal_timing_score DECIMAL(5,2),
    protein_intake_score DECIMAL(5,2),
    sleep_score DECIMAL(5,2),
    overall_adherence_score DECIMAL(5,2),

    -- Averages
    avg_energy_level DECIMAL(4,2),
    avg_sleep_quality DECIMAL(4,2),
    avg_sleep_hours DECIMAL(4,2),

    -- Entry Stats
    total_entries INTEGER DEFAULT 0,
    expected_entries INTEGER DEFAULT 0,
    entry_completion_rate DECIMAL(5,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_period UNIQUE(user_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_adherence_user_period ON protocol_adherence_metrics(user_id, period_type, period_start DESC);

ALTER TABLE protocol_adherence_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own metrics" ON protocol_adherence_metrics;
CREATE POLICY "Members read own metrics" ON protocol_adherence_metrics
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all metrics" ON protocol_adherence_metrics;
CREATE POLICY "Admins read all metrics" ON protocol_adherence_metrics
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated at trigger for daily_protocols
CREATE TRIGGER daily_protocols_updated_at
    BEFORE UPDATE ON public.daily_protocols
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Updated at trigger for protocol_adherence_metrics
CREATE TRIGGER protocol_adherence_metrics_updated_at
    BEFORE UPDATE ON public.protocol_adherence_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- DATABASE FUNCTIONS
-- ============================================

-- Calculate current streak for a user
CREATE OR REPLACE FUNCTION get_current_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_streak INTEGER := 0;
    v_date DATE := CURRENT_DATE;
    v_has_entry BOOLEAN;
BEGIN
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM public.daily_protocols
            WHERE user_id = p_user_id AND entry_date = v_date
        ) INTO v_has_entry;

        IF NOT v_has_entry THEN EXIT; END IF;

        v_streak := v_streak + 1;
        v_date := v_date - INTERVAL '1 day';
    END LOOP;

    RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate protocol completion percentage
CREATE OR REPLACE FUNCTION calculate_protocol_completion()
RETURNS TRIGGER AS $$
DECLARE
    total_fields INTEGER := 12;
    filled_fields INTEGER := 0;
BEGIN
    IF NEW.morning_light_time IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.morning_light_duration_minutes IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.first_meal_time IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.breakfast_protein_grams IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.daily_carbs_grams IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.blue_blockers_worn IS TRUE THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.sleep_hours IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.sleep_quality_rating IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.energy_level_rating IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.darkness_hours IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.phone_off_time IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF NEW.wifi_off IS TRUE THEN filled_fields := filled_fields + 1; END IF;

    NEW.completion_percentage := (filled_fields::DECIMAL / total_fields) * 100;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-calculating completion percentage
DROP TRIGGER IF EXISTS daily_protocols_completion_trigger ON public.daily_protocols;
CREATE TRIGGER daily_protocols_completion_trigger
    BEFORE INSERT OR UPDATE ON public.daily_protocols
    FOR EACH ROW
    EXECUTE FUNCTION calculate_protocol_completion();

-- Get lab trends for member
CREATE OR REPLACE FUNCTION get_member_lab_trends(
    p_user_id UUID,
    p_marker_names TEXT[],
    p_days_back INTEGER DEFAULT 180
)
RETURNS TABLE (
    marker_name TEXT,
    current_value DECIMAL,
    previous_value DECIMAL,
    trend_direction TEXT,
    percent_change DECIMAL,
    unit TEXT,
    test_date DATE
) AS $$
BEGIN
    RETURN QUERY
    WITH ordered_values AS (
        SELECT
            mlv.marker_name,
            mlv.value,
            mlv.test_date,
            mlv.unit,
            ROW_NUMBER() OVER (
                PARTITION BY mlv.marker_name
                ORDER BY mlv.test_date DESC
            ) AS rn
        FROM public.member_lab_values mlv
        WHERE mlv.user_id = p_user_id
        AND mlv.marker_name = ANY(p_marker_names)
        AND mlv.test_date >= CURRENT_DATE - p_days_back
    ),
    current_vals AS (
        SELECT * FROM ordered_values WHERE rn = 1
    ),
    previous_vals AS (
        SELECT * FROM ordered_values WHERE rn = 2
    )
    SELECT
        c.marker_name,
        c.value AS current_value,
        p.value AS previous_value,
        CASE
            WHEN p.value IS NULL THEN 'insufficient_data'
            WHEN c.value > p.value THEN 'improving'
            WHEN c.value < p.value THEN 'declining'
            ELSE 'stable'
        END AS trend_direction,
        CASE
            WHEN p.value IS NOT NULL AND p.value > 0
            THEN ((c.value - p.value) / p.value * 100)::DECIMAL
            ELSE NULL
        END AS percent_change,
        c.unit,
        c.test_date
    FROM current_vals c
    LEFT JOIN previous_vals p ON c.marker_name = p.marker_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: usage_events event_type constraint not modified to preserve existing data

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration complete: member health tracking tables and functions created.';
END $$;
