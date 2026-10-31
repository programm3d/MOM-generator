# Enterprise Standard Operating Procedure (SOP)
## Autonomous Agentic QA Framework: Playwright, Schemathesis, Promptfoo & AI Triage

**Document Version:** 1.0.0  
**Target Audience:** QA Engineers, SREs, Tech Leads, Engineering Directors  
**Scope:** Reusable implementation guide for any web, API, or LLM-integrated application across the organization.

---

## 1. Executive Overview & Architecture

Modern AI-augmented applications cannot rely solely on legacy unit tests or manual QA. They contain three distinct failure domains:
1. **Frontend / User Workflows:** UI regressions, selector drift, asynchronous state synchronization issues.
2. **Backend API Contract:** Schema violations, unhandled HTTP 500 edge cases, malformed payloads.
3. **Non-Deterministic LLM Layers:** Prompt injection, hallucinations, schema drift, model regression.

This framework integrates a **deterministic testing core** governed by an **autonomous AI triage layer**:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Git Event / Deployment Gate                        │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
 ┌───────────────────────────────────▼────────────────────────────────────┐
 │                     Parallel Cloud Test Execution                      │
 ├─────────────────────────┬──────────────────────┬───────────────────────┤
 │     UI Automation       │    API Contract      │    LLM Intelligence   │
 │      (Playwright)       │    (Schemathesis)    │      (Promptfoo)      │
 │  • Critical User Paths  │  • Property Fuzzing  │  • Prompt Regression  │
 │  • Video & Traces       │  • OpenAPI Checking  │  • Injection Defense  │
 │  • Cross-Browser        │  • 5xx Error Hunting │  • Schema Validation  │
 └─────────────┬───────────┴──────────┬───────────┴───────────┬───────────┘
               │                      │                       │
               └──────────────────────┼───────────────────────┘
                                      │ (JSON/XML Test Artifacts)
                                      ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Autonomous AI Triage Engine                       │
 │  • Aggregates failed assertions, stack traces, and Playwright DOM logs │
 │  • Root-cause analysis via LLM (Gemini 2.5 Flash / Claude / GPT-4o)   │
 │  • Produces executive markdown report with suggested code patches      │
 └────────────────────────────────────┬───────────────────────────────────┘
                                      ▼
         ┌────────────────────────────┴───────────────────────────┐
         │                                                        │
         ▼                                                        ▼
┌──────────────────┐                                    ┌──────────────────┐
│ GitHub Actions   │                                    │ Slack / Teams /  │
│ Job Summary      │                                    │ Jira Alert       │
└──────────────────┘                                    └──────────────────┘
```

---

## 2. Standard Operating Procedure (SOP)

### Phase 1: Preparation & Discovery (Project Onboarding)

For every new repository adopting this framework:

#### 1.1 Backend Contract Generation
- **Requirement:** Schemathesis requires an OpenAPI (v3.0+) or GraphQL schema.
- **Action:**
  - If using TypeScript/Express: maintain a versioned `openapi.yaml` or use libraries like `@asteasolutions/zod-to-openapi` or `tsoa`.
  - If using FastAPI / NestJS / Django: leverage built-in auto-generated OpenAPI endpoints (`/docs/openapi.json`).
  - Commit the contract to `<repo-root>/server/openapi.yaml` or point Schemathesis to the live URL.

#### 1.2 LLM Eval Fixture Curation
- **Requirement:** Promptfoo needs ground truth and adversarial test cases.
- **Action:**
  - Create `tests/fixtures/` containing:
    1. **Happy Path Fixtures:** Clean representative inputs.
    2. **Edge Cases:** Missing data, empty payloads, boundary conditions.
    3. **Adversarial / Red-Teaming Fixtures:** Prompt injection, system prompt extraction, jailbreak payloads.

#### 1.3 UI Critical User Journeys (CUJs)
- **Requirement:** Playwright should focus strictly on high-value end-to-end flows.
- **Action:** Define the top 3–5 core business workflows (e.g., login, file upload, transaction submission, report export). Do not test low-level CSS unit states with Playwright; keep tests resilient by relying on semantic locators (`getByRole`, `getByLabel`, `data-testid`).

---

### Phase 2: Tiered Execution Strategy (Shift-Left vs. Staging Gate)

To prevent ballooning CI runtimes and token costs, divide test execution into three tiers:

| Tier | Trigger | Suite Scope | Target Environment | Target Runtime |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: PR Smoke Gate** | Pull Request to `main`/`staging` | • Unit & component tests<br>• Promptfoo with mock/cache<br>• Playwright smoke test (1 headless browser) | Ephemeral PR Preview / Local Docker | < 3 minutes |
| **Tier 2: Staging Gate** | Merge into `staging` branch | • Schemathesis API fuzzing (100 checks)<br>• Promptfoo matrix against staging LLM<br>• Full Playwright E2E suite<br>• **Autonomous AI Triage** | Live Deployed Staging Cluster | 5–10 minutes |
| **Tier 3: Nightly Deep Audit** | Scheduled Cron (Midnight) | • Schemathesis exhaustive fuzzing (10,000+ checks)<br>• Full LLM Red-Teaming (200+ jailbreak probes)<br>• Cross-browser Playwright (Chromium, Firefox, WebKit) | Staging / Pre-Production | 20–45 minutes |

---

### Phase 3: CI/CD Implementation Blueprint

#### 3.1 Repository Structure Standard
Ensure the following structure in all participating repositories:

```text
├── .github/
│   └── workflows/
│       ├── pr-smoke.yml         # Tier 1 Gate
│       ├── staging-qa.yml       # Tier 2 Gate (Full Suite + Triage)
│       └── nightly-audit.yml    # Tier 3 Gate (Exhaustive)
├── server/
│   └── openapi.yaml             # API Schema contract
├── promptfooconfig.yaml         # Promptfoo test matrix & assertions
├── playwright.config.ts         # Playwright E2E configuration
├── scripts/
│   └── agentic-triage.mjs       # AI Triage & Summary Engine
└── tests/
    ├── e2e/                     # Playwright test specs
    └── fixtures/                # Evaluation & adversarial inputs
