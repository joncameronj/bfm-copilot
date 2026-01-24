-- ============================================
-- BFM Copilot Seed Data Orchestrator
-- ============================================
-- This file orchestrates all seed data loading.
-- Run via: supabase db reset
--
-- Order matters - dependencies must be loaded first:
-- 1. System prompts (no dependencies)
-- 2. Document tags (no dependencies)
-- 3. Condition relationships (depends on tags)
-- ============================================

-- Load system prompts
\ir 01_system_prompts.sql

-- Load document tags
\ir 02_document_tags.sql

-- Load condition relationships
\ir 03_condition_relationships.sql

-- Load Jack Kruse educational content tags
\ir 05_jack_kruse_tags.sql

-- ============================================
-- Verification queries (optional - uncomment to debug)
-- ============================================
-- SELECT 'System Prompts' as table_name, COUNT(*) as count FROM public.system_prompts;
-- SELECT 'Document Tags' as table_name, COUNT(*) as count FROM public.document_tags;
-- SELECT 'Condition Relationships' as table_name, COUNT(*) as count FROM public.condition_relationships;
