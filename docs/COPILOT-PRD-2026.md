# Clinic Copilot - Master PRD

**Document Version:** 3.0
**Last Updated:** December 29, 2025
**Status:** Ready for Development
**Owner:** Beyond Functional Medicine

---

## Executive Summary

Clinic Copilot is an AI-powered clinical platform for Beyond Functional Medicine with **two user types**:
1. **Practitioners** - Dr. DiMartino's clinical consultancy clients (full access)
2. **Members** - At-home program users (self-service, personal health tracking)

It combines Dr. Robert DiMartino's (D.C., Q.N.P.) proprietary protocols with advanced AI to help analyze patient data, interpret lab results, and generate care recommendations.

**Tech Stack:** Next.js 14+ | Tailwind CSS | Supabase | OpenAI Assistant API

---

## User Roles

| Role | Who | Account Creation | Access Level |
|------|-----|------------------|--------------|
| **Admin** | Dr. Rob / system admins | Manual | Full system access |
| **Practitioner** | Clinical consultancy clients | Admin creates | Full clinical (patients, diagnostics) |
| **Member** | At-home program users | Self-serve signup | Self only (no diagnostics) |

---

## Workstream Assignments

This PRD has been split into **5 parallel workstreams** for concurrent development.

| Workstream | File | Owner | Focus Area |
|------------|------|-------|------------|
| **WS-1** | `PRD-WS1-FOUNDATION.md` | Engineer 1 | Foundation, Auth (basic), Database, Design System |
| **WS-2** | `PRD-WS2-CHAT-AI.md` | Engineer 2 | Chat Interface, OpenAI Integration, Voice |
| **WS-3** | `PRD-WS3-LAB-CALCULATOR.md` | Engineer 3 | Lab Calculator, 80+ Markers, Ominous Detection |
| **WS-4** | `PRD-WS4-PATIENTS-DASHBOARD.md` | Engineer 4 | Patients, Dashboard (practitioner), Diagnostics, Feedback |
| **WS-5** | `PRD-WS5-ROLES-ANALYTICS.md` | Engineer 5 | **Roles, Admin Panel, Analytics, Member Features** |

---

## Dependency Graph

