# Product Requirements Document (PRD)
## BFM Copilot - RAG Knowledge Base System

---

## TL;DR - What the RAG System Does

```
User asks question → Query analyzed → Embeddings generated → Vector search
→ Related conditions expanded → Results filtered by role → AI uses context to respond
```

**Key Settings:**
- Embedding model: `text-embedding-3-small` (1536 dimensions)
- Similarity threshold: `0.40`
- Chunk size: 500 tokens with 50 token overlap
- Vector index: IVFFlat with cosine distance

**Single Source of Truth:** Python agent at `/agent/rag/search`

---

## Known Issues (January 2026)

### Issue 1: Exact Word Matches Failing
**Symptom:** Searches for exact terms like "hypothyroidism" don't always return documents containing that exact word.

**Root Cause:** Semantic search optimizes for meaning, not lexical matching. A query embedding for "hypothyroidism" may not have high similarity (>0.40) with a chunk that discusses thyroid conditions using different terminology.

**Mitigation:** Lowered threshold from 0.60 → 0.45 → 0.40. Consider adding hybrid search (semantic + keyword).

### Issue 2: Tags Not Being Used
**Symptom:** The `bfm_search_20250122` SQL function accepts `p_tag_names` but ignores it.

**Impact:** Direct tag-based matching doesn't work. All matches are semantic-only.

**Status:** Documented for future fix. Requires SQL function update.

### Issue 3: Two RAG Implementations (RESOLVED)
**Previous State:** Python agent and JS `analysis-generator.ts` had separate RAG search logic.

**Resolution:** Unified to Python agent as single source of truth. All RAG searches now go through `/agent/rag/search`.

### Issue 4: Telemetry Gaps
**Previous State:** Python agent RAG searches weren't logged to `rag_logs` table.

**Resolution:** Added logging to track all searches for evaluation and debugging.

---

## 1. Overview

### 1.1 Product Name
BFM Copilot Knowledge Base System

### 1.2 Purpose
Build a comprehensive Retrieval-Augmented Generation (RAG) system that enables the BFM Copilot AI to access, retrieve, and intelligently utilize the clinic's proprietary health protocols, lab interpretation guides, and care documentation.

### 1.3 Problem Statement
Currently:
- System prompts are hardcoded and not configurable
- No structured way to load and organize health documentation
- AI cannot cross-reference related conditions or contraindications
- No versioning for prompt changes
- Practitioners cannot easily update knowledge base content

### 1.4 Success Criteria
- Practitioners can upload health documentation via admin UI
- AI intelligently retrieves relevant protocols AND related conditions
- System prompts are versioned and editable
- Clear file structure for bulk documentation loading
- Cross-referencing of conditions works automatically (e.g., thyroid issue -> also check adrenal, iron deficiency)

---

## 2. User Stories

### 2.1 Practitioner
> "As a practitioner, when I ask about a patient's thyroid issue, I want the AI to not only find thyroid protocols but also check for related conditions like adrenal fatigue and iron deficiency that commonly co-occur."

### 2.2 Admin
> "As an admin, I want to upload new health protocols as Markdown files and have them automatically indexed and searchable by the AI."

### 2.3 System Admin
> "As a system admin, I want to version system prompts so I can track changes and roll back if needed."

### 2.4 Clinic Owner
> "As the clinic owner, I want my proprietary IP and protocols loaded into a secure knowledge base that only my practitioners can access."

---

## 3. Functional Requirements

### 3.1 System Prompts Management

| ID | Requirement | Priority |
|----|-------------|----------|
| SP-1 | Store system prompts in database with version history | High |
| SP-2 | Seed initial prompts from SQL files via Supabase CLI | High |
| SP-3 | Track prompt changes with timestamps and author | Medium |
| SP-4 | Allow activating specific prompt versions | Medium |
| SP-5 | Fallback to defaults if database unavailable | High |

### 3.2 Document Management

| ID | Requirement | Priority |
|----|-------------|----------|
| DM-1 | Support Markdown files with YAML frontmatter | High |
| DM-2 | Categorize by body system (endocrine, cardiovascular, etc.) | High |
| DM-3 | Categorize by document type (protocol, lab interpretation, etc.) | High |
| DM-4 | Support tags for conditions, symptoms, lab markers | High |
| DM-5 | Track document version and last updated date | Medium |
| DM-6 | Support global docs (shared) and user-specific docs | Medium |

### 3.3 Smart RAG Search

