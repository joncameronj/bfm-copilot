# BFM Copilot - Next Steps Product Requirements Document

## Executive Summary

This document outlines the recommended next steps for improving system health monitoring, testing, and reliability for BFM Copilot. The system currently has a solid foundation with a comprehensive health check endpoint (`/api/admin/health`), but lacks automated testing frameworks and production monitoring infrastructure.

**Current Status**: System is functional with manual health checks available. **Gap**: No automated testing or error tracking.

---

## Current State Assessment

### What Exists ✅

1. **Comprehensive Health Check Endpoint** (`/api/admin/health`)
   - Monitors 11 services: Supabase DB, Supabase Auth, Python Agent, Anthropic/OpenAI APIs, + 7 internal APIs
   - Tracks response times with thresholds (healthy/degraded/unhealthy)
   - Maintains failure history (last 10 failures per service)
   - Admin-only access control
   - Response time targets:
     - Database: <200ms healthy, <500ms degraded
     - External APIs: <1000ms healthy, <3000ms degraded
     - Internal APIs: <300ms healthy, <800ms degraded

2. **Docker Health Monitoring**
   - Python agent container has health checks configured
   - 30-second intervals, 10-second timeout

3. **Supabase Infrastructure**
   - Row Level Security (RLS) on all database tables
   - Role-based access control (admin, practitioner, member)
   - Connection pooling and query optimization

### Critical Gaps ❌

1. **No Automated Testing Framework**
   - No Jest, Vitest, or Playwright tests
   - No pytest tests in Python agent
   - 0% test coverage

2. **No Structured Logging**
   - Minimal logging in Python agent
   - No correlation IDs for request tracing
   - No log aggregation

3. **No Error Monitoring**
   - No Sentry integration
   - No Datadog or New Relic APM
   - No error alerts

4. **No Synthetic Monitoring**
   - No uptime monitoring service (UptimeRobot, Pingdom, etc.)
   - No periodic health checks
   - No geographic distributed testing

5. **No E2E Tests**
   - Critical user flows untested
   - No regression detection
   - Manual testing only

---

## Critical System Components

### Core User Flows (Priority Order)

**Tier 1: MUST WORK (System unusable if broken)**
1. **Authentication** - Magic link request → email → link click → login → session
2. **Database** - Supabase connectivity, query execution, RLS enforcement
3. **Chat** - Message send → Python agent → Anthropic API → response → save

**Tier 2: CORE FEATURES (Major functionality broken)**
4. **Lab Processing** - PDF/image upload → Vision API extraction → marker matching
5. **Diagnostic Analysis** - RAG search → frequency validation → protocol generation
6. **Patient Management** - CRUD operations, filters, search

**Tier 3: SUPPORTIVE (Degraded experience)**
7. **File Uploads** - Anthropic diagnostic extraction integration
8. **Analytics** - Usage tracking, dashboard stats

### External Dependencies

- **Supabase** - Authentication, PostgreSQL database, storage
- **Anthropic/OpenAI** - Chat completions, Vision API, embeddings
- **Python Agent** - FastAPI service at `http://localhost:8000`
- **Google Cloud** (optional) - If using for storage/analytics

---

## Recommended Implementation Timeline

### Phase 1: Immediate (This Week - 30 minutes)
**Goal**: Establish baseline health and manual testing procedures

- [ ] **Test Health Check Endpoint** (5 min)
  - Visit `/api/admin/health` as admin user
  - Verify all 11 services show "healthy" status
  - Document baseline response times

- [ ] **Manual User Flow Testing** (15 min)
  - Authentication: Request magic link → click → login → verify session
  - Chat: Send message → verify streaming response → save
  - Labs: Upload PDF → verify Vision extraction
  - Patients: Create → list → edit

- [ ] **Database Health Verification** (5 min)
  - Check Supabase dashboard for query performance
  - Monitor connection pool usage
  - Check storage usage trends

- [ ] **Document Results** (5 min)
  - Save baseline metrics
  - Document any issues found
  - Create testing checklist

### Phase 2: Short-term (Next 2 Weeks - 5 hours)
**Goal**: Set up automated monitoring and basic E2E tests

- [ ] **Set Up Uptime Monitoring** (15 min)
  - Sign up for UptimeRobot free tier
  - Add 3 endpoints: `/`, `/api/admin/health`, Python agent `/health`
  - Configure email/Slack alerts
  - Set thresholds: 5xx errors, >5s response time, >2min downtime

- [ ] **Add Playwright E2E Tests** (3-4 hours)
  - Install: `npm install -D @playwright/test`
  - Create test directory: `tests/smoke/`
  - Write 3 smoke tests:
    ```
    tests/smoke/auth.spec.ts
    tests/smoke/chat.spec.ts
    tests/smoke/health.spec.ts
    ```
  - Add GitHub Actions workflow to run on every push
  - Document how to run locally

- [ ] **Create Testing Documentation** (30 min)
  - Add `docs/testing.md` with:
    - How to run tests locally
    - How to interpret test results
    - How to add new tests
    - Known limitations and flaky tests

