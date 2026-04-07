# Clinic Copilot

An AI-powered clinical assistant platform combining Dr. Rob DeMartino's functional medicine protocols with advanced AI to provide clinical decision support for practitioners and personalized health insights for members.

## Overview

Clinic Copilot serves three distinct user types:

- **Practitioners/Clinics**: Healthcare providers analyzing patient lab results, managing diagnostics, creating treatment protocols, and tracking FSM (Frequency Specific Microcurrent) treatments
- **Members**: Individual users tracking personal health data, receiving AI-powered suggestions, and managing their health journey
- **Admins**: System administrators managing users, monitoring AI quality, and maintaining the knowledge base

## Key Features

### For Practitioners

**Lab Calculator**
- 80+ lab markers across 11 categories with optimal ranges
- PDF upload with AI extraction and editable preview
- Gender/age-specific optimal ranges
- Ominous marker detection (7 critical thresholds)
- Real-time calculation with delta from target
- Lab result export to PDF
- Incomplete lab saving with missing marker tracking

**Patient Management**
- Full CRUD operations for patient records
- Medical history, medications, allergies tracking
- Patient status management (active/inactive)
- Linked lab results and diagnostics

**Treatment Sessions (FSM)**
- Log Frequency-Specific Microcurrent treatments
- Select from 10+ seeded FSM frequencies
- Track session effects (positive/negative/nil)
- Link sessions to protocols
- Session notes and history

**Diagnostics Analysis**
- Upload diagnostic files (D-Pulse, HRV, mold toxicity, blood panel, etc.)
- AI-powered analysis in "Dr. Rob's voice"
- RAG-augmented insights from knowledge base
- Protocol recommendations with rationale
- Frequency and supplementation suggestions
- Execution tracking with outcomes

**Protocol Management**
- Create and manage treatment protocols
- Categories: detox, hormone, gut, immune, metabolic, neurological
- Status workflow: draft → active → completed/archived
- Outcome feedback with before/after lab comparison

### For Members

**My Labs**
- View and track personal lab results
- Historical trending with charts
- Understand what your numbers mean
- Manual entry or import from practitioner

**Suggestions**
- AI-generated wellness suggestions
- Categories: nutrition, lifestyle, exercise, sleep, stress
- Feedback system (accept/reject with notes)
- Iteration tracking for improved recommendations

**My Health**
- Personal health profile dashboard
- Recent lab summaries
- Conversation history
- Quick action links

**AI Health Assistant**
- Chat with AI about health questions
- Educational content from knowledge base
- Personalized guidance based on your data

### For Admins

**Dashboard**
- Overview metrics (users, patients, lab analyses)
- Quick access to all admin functions
- Recent user activity

**User Management**
- Create, edit, delete users
- Role assignment (admin, practitioner, member)
- User activity tracking

**RAG Monitoring**
- Query logs with response times
- Match quality distribution
- Empty result rate and error tracking
- Daily query volume charts

**Evaluation System**
- Review unevaluated AI responses
- Grade response quality (1-5)
- Track accuracy over time
- Export evaluation data

**Knowledge Base**
- Upload and manage documents
- Document categorization and tagging
- Role-scoped content (clinical vs educational)

### Shared Features

**AI Chat**
- Anthropic/OpenAI-powered assistant
- Streaming responses with real-time display
- Extended reasoning visualization
- Tool/function calling with display
- RAG-based knowledge retrieval
- Conversation persistence with star/archive

**Settings**
- Profile management with avatar upload
- Password change
- Notification preferences
- Role-specific settings panels

## Tech Stack

### Frontend
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **UI Components**: Custom components, Hugeicons, Lucide React
- **Rich Text**: TipTap editor
- **Animations**: Framer Motion
- **Data Visualization**: Recharts

### Backend
- **API Framework**: Next.js API Routes
- **Python Agent**: FastAPI for advanced AI processing
- **AI/LLM**: Anthropic Claude for chat/vision and OpenAI for embeddings
- **Vector Search**: pgvector for RAG embeddings

### Infrastructure
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with JWT, OAuth support
- **Storage**: Supabase Storage
- **Containerization**: Docker & Docker Compose

