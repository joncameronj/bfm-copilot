# Clinic Copilot - Product Requirements Document (PRD)

**Version**: 2.2
**Last Updated**: January 2026
**Status**: Production Ready

---

## TL;DR - What This Product Does

**For Practitioners (Primary Use Case):**
```
Upload diagnostic files → AI extracts data → RAG finds relevant protocols
→ AI generates analysis in Dr. Rob's voice → Approve recommendations → Execute & track outcomes
```

**For Members:**
Track personal health data → Chat with AI → Receive suggestions → Provide feedback

**For Admins:**
Monitor AI quality → Manage users → Maintain knowledge base

---

## Core Flow: Diagnostics to Protocols

This is the primary value proposition for practitioners:

| Step | What Happens | Endpoint |
|------|--------------|----------|
| 1. **Upload** | Diagnostic files stored in Supabase Storage | `POST /api/diagnostics/upload` |
| 2. **Extract** | Vision API (GPT-4o) extracts structured data from images/PDFs | `POST /api/diagnostics/files/[id]/extract` |
| 3. **Analyze** | Python agent performs RAG search + generates AI analysis | `POST /api/diagnostics/[id]/generate-analysis` |
| 4. **Recommend** | AI suggests protocols with frequencies based on knowledge base | (part of analysis response) |
| 5. **Validate** | Frequencies validated against approved list (prevents hallucination) | (post-processing) |
| 6. **Approve** | Practitioner reviews and approves recommendations | `POST /api/protocol-recommendations/[id]/approve` |
| 7. **Execute** | Protocol executed, outcome tracked for feedback loop | `POST /api/protocol-recommendations/[id]/execute` |

### Key Files in This Flow
- `src/lib/rag/analysis-generator.ts` - Orchestrates the analysis
- `python-agent/app/api/routes/rag.py` - RAG search endpoint
- `python-agent/app/tools/rag_search.py` - Smart semantic search
- `src/lib/rag/frequency-validator.ts` - Validates AI-suggested frequencies

---

## RAG System Overview

The RAG (Retrieval-Augmented Generation) system is the core intelligence layer:

**What It Does:**
1. **Stores Knowledge**: Dr. Rob's protocols, Sunday seminar transcripts, lab guides, care protocols
2. **Searches Semantically**: Uses pgvector for vector similarity search (threshold: 0.40)
3. **Expands Related Conditions**: thyroid issues → also searches adrenal, iron deficiency
4. **Filters by Role**: Practitioners see clinical content, members see educational content

**Architecture:**
```
Query → Python Agent → Query Analysis (GPT-4o-mini) → Embedding Generation
    → Vector Search (pgvector) → Role Filtering → Results with Similarity Scores
```

**Single Source of Truth:** All RAG searches route through the Python agent at `/agent/rag/search`

---

## Executive Summary

### Product Vision
Clinic Copilot is an AI-powered clinical assistant platform combining Dr. Rob DeMartino's functional medicine protocols with advanced AI to provide clinical decision support for practitioners and personalized health insights for members.

The platform serves three distinct user roles:
- **Practitioners**: Healthcare providers analyzing patient labs, managing diagnostics, creating treatment protocols, and tracking FSM (Frequency Specific Microcurrent) treatments
- **Members**: Individual users managing personal health data, receiving AI recommendations, and tracking their health journey
- **Admins**: System administrators managing users, monitoring AI quality, and maintaining the knowledge base

### Success Metrics
| Metric | Target | Status |
|--------|--------|--------|
| Recommendation Acceptance Rate | 80% | Tracked via suggestion feedback |
| Protocol Success Rate | 80% | Tracked via protocol outcomes |
| RAG Response Accuracy | 80% | Tracked via evaluation system |
| User Engagement | Daily active users | Tracked via usage_events |

### Tech Stack
| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15+ (App Router), TypeScript, Tailwind CSS |
| **State** | Zustand, React Query patterns |
| **UI Components** | Custom components, Hugeicons, Lucide React, TipTap, Framer Motion |
| **Charts** | Recharts |
| **Backend** | Next.js API Routes, FastAPI (Python agent) |
| **Database** | Supabase (PostgreSQL), pgvector for embeddings |
| **Auth** | Supabase Auth with JWT, OAuth support |
| **Storage** | Supabase Storage |
| **AI/LLM** | OpenAI GPT-4/GPT-5, OpenAI Assistants API, Embeddings API |
| **Containerization** | Docker & Docker Compose |

---

## Implementation Status

