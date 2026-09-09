# Computer-Use Automation System for Banking Back-Office Applications

A robust, production-grade computer-use automation engine designed for legacy banking and credit union servicing software that lacks APIs. It implements an LLM-driven discovery agent that explores a real UI, compiles the successful run into a typed, parameterized capability artifact, and executes that artifact deterministically with **zero model calls in the loop**.

---

## ⚡ Quick Start: 3-Minute Demo

### Prerequisites
- Node.js v20+ (tested on Node v23.10)
- Playwright Chromium installed (`npx playwright install chromium`)

### 1. Setup
```bash
# Clone repository and install dependencies
npm install

# Download Playwright Chromium browser
npx playwright install chromium
```

### 2. Run Discovery Mode (LLM in the Loop)
The agent launches against the local **ApexCore Banking Portal**, observes the accessibility tree, dismisses compliance notices, locates member records, and records the flow into a reusable capability artifact (`evidence/capability_artifact.json`):
```bash
npm run discover
```
*(By default, this runs in offline discovery mode for zero-cost verification. To use live Google Gemini, OpenAI, or Anthropic models, see the [LLM Configuration](#-llm-configuration) section).*

### 3. Run Deterministic Replay (No Model in the Loop)
Replays the recorded capability with zero LLM inference, sub-second latency, and verified balance extraction:
```bash
# Happy Path: Replay for Member 10042 (Sarah Connor) -> Extracts $18,450.25 Savings Balance
npm run replay
```

### 4. Exercise Exceptional States & Error Taxonomy
Our replay engine distinguishes between **expected business outcomes**, **recoverable conditions**, and **hard failures**:

```bash
# Expected Business Outcome: Member 99999 does not exist
# Detects "Record Not Found" banner and returns structured domain outcome, not a crash!
npm run replay:outcome

# Human-in-the-Loop Escalation: Injects a blocking supervisor security modal
# Pauses live session, transitions control lock to operator console, and resumes seamlessly
npm run replay:escalate
```

### 5. Agent-Facing Capability Catalog (Stretch Goal)
Discovers saved capability artifacts, formats them as standard LLM Tool Calling schemas, and executes an invocable agent tool call:
```bash
npm run catalog
```

### 6. Run Automated Test Suite
```bash
npm test
```

---

## 🔑 LLM Configuration

The system is multi-provider and can operate with:
- **Offline Heuristic Discovery Engine** (Default, zero external dependencies or API keys needed).
- **Google Gemini**: Set `GEMINI_API_KEY=your_key` in a `.env` file (defaults to `gemini-2.5-flash`).
- **OpenAI**: Set `OPENAI_API_KEY=your_key` (defaults to `gpt-4o`).
- **Anthropic**: Set `ANTHROPIC_API_KEY=your_key` (defaults to `claude-3-5-sonnet`).

Create a `.env` file in the project root:
```ini
GEMINI_API_KEY=AIzaSy...
# or
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 📂 Repository Structure

```
├── README.md                      # Setup, commands, and architecture overview
├── REPORT.md                      # Detailed design report (7 required sections)
├── package.json                   # Dependencies and npm scripts
├── tsconfig.json                  # TypeScript compiler options
├── /src
│   ├── /target-app                # Self-contained legacy banking application ("ApexCore Banking")
│   │   ├── server.ts              # Local HTTP server with legacy table layouts & modals
│   │   └── data.ts                # Realistic banking data (members, accounts, ledgers)
│   ├── /agent                     # Discovery Agent Loop
│   │   ├── driver.ts              # Playwright surface perception (Accessibility Tree + DOM)
│   │   ├── llm-client.ts          # Multi-provider LLM client (Gemini, Claude, OpenAI, mock)
│   │   ├── prompt.ts              # System prompt and observation builder
│   │   ├── synthesizer.ts         # Compiles execution trace into parameterized capability artifact
│   │   └── agent-loop.ts          # Main observe-decide-act loop
│   ├── /schema                    # Zod capability and execution schemas
│   │   ├── capability.ts          # CapabilityArtifactSchema (v1.0.0)
│   │   └── execution-result.ts    # ExecutionResult contract
│   ├── /replay                    # Deterministic Replay Engine
│   │   ├── executor.ts            # Step sequencer with parameter substitution
│   │   ├── locator.ts             # Multi-strategy locator cascade (AX role+name -> text -> CSS -> XPath)
│   │   ├── checkpoint.ts          # State assertions & pre/post condition verifiers
│   │   ├── outcome-detector.ts    # Business outcome & recoverable condition matcher
│   │   └── stability.ts           # Multi-run stability tester
│   ├── /safety                    # Policy & Security Guardrails
│   │   ├── allowlist.ts           # Domain and route allowlist validation
│   │   ├── risk-classifier.ts     # Action risk categorization (Safe Read, Reversible, Irreversible)
│   │   └── pii-redactor.ts        # Financial PII & secret redactor (SSN, card numbers, tokens)
│   ├── /escalation                # Human-in-the-Loop Handoff & Session Lock
│   │   ├── session-lock.ts        # Live session pause, lock acquisition, and resume seam
│   │   └── operator-console.ts    # CLI operator interface with contextual diagnostics
│   ├── /evidence                  # Observability logger & artifact exporter
│   │   └── logger.ts              # Structured JSON timeline & markdown trace logger
│   └── /catalog                   # Agent-facing capability catalog & invocation API
│       └── catalog.ts             # Discovers, inspects, and invokes capabilities by name
├── /evidence                      # Generated artifacts and run traces
│   ├── capability_artifact.json   # Reusable capability artifact contract
│   ├── discovery_run.log          # Structured log of discovery execution
│   ├── discovery_run_trace.json   # Full step trace with perception data
│   ├── discovery_screenshot.png   # Final goal state screenshot
│   ├── replay_success.log         # Deterministic replay log (Happy Path)
│   ├── replay_success_screenshot.png
│   ├── replay_business_outcome.log# Replay handling "Member Not Found" outcome
│   ├── replay_business_outcome_screenshot.png
│   └── replay_escalation.log      # Replay demonstrating human escalation on roadblock
└── /tests                         # Automated unit & integration tests
    ├── schema.test.ts             # Artifact schema validation tests
    ├── safety.test.ts             # Redaction & allowlist guardrail tests
    └── e2e.test.ts                # End-to-end discovery & replay test suite
```

---

## 🏛️ System Architecture Highlights

1. **Accessibility Tree as the Universal Substrate**:
   Instead of fragile CSS selectors or brittle coordinate clicks, the perception engine uses the Accessibility Tree (`role`, `name`, `state`). This allows the exact same locator abstractions to operate across modern web apps, legacy framesets, and native desktop banking systems (via macOS AX or Windows UIA).

2. **Strict Error Taxonomy**:
   The engine cleanly separates:
   - **Expected Business Outcomes**: Member not found, account closed, insufficient balance. Handled as structured domain results.
   - **Recoverable Interstitials**: Scheduled maintenance or compliance modals. Automatically dismissed via registered interceptors.
   - **Hard Technical Failures**: True crashes or broken flows. Escalated with full diagnostic traces and screenshots.

3. **Human Escalation Seam**:
   When automation hits an unknown blocker or a high-risk irreversible action, it **never restarts the session**. It holds the live browser socket open, transitions the `SessionControlLock` to the operator, presents diagnostics in the console, and resumes on the exact same session after human action.

4. **Financial Safety & PII Redaction**:
   All logs, artifacts, and traces pass through an automated `PiiRedactor` that masks Social Security Numbers (`***-**-XXXX`), payment cards (`****-****-****-XXXX`), credentials, and tokens.