```
WEEK 1-2: FOUNDATION PHASE
┌─────────────────────────────────────────────────────────────────────────┐
│  WS-1: Foundation (CRITICAL PATH - Others can mock/plan in parallel)   │
│  Deliverables: Project setup, DB schema, Auth, Design system, UI kit   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
       ┌────────────────┬───────────┼───────────┬────────────────┐
       │                │           │           │                │
       ▼                ▼           ▼           ▼                ▼
WEEK 3-7: PARALLEL DEVELOPMENT
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  WS-2: Chat  │ │  WS-3: Labs  │ │ WS-4: Patients│ │ WS-5: Roles  │
│  & AI        │ │  Calculator  │ │ & Dashboard  │ │ & Analytics  │
│              │ │              │ │              │ │              │
│ - Chat UI    │ │ - Lab form   │ │ - Patient    │ │ - Role system│
│ - OpenAI API │ │ - 80+ markers│ │   CRUD       │ │ - Admin panel│
│ - Streaming  │ │ - Evaluations│ │ - Dashboard  │ │ - User mgmt  │
│ - Voice      │ │ - Ominous    │ │ - Diagnostics│ │ - Analytics  │
│              │ │              │ │ - Feedback   │ │ - My Health  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
       │                │           │                    │
       │                │           │     ◄──────────────┘
       │                │           │     (WS-5 provides tracking hooks)
       └────────────────┴───────────┴────────────────────┘
                                    ▼
WEEK 8: INTEGRATION
┌─────────────────────────────────────────────────────────────────────────┐
│  ALL WORKSTREAMS: Integration, Testing, Bug Fixes, Polish              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Timeline Overview

### Phase 1: MVP (Weeks 1-8)

| Week | WS-1 Foundation | WS-2 Chat/AI | WS-3 Labs | WS-4 Patients | WS-5 Roles/Analytics |
|------|-----------------|--------------|-----------|---------------|----------------------|
| **1** | Project setup, Tailwind | UI mockups | Data model, CSV | Data model | Planning, mocking |
| **2** | DB schema, Auth, Design | Component scaffolding | Seed script | Patient schema | Planning, mocking |
| **3** | UI component library | Chat interface UI | Lab form UI | Patient CRUD API | Role middleware, routes |
| **4** | Polish, documentation | OpenAI integration | Marker inputs | Patient list UI | Admin user management |
| **5** | Bug fixes, support | Streaming responses | Evaluation engine | Dashboard layout | Usage tracking system |
| **6** | Integration support | Conversation mgmt | Ominous alerts | Diagnostics upload | Admin analytics dashboard |
| **7** | Integration support | Sidebar, voice input | PDF parsing, export | Feedback UI | Member features, signup |
| **8** | **Integration** | **Integration** | **Integration** | **Integration** | **Integration** |

### Phase 2: Enhanced Features (Weeks 9-16)
- Lab history comparison & trends
- Advanced diagnostic AI analysis
- Treatment protocol tracking
- Mobile responsiveness

### Phase 3: Optimization (Weeks 17-24)
- Performance optimization
- Advanced admin features
- Analytics & reporting
- Security audit

---

## Shared Contracts

### File Structure Ownership
```
src/
├── app/
│   ├── (auth)/              # WS-1 owns (login, forgot-password)
│   │   └── signup/          # WS-5 owns (member self-registration)
│   ├── (protected)/
│   │   ├── layout.tsx       # WS-1 owns (shell), WS-2 owns (sidebar)
│   │   ├── page.tsx         # WS-2 owns (chat landing)
│   │   ├── dashboard/       # WS-4 owns (practitioner dashboard)
│   │   ├── my-health/       # WS-5 owns (member dashboard)
│   │   ├── patients/        # WS-4 owns
│   │   ├── labs/            # WS-3 owns
│   │   ├── diagnostics/     # WS-4 owns
│   │   └── admin/
│   │       ├── page.tsx     # WS-5 owns (admin home)
│   │       ├── users/       # WS-5 owns (user management)
│   │       └── analytics/   # WS-5 owns (usage analytics)
│   └── api/
│       ├── auth/            # WS-1 owns
│       ├── conversations/   # WS-2 owns
│       ├── assistants/      # WS-2 owns
│       ├── labs/            # WS-3 owns
│       ├── patients/        # WS-4 owns
│       ├── diagnostics/     # WS-4 owns
│       ├── feedback/        # WS-4 owns
│       └── admin/           # WS-5 owns (users, analytics)
├── components/
│   ├── ui/                  # WS-1 owns (shared)
│   ├── chat/                # WS-2 owns
│   ├── sidebar/             # WS-2 owns (WS-5 adds role-aware logic)
│   ├── labs/                # WS-3 owns
│   ├── patients/            # WS-4 owns
│   ├── dashboard/           # WS-4 owns
│   ├── diagnostics/         # WS-4 owns
│   ├── feedback/            # WS-4 owns
│   └── admin/               # WS-5 owns (UserTable, AnalyticsDashboard)
├── lib/
│   ├── supabase/            # WS-1 owns
│   ├── openai/              # WS-2 owns
│   ├── labs/                # WS-3 owns
│   ├── auth/                # WS-5 owns (roles.ts, permissions)
│   └── tracking/            # WS-5 owns (events.ts)
├── hooks/                   # Owner depends on hook purpose
├── types/
│   ├── database.ts          # WS-1 owns (generated)
│   ├── shared.ts            # WS-1 owns (shared interfaces)
│   ├── chat.ts              # WS-2 owns
│   ├── labs.ts              # WS-3 owns
│   ├── patient.ts           # WS-4 owns
│   └── roles.ts             # WS-5 owns
├── middleware.ts            # WS-5 owns (role-based routing)
└── data/                    # WS-3 owns (lab marker data)
```

### Shared TypeScript Interfaces

All engineers must use these interfaces for cross-workstream integration:

```typescript
// types/shared.ts - WS-1 creates, all use

export type UserRole = 'admin' | 'practitioner' | 'member';

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  status: 'active' | 'inactive';
  selfPatientId: string | null; // For members only (links to their patient record)
  createdAt: Date;
  updatedAt: Date;
}

export interface Patient {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other';
  status: 'active' | 'inactive';
}

export interface PatientContext {
  gender: 'male' | 'female';
  age: number;
}