### Completed Features (100%)

#### Phase 1: UI/UX Design
- [x] Collapsible sidebar (60px/280px) with icon-only mode
- [x] Role-based navigation (Practitioner/Member/Admin)
- [x] ChatGPT-style chat interface with streaming
- [x] Conversation list with star/archive
- [x] User menu with avatar support
- [x] Responsive design with mobile support

#### Phase 2: Profile & Settings
- [x] Settings page with role-specific sections
- [x] Profile picture upload to Supabase Storage
- [x] Password change functionality
- [x] Notification preferences
- [x] Archived chats drawer
- [x] Practitioner templates (protocol & feedback)

#### Phase 3: Feedback & Suggestions System
- [x] Suggestions table with status tracking
- [x] Suggestion feedback (thumbs up/down + text)
- [x] /suggestions page for members
- [x] Suggestion iteration history
- [x] Category support (nutrition, lifestyle, exercise, sleep, stress)

#### Phase 4: Protocol System
- [x] Protocols table with full CRUD
- [x] Protocol categories (detox, hormone, gut, immune, metabolic, neurological)
- [x] Protocol status workflow (draft → active → completed/archived)
- [x] Protocol feedback with outcomes (positive/negative/neutral/partial)
- [x] Before/after lab comparison in feedback
- [x] AI-powered protocol recommendations from diagnostics

#### Phase 5: Lab Tracking
- [x] Lab calculator with 80+ markers across 11 categories
- [x] PDF upload with AI extraction and editable preview
- [x] Gender/age-specific optimal ranges
- [x] Ominous marker detection (7 critical thresholds)
- [x] Lab result export to PDF
- [x] /my-labs page for members with history
- [x] Lab trending with historical charts
- [x] Incomplete lab saving with missing marker tracking

#### Phase 6: Admin Telemetry
- [x] Admin dashboard with key metrics
- [x] User management (create, edit, roles, delete)
- [x] RAG query logs with statistics
- [x] Evaluation system for AI response quality
- [x] Telemetry charts (queries, response times, accuracy)
- [x] Practitioner metrics view
- [x] Knowledge base document management
- [x] Model/LLM configuration settings

#### Additional Features Implemented

##### Treatment Sessions (FSM)
- [x] Treatment session logging per patient
- [x] FSM frequency database with 10+ seeded frequencies
- [x] Session effect tracking (positive/negative/nil)
- [x] Protocol linking to sessions
- [x] Session notes and history

##### Diagnostics & AI Analysis
- [x] Diagnostic file upload (D-Pulse, HRV, mold toxicity, blood panel, etc.)
- [x] AI-powered analysis generation ("Dr. Rob's voice")
- [x] RAG-augmented analysis using knowledge base
- [x] Protocol recommendation generation
- [x] Frequency and supplementation suggestions
- [x] Execution tracking with outcomes

##### RAG & Knowledge Base
- [x] Document upload and processing
- [x] Chunking with embedding generation (pgvector)
- [x] Semantic search for AI responses
- [x] Role-scoped content (clinical vs educational)
- [x] Document categorization system
- [x] Body system tagging

---

## User Roles & Permissions

### Role Definitions

```typescript
type UserRole = 'admin' | 'practitioner' | 'member'
```

### Permission Matrix

| Feature | Admin | Practitioner | Member |
|---------|-------|--------------|--------|
| AI Chat | ✓ | ✓ | ✓ |
| Lab Calculator | ✓ | ✓ | - |
| My Labs | - | - | ✓ |
| Patients | ✓ | ✓ | - |
| Protocols | ✓ | ✓ | - |
| Diagnostics | ✓ | ✓ | - |
| Suggestions | - | - | ✓ |
| My Health | - | - | ✓ |
| Admin Panel | ✓ | - | - |
| User Management | ✓ | - | - |
| Analytics | ✓ | - | - |
| Settings | ✓ | ✓ | ✓ |

### Navigation by Role

**Practitioners/Admin:**
- Diagnostics → /diagnostics
- Labs → /labs
- Patients → /patients
- Protocols → /protocols
- Admin → /admin (admin only)
- Settings → /settings

**Members:**
- Chat → /
- My Labs → /my-labs
- Suggestions → /suggestions
- My Health → /my-health
- Settings → /settings

---

## Feature Specifications

### 1. AI Chat System

