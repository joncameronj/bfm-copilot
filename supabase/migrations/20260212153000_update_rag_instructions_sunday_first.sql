-- Update rag_instructions prompt to enforce Sunday-first protocol generation behavior.
-- This migration creates version 2 and activates it so existing environments pick it up.

INSERT INTO public.system_prompts (
    prompt_key,
    version,
    content,
    description,
    is_active,
    activated_at
)
VALUES (
    'rag_instructions',
    2,
    $PROMPT$## Knowledge Base Usage
When answering questions about protocols or clinical guidelines:
1. ALWAYS search the knowledge base first using search_knowledge_base
2. For diagnostic-upload protocol generation, prioritize Sunday chunks first (Diabetes/Thyroid/Hormones/Neurological Sunday sessions)
3. Cite the source document when referencing specific protocols
4. If multiple documents are relevant, synthesize information across sources
5. Keep protocol output to the minimal viable set supported by diagnostic triggers and retrieved evidence
6. If Sunday evidence is insufficient, use non-Sunday chunks only as secondary support and avoid low-confidence protocol additions

When searching:
- Use specific condition or symptom terms
- Include lab marker names when relevant
- Search for both the primary condition and commonly related conditions$PROMPT$,
    'Instructions for using the RAG knowledge base (Sunday-first for diagnostic protocol generation)',
    TRUE,
    NOW()
)
ON CONFLICT (prompt_key, version) DO UPDATE
SET
    content = EXCLUDED.content,
    description = EXCLUDED.description;

-- Ensure only version 2 is active for rag_instructions.
UPDATE public.system_prompts
SET
    is_active = CASE WHEN version = 2 THEN TRUE ELSE FALSE END,
    activated_at = CASE WHEN version = 2 THEN NOW() ELSE NULL END
WHERE prompt_key = 'rag_instructions';