### Phase 3: Medium-term (This Month - 1-2 days)
**Goal**: Comprehensive test coverage and error tracking

- [ ] **Add Unit Tests** (4-6 hours)
  - Install Vitest: `npm install -D vitest`
  - Test critical functions:
    - Health checkers (`/src/lib/health/checkers.ts`)
    - RAG analysis generator (`/src/lib/rag/analysis-generator.ts`)
    - Auth middleware (`/src/middleware.ts`)
  - Target: 70%+ coverage on critical paths

- [ ] **Add Python Agent Tests** (2-3 hours)
  - Write pytest tests for:
    - Health endpoint (`/health`)
    - Chat endpoint (`/agent/chat`)
    - RAG search functionality
  - Document test patterns

- [ ] **Implement Sentry Error Tracking** (2-3 hours)
  - Set up Sentry account (free tier)
  - Add Next.js integration
  - Add Python agent integration
  - Configure alert thresholds
  - Test error capture

- [ ] **Add Structured Logging** (3-4 hours)
  - Frontend: Implement Pino logger
  - Backend: Implement structlog or loguru
  - Add correlation IDs for request tracing
  - Log critical events:
    - Authentication attempts
    - API request/response
    - Database queries
    - Anthropic/OpenAI API calls

### Phase 4: Long-term (Next 3 Months)
**Goal**: Production monitoring and observability

- [ ] **Performance Monitoring (APM)**
  - Integrate DataDog or New Relic
  - Track API response times
  - Monitor database query performance
  - Alert on performance degradation

- [ ] **Synthetic Monitoring**
  - Set up Checkly or similar
  - Periodic automated user flow tests
  - Geographic distributed checks
  - Custom metrics and alerts

- [ ] **Observability Dashboard**
  - Centralized health status
  - Historical trends
  - Performance metrics
  - Alert management

- [ ] **Incident Response Plan**
  - Define escalation procedures
  - Create runbooks for common issues
  - Set up on-call rotation
  - Document post-mortem process

---

## Success Metrics

### Immediate (This Week)
- ✅ Health check endpoint returns "healthy" for all 11 services
- ✅ All manual user flows complete successfully
- ✅ Zero critical issues in test results
- ✅ Baseline metrics documented

### Short-term (This Month)
- ✅ Uptime monitoring active with <2min MTTD (mean time to detect)
- ✅ E2E test suite passing on every deploy
- ✅ 3 smoke tests passing consistently
- ✅ Magic link authentication success rate >99%
- ✅ Chat message response time <5 seconds
- ✅ Zero downtime detected by uptime monitor

### Long-term (3 Months)
- ✅ Unit test coverage >70% on critical paths
- ✅ E2E test coverage for all critical user flows
- ✅ Sentry error tracking capturing 100% of errors
- ✅ Mean time to resolution (MTTR) <30 minutes
- ✅ 99.9% uptime SLA
- ✅ Comprehensive monitoring dashboard live
- ✅ All team members trained on incident response

---

## Implementation Guide

### Health Check Endpoint Usage

**URL**: `https://copilot.energeticdebt.com/api/admin/health`

**Authentication**: Admin login required

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-06T12:34:56Z",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 145,
      "message": "Database connection successful"
    },
    "auth": {
      "status": "healthy",
      "responseTime": 198,
      "message": "Auth service operational"
    },
    "pythonAgent": {
      "status": "healthy",
      "responseTime": 52,
      "message": "Agent responding normally"
    },
    "anthropic": {
      "status": "healthy",
      "responseTime": 487,
      "message": "API key valid and responding"
    },
    "conversations_api": {
      "status": "healthy",
      "responseTime": 234,
      "message": "Response time acceptable"
    }
  },
  "responseTime": 1234,
  "failureHistory": {}
}
```

### Manual Testing Checklist

**Daily (5 minutes)**
- [ ] Visit `/api/admin/health` and verify "healthy" status
- [ ] Send a test chat message and verify response
- [ ] Check Supabase dashboard for any alerts

**Weekly (30 minutes)**
- [ ] Request magic link and complete authentication
- [ ] Upload test lab PDF and verify extraction
- [ ] Create/edit patient record
- [ ] Run E2E test suite locally
- [ ] Review error logs in Sentry (when implemented)

**Monthly (1 hour)**
- [ ] Review uptime metrics and downtime history
- [ ] Analyze performance trends (response times, error rates)
- [ ] Test disaster recovery procedures
- [ ] Update documentation as needed

### Adding New Tests

**E2E Tests (Playwright)**:
```typescript
// tests/smoke/my-feature.spec.ts
import { test, expect } from '@playwright/test'

test('feature works as expected', async ({ page }) => {
  // Navigate to page
  await page.goto('/feature')

  // Perform actions
  await page.fill('input', 'value')
  await page.click('button')

  // Verify results
  await expect(page.locator('text=Success')).toBeVisible()
})
```

**Unit Tests (Vitest)**:
```typescript
// src/lib/my-function.test.ts
import { describe, it, expect } from 'vitest'
import { myFunction } from './my-function'