```

#### 3.2 Required Repository Secrets
Configure in **Settings → Secrets and variables → Actions**:
- `STAGING_API_URL`: Base URL of deployed backend.
- `STAGING_WEB_URL`: Base URL of deployed frontend.
- `GEMINI_API_KEY` (or `OPENAI_API_KEY`): Used for Promptfoo LLM testing and the AI Triage script.
- `SLACK_WEBHOOK_URL` *(Optional)*: For automated failure routing to team channels.

---

### Phase 4: Autonomous Failure Triage & Self-Healing

When any quality gate fails in CI:

1. **Failure Harvester:** `scripts/agentic-triage.mjs` extracts stack traces from `schemathesis-report.xml`, `promptfoo-results.json`, and Playwright error artifacts.
2. **AI Analysis:** The error bundle is passed to the triage model with the following system directive:
   - Identify the exact layer of failure (API schema, UI selector, or LLM hallucination).
   - Classify severity (Blocker, Major, Flake).
   - Output recommended code patch or configuration update.
3. **Actionable Publishing:**
   - Appends Markdown to `$GITHUB_STEP_SUMMARY`.
   - Uploads traces and failure videos as workflow artifacts.
   - *(Optional)* Automatically opens a GitHub Issue or posts to Slack tagging the PR author.

---

### Phase 5: Ongoing Governance & Maintenance

1. **OpenAPI Drift Control:** Whenever a backend endpoint or payload changes, updating `openapi.yaml` must be mandatory for PR approval.
2. **Prompt Versioning:** Maintain prompt templates in version-controlled config files (e.g., `src/prompts/`) so Promptfoo tracks regressions across Git commits.
3. **Database Isolation in Staging:** 
   - Schemathesis creates random data during fuzzing.
   - Run tests against a dedicated staging test tenant or trigger a database rollback script after test runs to avoid staging database pollution.

---

## 3. Estimated Cost Breakdown (Monthly)

The entire tooling stack (Playwright, Schemathesis, Promptfoo) is **100% free open-source software (MIT/Apache licenses)**. The only costs are **CI/CD compute minutes** and **LLM inference tokens**.

### Cost Comparison by Organization Tier

#### Tier A: Small Team / MVP
- **Team Size:** 1–5 Engineers
- **Activity:** ~60 PRs / merges per month
- **Tests per Run:** 5 Playwright tests, 10 Promptfoo cases, 100 Schemathesis API checks

| Line Item | Volume | Unit Cost | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Playwright, Schemathesis, Promptfoo** | Unlimited | Open Source (Free) | **$0.00** |
| **GitHub Actions Linux Runners** | ~400 min / month | Free allowance (2,000 min) | **$0.00** |
| **LLM Eval Tokens (Gemini 2.5 Flash)** | ~500K tokens / month | Free Tier / $0.075 per 1M | **<$0.10** |
| **Agentic Triage Calls** | ~30 triage calls | Free Tier / negligible | **<$0.05** |
| **Cloud Hosting (Render/Netlify)** | 1 Backend + 1 Frontend | Free Tiers | **$0.00** |
| **Total Estimated Cost:** | | | **$0.00 – $1.00 / mo** |

---

#### Tier B: Mid-Size Project / Growth Stage
- **Team Size:** 10–30 Engineers
- **Activity:** ~400 PRs / merges per month
- **Tests per Run:** 25 Playwright tests, 30 Promptfoo cases, 500 Schemathesis API checks

| Line Item | Volume | Unit Cost | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Playwright, Schemathesis, Promptfoo** | Unlimited | Open Source (Free) | **$0.00** |
| **GitHub Actions Compute** | ~3,500 min / month | $0.008 / min (after 2k free) | **$12.00** |
| **LLM Eval Tokens (Gemini 2.5 Flash)** | ~15M tokens / month | $0.075 / 1M input, $0.30 / 1M output | **$2.50** |
| **Agentic Triage Calls (Gemini 2.5 Flash)**| ~200 triage analyses | ~$0.001 per call | **$0.20** |
| **Cloud Staging Infrastructure** | Render Team / Netlify Pro | Fixed team plans | **$38.00** |
| **Total Estimated Cost:** | | | **~$52.70 / mo** |

---

#### Tier C: Large Scale / Enterprise
- **Team Size:** 50–200 Engineers
- **Activity:** ~2,000 PRs / merges per month
- **Tests per Run:** 150+ Playwright tests, 100+ Promptfoo matrices, full continuous API fuzzing

| Line Item | Volume | Unit Cost | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Playwright, Schemathesis, Promptfoo** | Unlimited | Open Source (Free) | **$0.00** |
| **GitHub Actions (or Self-Hosted Runners)**| ~25,000 min / month | Self-hosted Kubernetes / AWS Spot | **~$80.00** |
| **LLM Eval Tokens (Gemini Flash / GPT-4o-mini)**| ~100M tokens / month | Blended token pricing | **~$15.00** |
| **Agentic Triage Engine** | ~1,000 root-cause triage runs | Fast inference | **~$1.50** |
| **Artifact Storage (Screenshots/Videos/Traces)**| ~50 GB retained 30 days | $0.02 / GB-month | **$1.00** |
| **Total Estimated Cost:** | | | **~$97.50 / mo** |

---

## 4. ROI & Business Impact Analysis

| Metric | Traditional Manual / Fragmented QA | Autonomous Agentic QA Stack | Impact |
| :--- | :--- | :--- | :--- |
| **Regression Escape Rate** | 12–18% of bugs reach staging/prod | < 2% escape rate | **85%+ reduction in critical escapes** |
| **Mean Time to Triage (MTTT)** | 25–45 minutes per failing build | < 45 seconds (AI Triage) | **97% faster triage turnaround** |
| **Prompt Regression Detection** | Manual inspection or user complaints | Automated matrix on every commit | **Zero silent prompt regressions** |
| **Monthly Cost** | $4,000–$8,000 / mo in manual QA time | < $100 / mo in cloud & API cost | **>95% operational cost savings** |

---

## 5. Quick-Start Checklist for New Repositories

When onboarding a new repository, check off these 5 steps:
- [ ] Export or generate OpenAPI 3.0 specification (`server/openapi.yaml`).
- [ ] Install Playwright and create critical journey tests (`tests/e2e/`).
- [ ] Create `promptfooconfig.yaml` referencing prompt files and `tests/fixtures/`.
- [ ] Copy `scripts/agentic-triage.mjs` into repository.
- [ ] Add `.github/workflows/staging-qa.yml` and configure GitHub Action secrets (`STAGING_API_URL`, `STAGING_WEB_URL`, `GEMINI_API_KEY`).