#### Components
- `ChatInterface.tsx` - Main chat container
- `ChatMessage.tsx` - Message rendering with markdown
- `ChatInput.tsx` - Rich text input with TipTap
- `AgentSteps.tsx` - Agent workflow visualization
- `ReasoningDisplay.tsx` - Extended thinking display
- `ToolCallDisplay.tsx` - Tool execution display

#### Capabilities
- Streaming responses with real-time display
- Extended reasoning visualization
- Tool/function calling with display
- File upload in chat context
- Patient context injection
- Conversation persistence
- Star and archive conversations

#### Chat Flow
```
User Message → API Route → OpenAI Assistant → Stream Response
                     ↓
              RAG Search (if relevant)
                     ↓
              Tool Calls (patient lookup, lab analysis, etc.)
                     ↓
              Response with Citations
```

### 2. Lab Calculator

#### Categories (11)
1. Cardiac Function
2. Inflammation
3. Anemia
4. Lipids
5. Diabetes & Weight Management
6. Calcium, Bone & Mineral Health
7. Renal
8. Hepatic
9. Thyroid
10. Hormones
11. CBC with Differential

#### Features
- 80+ lab markers with optimal ranges
- PDF upload with AI extraction
- Editable preview before applying values
- Real-time calculation
- Delta from target display
- Ominous marker detection (3+ triggers alert)
- Missing marker highlighting (red-400/red-50)
- Incomplete save with tracking

#### Ominous Markers (7)
Critical values that trigger immediate alerts when 3+ are flagged.

### 3. Treatment Sessions (FSM)

#### Data Model
```typescript
interface TreatmentSession {
  id: string
  patientId: string
  practitionerId: string
  protocolId?: string
  sessionDate: string
  sessionTime?: string
  frequenciesUsed: FrequencyUsed[]
  effect: 'positive' | 'negative' | 'nil'
  notes?: string
}
```

#### FSM Frequencies
Database includes frequencies for:
- Inflammation
- Detoxification
- Cellular repair
- Nerve support
- And more...

### 4. Diagnostics Analysis Pipeline

#### Supported Types
- D-Pulse cardiac analysis
- HRV (Heart Rate Variability)
- Mold toxicity panels
- Blood panels
- NES Scan
- Urinalysis
- Other (generic)

#### Analysis Flow
```
Upload Diagnostic → Store in Supabase → Generate Analysis
                                              ↓
                                    RAG Search Knowledge Base
                                              ↓
                                    Generate Protocol Recommendations
                                              ↓
                                    Display with Execution Options
```

#### Analysis Output
- AI-generated analysis in "Dr. Rob's voice"
- Protocol recommendations with rationale
- Frequency recommendations
- Supplementation suggestions
- Lifestyle recommendations

### 5. Protocol System

#### Status Workflow
```
draft → active → completed
                → archived
                → superseded
```

#### Categories
- General
- Detox
- Hormone
- Gut
- Immune
- Metabolic
- Neurological

#### Feedback System
- Outcome tracking (positive/negative/neutral/partial)
- Thumbs up/down rating
- Before/after lab comparison
- Adjustment notes

### 6. Suggestions System (Members)

#### Categories
- Nutrition
- Lifestyle
- Exercise
- Sleep
- Stress

#### Status Workflow
```
pending → accepted → superseded (if iterated)
        → rejected
```

#### Iteration Flow
Member provides feedback → AI generates improved suggestion → Track history

### 7. Admin Dashboard

#### Overview Metrics
- Total users
- Active users (last 30 days)
- Total patients
- Lab analyses count
- Protocol success rate

#### RAG Monitoring
- Query logs with response times
- Match quality distribution
- Empty result rate
- Error tracking
- Daily query volume charts

#### Evaluation System
- Review unevaluated RAG logs
- Grade response quality (1-5)
- Track accuracy over time
- Export evaluation data

---

## Database Schema

### Core Tables (28+)

#### User & Auth
- `profiles` - Extended user data with role
- `user_preferences` - User settings

#### Patient Management
- `patients` - Patient demographics and history
- `treatment_sessions` - FSM session logs
- `fsm_frequencies` - Frequency database

#### Lab System
- `lab_markers` - Reference marker data
- `lab_results` - Lab test records
- `lab_values` - Individual test values
- `target_ranges` - Gender/age-specific ranges
- `evaluation_rules` - Assessment rules
- `ominous_markers` - Critical thresholds
- `member_lab_values` - Self-entered member labs

#### Conversations
- `conversations` - Chat sessions
- `messages` - Chat messages