export interface Conversation {
  id: string;
  userId: string;
  patientId: string | null;
  title: string;
  threadId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LabResult {
  id: string;
  patientId: string;
  testDate: Date;
  ominousCount: number;
  createdAt: Date;
}
```

### API Response Format

All API routes return consistent format:

```typescript
// Success
{ data: T, error: null }

// Error
{ data: null, error: { message: string, code: string } }
```

### Environment Variables
```env
# All workstreams need these
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_ASSISTANT_ID=
```

---

## Design System (All Workstreams)

### Brand Colors
| Token | Value | Usage |
|-------|-------|-------|
| `brand-blue` | `#1E42FC` | Gradient start, primary actions |
| `brand-cyan` | `#01BEF9` | Gradient end |
| `neutral-50` | `#fafafa` | Subtle backgrounds |
| `neutral-100` | `#f5f5f5` | Card backgrounds |
| `neutral-500` | `#737373` | Secondary text |
| `neutral-900` | `#171717` | Primary text |
| `error` | `#EF4444` | Errors, critical alerts |
| `success` | `#22C55E` | Success states |

### Typography
- **Font:** Inter (Google Fonts)
- **Letter-spacing:** -0.05em (global)
- **Weights:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Design Rules (MANDATORY)
1. **NO drop shadows** - Use color for depth
2. **NO borders** - Use spacing and background color
3. **NO icons on workflow buttons** - Text only
4. **Flat design** - Clean, minimal aesthetic
5. **Light theme** - White backgrounds primary

---

## Integration Checkpoints

### Week 2: Foundation Handoff
- [ ] WS-1 delivers: Project running, DB schema deployed, Auth working, UI components
- [ ] WS-2, WS-3, WS-4, WS-5 can: Start building on foundation

### Week 4: First Integration
- [ ] WS-2: Chat UI renders, can send messages (mocked response OK)
- [ ] WS-3: Lab form renders, markers load from DB
- [ ] WS-4: Patient CRUD works, list displays
- [ ] WS-5: Role middleware works, admin routes protected

### Week 6: Second Integration
- [ ] WS-2: OpenAI streaming works end-to-end
- [ ] WS-3: Full evaluation engine, ominous alerts work
- [ ] WS-4: Dashboard shows real data, diagnostics upload works
- [ ] WS-5: Admin user management works, analytics shows data

### Week 8: MVP Complete
- [ ] All features integrated and functional
- [ ] Practitioner flow: create patient → enter labs → chat about results
- [ ] Member flow: signup → enter labs → chat → view My Health
- [ ] Admin flow: manage users → view analytics → see protocol accuracy
- [ ] Critical path tested end-to-end for all roles

---

## Communication Protocol

### Daily Standups
- Report: Yesterday, Today, Blockers
- Cross-workstream blockers escalated immediately

### Blockers
- If blocked by another workstream: Slack within 2 hours
- Resolution expected within 24 hours
- If unresolved: Escalate to project lead

### Code Reviews
- All PRs need 1 reviewer from different workstream
- WS-1 reviews all shared/infrastructure code
- Integration code needs 2 reviewers

### Branch Strategy
```
main              # Production
├── develop       # Integration branch
├── ws1/feature-x # WS-1 feature branches
├── ws2/feature-y # WS-2 feature branches
├── ws3/feature-z # WS-3 feature branches
├── ws4/feature-w # WS-4 feature branches
└── ws5/feature-v # WS-5 feature branches
```

---

## Success Criteria

### MVP (Week 8)

**All Users:**
- [ ] Can sign up (members) or be created by admin (practitioners)
- [ ] Can log in, log out, reset password
- [ ] Can have streaming AI conversation
- [ ] Can enter lab values and see BFM evaluations
- [ ] Ominous markers alert displays when 3+ triggered

**Practitioners:**
- [ ] Can create and manage multiple patients
- [ ] Can upload diagnostics for AI analysis
- [ ] Can view practitioner dashboard with statistics

**Members:**
- [ ] Can self-register and access My Health dashboard
- [ ] See "care recommendations" terminology (not protocols)
- [ ] Can only see their own data (no diagnostics section)

**Admins:**
- [ ] Can manage all users (create, edit roles, deactivate)
- [ ] Can view protocol accuracy (0-100%)
- [ ] Can see per-user usage statistics
- [ ] Can configure AI model settings

**Integration:**
- [ ] All 5 workstreams integrated seamlessly
- [ ] Role-based routing works correctly
- [ ] Usage events logged across features

### Quality Gates
- All tests passing
- No P0/P1 bugs
- TTFB < 200ms
- LCP < 2.5s
- WCAG 2.1 AA compliant

---

## Individual PRD Files

Each engineer should read:
1. This master PRD (shared context)
2. Their assigned workstream PRD (detailed specs)

| File | Engineer | Focus |
|------|----------|-------|
| `PRD-WS1-FOUNDATION.md` | Engineer 1 | Foundation, Auth, DB, UI |
| `PRD-WS2-CHAT-AI.md` | Engineer 2 | Chat, OpenAI, Voice |
| `PRD-WS3-LAB-CALCULATOR.md` | Engineer 3 | Labs, Markers, Ominous |
| `PRD-WS4-PATIENTS-DASHBOARD.md` | Engineer 4 | Patients, Dashboard, Diagnostics |
| `PRD-WS5-ROLES-ANALYTICS.md` | Engineer 5 | Roles, Admin, Analytics, Members |

---

*Document Version 3.0 - Split for 5 concurrent engineers with multi-role architecture*