describe('myFunction', () => {
  it('returns expected result', () => {
    expect(myFunction('input')).toBe('output')
  })
})
```

**Python Tests (pytest)**:
```python
# python-agent/tests/test_chat.py
import pytest
from app.api.routes.chat import chat_handler

@pytest.mark.asyncio
async def test_chat_response():
    response = await chat_handler("Hello")
    assert response.status == "success"
```

---

## Risk Mitigation

### Known Issues
1. **Rate Limiting on Magic Links** - Limited to 100 emails/hour (recently increased from 2)
2. **Circular Redirect Bug** - Fixed in latest deployment (middleware now excludes /api routes)
3. **Python Agent Availability** - Critical dependency, no fallback if down

### Mitigation Strategies
1. Monitor rate limit usage in admin health check
2. Verify middleware fix is deployed in production
3. Set up alerting for Python agent failures
4. Document manual fallback procedures
5. Implement circuit breaker for Anthropic/OpenAI APIs

### Recovery Procedures (To Document)
1. **If Database is Down**: Cannot proceed, wait for Supabase recovery
2. **If Python Agent is Down**: Chat functionality disabled, show message to users
3. **If Anthropic/OpenAI API is Down**: Chat responses fail, suggest retry
4. **If Auth is Down**: Users cannot login, trigger incident response

---

## Resource Requirements

### Tools & Services
- **UptimeRobot**: Free tier (50 monitors)
- **Sentry**: Free tier (1M events/month)
- **Playwright**: Free (open source)
- **Vitest**: Free (open source)
- **pytest**: Free (open source)

### Team Time
- **Phase 1** (Week 1): 30 minutes
- **Phase 2** (Weeks 2-3): 5 hours
- **Phase 3** (Month 1): 8-10 hours
- **Phase 4** (Months 2-3): Ongoing (5-10 hours/week for maintenance)

### Infrastructure
- No additional infrastructure needed for Tier 1-2
- For Tier 3: Monitoring tool subscriptions (~$50-200/month)

---

## Monitoring & Alerts

### Alert Thresholds

| Event | Threshold | Action |
|-------|-----------|--------|
| Service Down | Immediate | Page on-call engineer |
| Response Time Degraded | >500ms for 5min | Notify team |
| Error Rate | >0.5% | Notify team |
| Authentication Failures | >5% of requests | Investigate + alert |
| Database Slow Queries | >1 second | Investigate + alert |
| API Rate Limit Approaching | >80% used | Notify |

### Notification Channels
1. **Critical**: Email + Slack + Phone (on-call)
2. **High**: Slack + Email
3. **Medium**: Slack channel
4. **Low**: Health dashboard only

---

## Documentation Requirements

### To Create
1. `docs/testing.md` - How to run and write tests
2. `docs/monitoring.md` - How to interpret health metrics
3. `docs/runbooks.md` - Incident response procedures
4. `docs/architecture.md` - System design overview
5. `tests/README.md` - Test suite documentation

### To Update
1. `README.md` - Add testing section
2. `CONTRIBUTING.md` - Add test requirements
3. `.github/workflows/` - Add CI/CD test steps

---

## Success Criteria & Acceptance

### Phase 1 Complete When
- [ ] Health check shows all services healthy
- [ ] Manual test checklist passes
- [ ] Baseline metrics documented
- [ ] No critical issues blocking deployment

### Phase 2 Complete When
- [ ] UptimeRobot reports >99% uptime
- [ ] All E2E tests pass on every commit
- [ ] CI/CD pipeline configured
- [ ] 0 alerts in first week

### Phase 3 Complete When
- [ ] 70%+ test coverage on critical code
- [ ] Sentry tracking all errors
- [ ] Structured logging implemented
- [ ] <1% error rate observed

### Phase 4 Complete When
- [ ] APM dashboard showing all metrics
- [ ] 99.9% uptime maintained
- [ ] <30min MTTR for incidents
- [ ] Team trained on monitoring

---

## Contact & Support

- **Health Check Questions**: Check `/api/admin/health` endpoint
- **Testing Questions**: See `docs/testing.md`
- **Incident Response**: See `docs/runbooks.md`
- **Performance Issues**: Check monitoring dashboard

---

## Appendix: Existing Health Check Features

### Monitored Services (11 Total)

1. **Supabase Database** - PostgreSQL connection + query test
2. **Supabase Auth** - Session validation
3. **Python Agent** - HTTP health endpoint
4. **Anthropic/OpenAI APIs** - Key validation + API test
5. **Conversations API** - List conversations endpoint
6. **Patients API** - List patients endpoint
7. **Labs API** - List lab results endpoint
8. **Dashboard Stats API** - Statistics aggregation
9. **Settings Profile API** - User profile fetch
10. **Admin Users API** - List admin users
11. **Diagnostics API** - List diagnostics

### Response Time History
- Tracked per service (last 10 failures)
- Used for trend analysis
- Helps identify degradation

### Failure Tracking
- Automatic failure recording
- Timestamps preserved
- Historical context maintained

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-06 | 1.0 | Initial PRD - Health testing strategy and roadmap |

---

**Document Owner**: Engineering Team
**Last Updated**: 2026-01-06
**Review Frequency**: Monthly