## RAG Architecture

The RAG (Retrieval-Augmented Generation) system is the core intelligence layer that powers AI responses.

### How It Works

```
User Query → Python Agent → Query Analysis (Claude Haiku)
    ↓
Embedding Generation (text-embedding-3-small)
    ↓
Vector Search (pgvector, threshold: 0.40)
    ↓
Role-Based Filtering → Results with Similarity Scores
```

### Key Settings
| Setting | Value |
|---------|-------|
| Embedding Model | `text-embedding-3-small` (1536 dimensions) |
| Similarity Threshold | 0.40 |
| Chunk Size | 500 tokens |
| Chunk Overlap | 50 tokens |
| Vector Index | IVFFlat with cosine distance |

### Single Source of Truth
All RAG searches route through the Python agent endpoint: `POST /agent/rag/search`

This ensures consistent search behavior across:
- AI Chat conversations
- Diagnostic analysis
- Protocol recommendations

### Diagnostics-to-Protocols Flow

The primary practitioner workflow:

```
1. Upload    → Diagnostic files to Supabase Storage
2. Extract   → Vision API (Claude Sonnet) extracts structured data
3. Analyze   → Python agent RAG + AI generates analysis
4. Recommend → AI suggests protocols based on knowledge base
5. Validate  → Frequencies checked against approved list
6. Approve   → Practitioner reviews recommendations
7. Execute   → Track outcomes for feedback loop
```

| Step | Endpoint |
|------|----------|
| Upload | `POST /api/diagnostics/upload` |
| Extract | `POST /api/diagnostics/files/[id]/extract` |
| Analyze | `POST /api/diagnostics/[id]/generate-analysis` |
| Approve | `POST /api/protocol-recommendations/[id]/approve` |
| Execute | `POST /api/protocol-recommendations/[id]/execute` |

## Project Structure

```
bfm-copilot/
├── src/                          # Next.js frontend
│   ├── app/
│   │   ├── (protected)/          # Auth-protected routes
│   │   │   ├── patients/         # Patient management
│   │   │   ├── labs/             # Lab calculator
│   │   │   ├── protocols/        # Protocol management
│   │   │   ├── diagnostics/      # Diagnostic uploads
│   │   │   ├── admin/            # Admin panel
│   │   │   ├── settings/         # User settings
│   │   │   ├── my-labs/          # Member lab tracking
│   │   │   ├── my-health/        # Member health dashboard
│   │   │   └── suggestions/      # Member suggestions
│   │   └── api/                  # API routes (70+)
│   ├── components/               # React components (80+)
│   │   ├── chat/                 # Chat interface
│   │   ├── patients/             # Patient components
│   │   ├── labs/                 # Lab components
│   │   ├── protocols/            # Protocol components
│   │   ├── diagnostics/          # Diagnostic components
│   │   ├── sidebar/              # Navigation
│   │   ├── settings/             # Settings panels
│   │   └── ui/                   # Base UI components
│   ├── hooks/                    # Custom React hooks (12)
│   ├── lib/                      # Utilities & integrations
│   │   ├── anthropic/            # Anthropic client layer
│   │   ├── rag/                  # RAG search & embeddings
│   │   ├── labs/                 # Lab calculator logic
│   │   └── supabase/             # Supabase clients
│   ├── types/                    # TypeScript definitions (155+)
│   └── data/                     # Static data (markers, rules)
├── python-agent/                 # Python backend
│   ├── app/
│   │   ├── main.py               # FastAPI entry point
│   │   ├── api/routes/           # API endpoints
│   │   ├── agent/                # AI agent config
│   │   ├── embeddings/           # RAG & vector search
│   │   └── tools/                # Agent tools
│   └── scripts/                  # CLI utilities
├── supabase/                     # Database (20 migrations)
├── docs/                         # Documentation
└── agent-assets/                 # Knowledge base files
```

## Getting Started

### Prerequisites

- Node.js 22+
- Python 3.11+
- Docker & Docker Compose
- Anthropic API key
- OpenAI API key
- Supabase project

### Environment Setup

1. Copy environment files:
   ```bash
   cp .env.local.example .env.local
   cp python-agent/.env.example python-agent/.env
   ```