| ID | Requirement | Priority |
|----|-------------|----------|
| RS-1 | Semantic vector search using pgvector | High |
| RS-2 | Extract conditions/tags from user queries automatically | High |
| RS-3 | Expand search to related conditions based on relationships | High |
| RS-4 | Support relationship types: comorbidity, contraindication, underlying_cause, symptom_overlap | High |
| RS-5 | Filter by body system and document category | Medium |
| RS-6 | Return match source (direct vs related) for transparency | Medium |

### 3.4 Condition Relationships

| ID | Requirement | Priority |
|----|-------------|----------|
| CR-1 | Define relationships between conditions | High |
| CR-2 | Support relationship strength (0-1 scale) | Medium |
| CR-3 | Support bidirectional relationships | Medium |
| CR-4 | Seed initial relationships from SQL files | High |

### 3.5 CLI Workflow

| ID | Requirement | Priority |
|----|-------------|----------|
| CL-1 | Use Supabase CLI for migrations | High |
| CL-2 | Seed data via `supabase db reset` | High |
| CL-3 | Python script to index documentation directory | High |
| CL-4 | Support dry-run mode to preview indexing | Low |

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Vector search should return results in < 500ms
- Query analysis should complete in < 1s
- Support knowledge base of 1000+ documents

### 4.2 Security
- Row-level security on all documents
- Users can only access their own docs + global docs
- Admin-only access to prompt management
- No PHI stored in prompts or tags

### 4.3 Scalability
- Batch embedding generation (100 texts per API call)
- Chunking strategy: 500 tokens per chunk, 50 token overlap
- IVFFlat index for vector similarity

### 4.4 Maintainability
- Clear directory structure for documentation
- JSON metadata files for category configuration
- Version-controlled seed files

---

## 5. Technical Architecture

### 5.1 Data Model

```
+------------------+     +-------------------+
| system_prompts   |     |  document_tags    |
+------------------+     +-------------------+
| prompt_key       |     | tag_name          |
| version          |     | tag_type          |
| content          |     | parent_tag_id     |
| is_active        |     +---------+---------+
+------------------+               |
                                   |
+------------------+     +---------+---------+
|   documents      |---->| document_tag_     |
+------------------+     | mappings          |
| body_system      |     +-------------------+
| document_        |
| category         |     +-------------------+
| is_global        |     | condition_        |
+---------+--------+     | relationships     |
          |              +-------------------+
          v              | condition_tag_id  |
+------------------+     | related_tag_id    |
| document_chunks  |     | relationship_     |
+------------------+     | type              |
| content          |     | strength          |
| embedding        |     +-------------------+
+------------------+
```

### 5.2 Smart Search Flow

```
User Query: "Patient has thyroid issues and fatigue"
                    |
                    v
+---------------------------------------+
|         Query Analyzer (GPT-4o)       |
|  Extract: thyroid, fatigue            |
|  Body systems: endocrine              |
|  Should expand: true                  |
+-----------------+---------------------+
                  |
                  v
+---------------------------------------+
|       Condition Expansion             |
|  thyroid -> adrenal_fatigue (0.7)     |
|  thyroid -> iron_deficiency (0.6)     |
|  fatigue -> depression (0.5)          |
+-----------------+---------------------+
                  |
                  v
+---------------------------------------+
|        Vector + Tag Search            |
|  * Direct semantic matches            |
|  * Tag-based matches                  |
|  * Related condition docs             |
+-----------------+---------------------+
                  |
                  v
+---------------------------------------+
|           Results                     |
|  [Direct] Thyroid Protocol            |
|  [Related] Adrenal Fatigue Guide      |
|  [Related] Iron Deficiency Info       |
+---------------------------------------+
```

---

## 6. File Structure

### 6.1 Documentation Directory
```
docs/
└── protocols/
    ├── _index.json                    # Master index
    ├── endocrine/
    │   ├── _category.json            # Category metadata
    │   ├── thyroid/
    │   │   ├── _conditions.json      # Relationships
    │   │   ├── hypothyroidism-protocol.md
    │   │   └── thyroid-lab-guide.md
    │   └── adrenal/
    │       └── adrenal-fatigue-protocol.md
    ├── cardiovascular/
    │   └── hypertension-protocol.md
    ├── care-guides/                   # Cross-system guides
    │   └── inflammation-protocol.md
    └── reference/
        └── lab-reference-values.md
```