#### Protocols
- `protocols` - Treatment plans
- `protocol_feedback` - Outcome tracking
- `protocol_recommendations` - AI recommendations
- `protocol_executions` - Execution logs

#### Suggestions
- `suggestions` - Member suggestions
- `suggestion_feedback` - Member feedback

#### Diagnostics
- `diagnostic_uploads` - Upload records
- `diagnostic_files` - File storage
- `diagnostic_analyses` - AI analyses

#### RAG & Knowledge Base
- `documents` - Knowledge base docs
- `document_chunks` - Text chunks with embeddings
- `document_categories` - Categorization
- `rag_logs` - Query telemetry
- `rag_evaluations` - Response ratings
- `evaluation_sessions` - Evaluation groups

#### System
- `feedback` - User feedback
- `usage_events` - Activity tracking
- `system_config` - Admin configuration
- `model_settings` - LLM configuration

---

## API Endpoints

### Patient APIs
```
GET/POST    /api/patients
GET/PUT     /api/patients/[id]
GET/POST    /api/patients/[id]/sessions
GET/PUT/DEL /api/patients/[id]/sessions/[sessionId]
```

### Lab APIs
```
POST        /api/labs/calculate
POST        /api/labs/parse-pdf
GET         /api/labs/markers
GET         /api/labs/categories
GET/POST    /api/labs/results
POST        /api/labs/export-pdf
```

### Protocol APIs
```
GET/POST    /api/protocols
GET/PUT/DEL /api/protocols/[id]
POST        /api/protocols/[id]/feedback
```

### Suggestion APIs
```
GET/POST    /api/suggestions
GET/PUT     /api/suggestions/[id]
POST        /api/suggestions/[id]/feedback
GET         /api/suggestions/[id]/history
```

### Diagnostic APIs
```
GET/POST    /api/diagnostics
POST        /api/diagnostics/upload
POST        /api/diagnostics/[id]/analyze
```

### Chat APIs
```
GET/POST    /api/conversations
GET/PUT/DEL /api/conversations/[id]
GET/POST    /api/conversations/[id]/messages
```

### Admin APIs
```
GET/POST    /api/admin/users
GET/PUT/DEL /api/admin/users/[id]
GET         /api/admin/analytics
GET         /api/admin/telemetry
GET         /api/admin/rag/logs
GET/POST    /api/admin/evaluations
```

---

## UX/UI Pipelines

### Practitioner Flow: Lab Analysis
```
1. Navigate to Labs (/labs)
2. Select patient (optional)
3. Upload PDF or enter values manually
4. Review extracted values (editable)
5. Apply values to form
6. View real-time calculations
7. Check ominous marker alerts
8. Save results (complete or incomplete)
9. Export PDF report
```

### Practitioner Flow: Patient Treatment
```
1. Navigate to Patients (/patients)
2. Select patient
3. View patient profile
4. Upload diagnostic files
5. Generate AI analysis
6. Review recommendations
7. Execute protocol
8. Log treatment sessions
9. Track outcomes
```

### Member Flow: Health Tracking
```
1. Navigate to My Labs (/my-labs)
2. Enter lab values
3. View historical trends
4. Chat with AI about results
5. Receive suggestions
6. Provide feedback
7. Track progress over time
```

### Admin Flow: Quality Monitoring
```
1. Navigate to Admin (/admin)
2. View overview metrics
3. Check RAG logs
4. Review unevaluated responses
5. Grade AI quality
6. Monitor accuracy trends
7. Upload knowledge base docs
8. Manage users
```

---

## Future Enhancements (Suggested)

### High Priority
1. **Mobile App** - Native iOS/Android for patients
2. **Appointment Scheduling** - Integrate with calendar systems
3. **Patient Portal** - Direct patient access with practitioner link
4. **Billing Integration** - Connect to practice management systems
5. **Multi-clinic Support** - Organization hierarchy

### Medium Priority
1. **Advanced Analytics** - Cohort analysis, outcome predictions
2. **Protocol Templates Library** - Shareable protocol templates
3. **Lab Integration** - Direct lab result import (Quest, LabCorp)
4. **Wearable Integration** - Apple Health, Fitbit, Oura
5. **Video Consultation** - Telehealth integration

### Lower Priority
1. **Community Features** - Member forums, groups
2. **Educational Content** - Course/module system
3. **Gamification** - Health achievements, streaks
4. **Family Accounts** - Linked family member tracking
5. **Export/Print Reports** - Comprehensive patient reports

---

## Design System