2. Configure `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ANTHROPIC_API_KEY=your-anthropic-key
   OPENAI_API_KEY=your-openai-key
   PYTHON_AGENT_URL=http://localhost:8000
   # For hosted deployments, point this to your Railway agent URL instead
   # RAILWAY_PYTHON_AGENT_URL=https://your-agent-service.up.railway.app
   ```

### Local Development

**Frontend:**
```bash
npm install
npm run dev
```
App runs at http://localhost:3000

**Backend (Python Agent):**
```bash
cd python-agent
uv venv
source .venv/bin/activate
uv pip install -e .
uvicorn app.main:app --reload
```
API runs at http://localhost:8000

### Docker Deployment

Build and run all services:
```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Python Agent | http://localhost:8000 |

### Database Setup

Run migrations using Supabase CLI:
```bash
supabase db push
```

## Database Schema

### Core Tables (28+)

| Category | Tables |
|----------|--------|
| **Users** | profiles, user_preferences |
| **Patients** | patients, treatment_sessions, fsm_frequencies |
| **Labs** | lab_markers, lab_results, lab_values, target_ranges, evaluation_rules, ominous_markers, member_lab_values |
| **Chat** | conversations, messages |
| **Protocols** | protocols, protocol_feedback, protocol_recommendations, protocol_executions |
| **Suggestions** | suggestions, suggestion_feedback |
| **Diagnostics** | diagnostic_uploads, diagnostic_files, diagnostic_analyses |
| **RAG** | documents, document_chunks, document_categories, rag_logs, rag_evaluations, evaluation_sessions |
| **System** | feedback, usage_events, system_config, model_settings |

All tables have Row Level Security (RLS) policies.

## API Endpoints (70+)

### Core APIs
- `/api/patients` - Patient CRUD
- `/api/patients/[id]/sessions` - Treatment session logging
- `/api/labs/*` - Lab calculator, PDF parsing, results
- `/api/protocols` - Protocol management
- `/api/diagnostics` - Diagnostic uploads and analysis
- `/api/suggestions` - Member suggestions
- `/api/conversations` - Chat management
- `/api/frequencies` - FSM frequency data

### Admin APIs
- `/api/admin/users` - User management
- `/api/admin/analytics` - Usage analytics
- `/api/admin/telemetry` - RAG telemetry
- `/api/admin/evaluations` - Response evaluation
- `/api/admin/rag/logs` - Query logs

## Scripts

```bash
npm run dev          # Start frontend dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run type-check   # TypeScript check
```

## Security

- Non-root Docker execution
- JWT-based authentication via Supabase Auth
- Row-level security (RLS) on all database tables
- Role-based access control (Admin, Practitioner, Member)
- Service role keys kept server-side only
- OAuth support for social login

## Documentation

- `docs/PRD-CLINIC-COPILOT-V2.md` - Product requirements document
- `docs/COPILOT-PRD-2026.md` - Master product requirements
- `docs/PRD-rag-knowledge-base.md` - RAG system design
- `python-agent/README.md` - Backend setup guide

## User Flows

### Practitioner: Lab Analysis
1. Navigate to Labs → Select patient → Upload PDF or enter values
2. Review extracted values (editable) → Apply to form
3. View real-time calculations → Check ominous alerts
4. Save results → Export PDF report

### Practitioner: Patient Treatment
1. Navigate to Patients → Select patient → View profile
2. Upload diagnostics → Generate AI analysis
3. Review recommendations → Execute protocol
4. Log treatment sessions → Track outcomes

### Member: Health Tracking
1. Navigate to My Labs → Enter values → View trends
2. Chat with AI → Receive suggestions
3. Provide feedback → Track progress

### Admin: Quality Monitoring
1. View dashboard → Check RAG logs
2. Review unevaluated responses → Grade quality
3. Monitor accuracy → Manage users

## Built By

[Etho Inc.](https://etho.net)

## License

Proprietary and confidential. All rights reserved.

© Beyond Functional Medicine LLC and Dr. Rob DeMartino. Unauthorized copying, distribution, or use of this software is strictly prohibited.