### 6.2 Document Format
```markdown
---
title: Hypothyroidism Care Protocol
document_category: protocol
body_system: endocrine
tags:
  - hypothyroid
  - hashimotos
  - levothyroxine
related_conditions:
  - adrenal_fatigue
  - iron_deficiency
lab_markers:
  - TSH
  - Free_T4
  - Free_T3
version: 1.0
last_updated: 2025-01-01
---

# Hypothyroidism Care Protocol

[Content here...]
```

### 6.3 Supabase Seed Structure
```
supabase/
├── migrations/
│   ├── 20250102000000_system_prompts.sql
│   └── 20250102000001_document_categories.sql
└── seed/
    ├── seed.sql                       # Orchestrator
    ├── 01_system_prompts.sql          # Initial prompts
    ├── 02_document_tags.sql           # Tags
    └── 03_condition_relationships.sql # Relationships
```

---

## 7. Acceptance Criteria

### 7.1 System Prompts
- [ ] Prompts stored in database with version tracking
- [ ] Active prompt can be fetched by key
- [ ] New versions can be created without affecting active
- [ ] Specific versions can be activated
- [ ] Prompt history viewable by admins

### 7.2 Document Indexing
- [ ] Markdown files with frontmatter parsed correctly
- [ ] Body system and category extracted from frontmatter
- [ ] Tags extracted and linked to documents
- [ ] Embeddings generated and stored in pgvector
- [ ] CLI script indexes entire directory recursively

### 7.3 Smart Search
- [ ] Query analyzer extracts conditions from natural language
- [ ] Related conditions retrieved from database
- [ ] Vector search includes direct and related matches
- [ ] Results indicate match source (direct/related)
- [ ] Performance < 1s for complete search

### 7.4 CLI Workflow
- [ ] `supabase db reset` applies migrations + seeds
- [ ] `python scripts/index_docs.py ../docs/protocols` works
- [ ] Dry-run mode shows what would be indexed

---

## 8. Out of Scope (Future)

- Admin UI for prompt editing (will use database directly initially)
- Automatic condition relationship detection via AI
- Multi-language support
- Real-time document sync (manual re-indexing required)
- PDF parsing (convert to Markdown first)

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **RAG** | Retrieval-Augmented Generation - using retrieved documents to enhance AI responses |
| **Embedding** | Vector representation of text for similarity search |
| **Frontmatter** | YAML metadata at the top of Markdown files |
| **Body System** | Physiological system (endocrine, cardiovascular, etc.) |
| **Comorbidity** | Conditions that commonly occur together |
| **pgvector** | PostgreSQL extension for vector similarity search |

---

## 10. Implementation Plan

### Phase 1: Database Schema
1. Create `system_prompts` table migration
2. Create `document_tags`, `document_tag_mappings`, `condition_relationships` migrations
3. Add columns to `documents` table
4. Create smart search function

### Phase 2: Seed Data
1. Create seed file structure
2. Seed initial system prompts
3. Seed common health tags (conditions, symptoms, markers)
4. Seed condition relationships

### Phase 3: Documentation Structure
1. Create `docs/protocols/` directory
2. Create sample documents with frontmatter
3. Create category and condition JSON files

### Phase 4: Python Tools
1. Document processor (parse Markdown frontmatter)
2. Indexing script
3. Prompt service (database fetch)
4. Query analyzer
5. Enhanced RAG search

### Phase 5: Integration & Testing
1. Update system_prompts.py to use database
2. Update rag_search.py for smart search
3. End-to-end testing
4. Documentation

---

## 11. Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/20250102000000_system_prompts.sql` | **NEW** |
| `supabase/migrations/20250102000001_document_categories.sql` | **NEW** |
| `supabase/seed/seed.sql` | **NEW** |
| `supabase/seed/01_system_prompts.sql` | **NEW** |
| `supabase/seed/02_document_tags.sql` | **NEW** |
| `supabase/seed/03_condition_relationships.sql` | **NEW** |
| `supabase/config.toml` | Update seed paths |
| `docs/protocols/` | **NEW** directory structure |
| `python-agent/app/services/prompt_service.py` | **NEW** |
| `python-agent/app/tools/query_analyzer.py` | **NEW** |
| `python-agent/app/embeddings/doc_processor.py` | **NEW** |
| `python-agent/scripts/index_docs.py` | **NEW** |
| `python-agent/app/agent/system_prompts.py` | Update |
| `python-agent/app/tools/rag_search.py` | Update |
| `python-agent/app/services/supabase.py` | Update |