### Color Tokens
| Token | Value | Usage |
|-------|-------|-------|
| Primary | #1E42FC (brand-blue) | Primary actions |
| Background | #FFFFFF | Main content |
| Sidebar BG | #FAFAFA (neutral-50) | Sidebar background |
| Border | #E5E5E5 (neutral-200) | Borders |
| Text Primary | #171717 (neutral-900) | Main text |
| Text Secondary | #737373 (neutral-500) | Secondary text |
| Success | #22C55E (green-500) | Positive states |
| Warning | #F59E0B (amber-500) | Warnings |
| Error | #EF4444 (red-500) | Errors |

### Component Patterns
- Cards use `rounded-2xl` with `bg-neutral-50`
- Buttons use `rounded-lg` or `rounded-full`
- Inputs use `rounded-lg` with focus ring
- Modals use `rounded-2xl` with backdrop blur

### Status Indicators
- **Positive**: `bg-green-100 text-green-700`
- **Negative**: `bg-red-100 text-red-700`
- **Neutral**: `bg-neutral-100 text-neutral-600`
- **Warning**: `bg-yellow-100 text-yellow-700`
- **Info**: `bg-blue-100 text-blue-700`

---

## Files Structure

### Key Directories
```
src/
├── app/
│   ├── (protected)/          # Auth-protected routes
│   │   ├── patients/         # Patient CRUD
│   │   ├── labs/             # Lab calculator
│   │   ├── protocols/        # Protocol management
│   │   ├── diagnostics/      # Diagnostic uploads
│   │   ├── admin/            # Admin panel
│   │   ├── settings/         # User settings
│   │   ├── my-labs/          # Member labs
│   │   ├── my-health/        # Member health
│   │   └── suggestions/      # Member suggestions
│   └── api/                  # API routes
├── components/
│   ├── chat/                 # Chat UI
│   ├── patients/             # Patient components
│   ├── labs/                 # Lab components
│   ├── protocols/            # Protocol components
│   ├── diagnostics/          # Diagnostic components
│   ├── sidebar/              # Navigation
│   ├── settings/             # Settings panels
│   └── ui/                   # Base components
├── hooks/                    # Custom hooks
├── lib/                      # Utilities
├── types/                    # TypeScript types
└── data/                     # Static data
```

---

## Legal Compliance - Member-Side Restrictions

### Critical Requirements

The member-facing AI operates under strict legal constraints to ensure compliance with healthcare regulations. These restrictions are enforced at the system prompt level and cannot be overridden.

#### What Members CANNOT Receive

| Restricted Content | Reason |
|--------------------|--------|
| Treatment protocols | Requires licensed practitioner supervision |
| FSM frequencies | Clinical intervention requiring training |
| Supplement dosages (mg, IU, ml) | Medical recommendation requiring evaluation |
| Medication recommendations | Requires prescription authority |
| Clinical treatment sequences | Practitioner-only content |
| Case study clinical details | Protected health information concerns |

#### What Members CAN Receive

| Allowed Content | Examples |
|-----------------|----------|
| Educational explanations | "Research suggests vitamin D supports immune function" |
| General wellness concepts | How circadian rhythm affects sleep quality |
| Lifestyle information | Benefits of morning light exposure |
| Lab result explanations | What HRV measurements indicate |
| Source citations | PubMed references, Jack Kruse content |

#### Mandatory Disclaimers

Every health-related response to members must include:

> "This information is for educational purposes only and is not medical advice. Please consult with your healthcare practitioner for personalized recommendations."

#### Deferral Language

When members ask for protocols or treatments, the AI must respond:

> "For specific treatment protocols, please work with your BFM practitioner who can provide personalized recommendations based on your individual health data and history."

### Implementation

Legal restrictions are enforced via:
1. **System Prompts**: `MEMBER_LEGAL_RESTRICTIONS` constant in `python-agent/app/agent/system_prompts.py`
2. **Role-Based Filtering**: RAG search filters clinical content from member queries
3. **Role Scope**: Documents tagged with `role_scope: "clinical"` are hidden from members

### Compliance Monitoring

- Admin telemetry tracks all member AI responses
- RAG logs show which content was retrieved per role
- Evaluation system allows quality review of member interactions

---

## Notes

- All features use Supabase RLS for row-level security
- OpenAI Assistants API powers the chat system
- RAG uses pgvector for semantic search
- File uploads go to Supabase Storage
- Real-time features use Supabase subscriptions where needed
- **Member AI responses are subject to legal compliance restrictions (see above)**
