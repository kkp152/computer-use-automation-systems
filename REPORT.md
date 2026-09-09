# Engineering Design Report: Computer-Use Automation System

**Author:** interface.ai Senior Engineering Candidate  
**Target Domain:** Legacy Core Banking & Credit Union Servicing Applications  
**System Repository:** [Public GitHub Repository]  

---

## 1. Architecture

### 1.1 Core Problem & Architectural Philosophy
US banks and credit unions rely on a vast tail of mission-critical back-office software—core banking servicing consoles, teller terminals, wire management systems, and loan origination tools. These systems essentially **never expose modern APIs**, and rewriting them is commercially and regulatorily prohibitive. To give AI agents "hands" in this environment, automation must navigate a unique dichotomy:
1. **The UIs change slowly, but runtime conditions vary wildly**: These are stable enterprise applications (not fast-evolving consumer web apps). The viable paradigm is **Record-Once / Replay-Many**.
2. **The dominant failure mode is not visual drift, but operational state exceptions**: "Member record not found", "Account deceased", compliance interstitial popups, session timeouts, and concurrency blocks are daily realities.
3. **The surface is hostile**: Non-semantic HTML, deeply nested tables, legacy framesets, and desktop terminal emulators dominate. There are no convenient `data-testid` attributes.

Our architecture bifurcates the lifecycle into two strictly decoupled phases: **Discovery** (model-in-the-loop perception and exploration) and **Production Execution** (deterministic, sub-second replay with zero model calls).

```
+-----------------------------------------------------------------------------------------+
|                                1. DISCOVERY PHASE (LLM)                                 |
|                                                                                         |
|  [Natural Language Goal] ---> [Observation Engine] <---> [Live Surface (Playwright)]    |
|                                        |                                                |
|                                        v                                                |
|                             [LLM Reasoning & Plan]                                      |
|                                        |                                                |
|                                        v                                                |
|                            [Capability Synthesizer]                                     |
+----------------------------------------|------------------------------------------------+
                                         |
                                         v Emits Typed JSON Contract
+-----------------------------------------------------------------------------------------+
|                        2. PRODUCTION EXECUTION (DETERMINISTIC ENGINE)                   |
|                                                                                         |
|  [Agent Call + Typed Inputs]                                                            |
|              |                                                                          |
|              v                                                                          |
|  [Capability Artifact]                                                                  |
|              |                                                                          |
|              +---> [Policy & Safety Guardrail] (Allowlist, Risk Gate, PII Redaction)    |
|              |                                                                          |
|              +---> [Deterministic Sequencer]                                            |
|                          |                                                              |
|                          +---> [Multi-Strategy Cascading Locator] (AX Tree -> Fallbacks)|
|                          +---> [Recoverable Condition Auto-Handler] (Interstitials)     |
|                          +---> [Business Outcome Evaluator] (Domain Outcome vs Crash)   |
|                          +---> [State Checkpoint Verifier]                              |
|                          |                                                              |
|                          +---> [Human Escalation Seam] (Lock Transfer & Live Resume)    |
|                                                                                         |
|  [Structured Result Contract]: SUCCESS | BUSINESS_OUTCOME | RECOVERED | ESCALATED       |
+-----------------------------------------------------------------------------------------+
```

### 1.2 Key Architectural Decisions & Trade-Offs

| Architectural Decision | Chosen Approach | Alternative Considered | Trade-Off Rationale |
| :--- | :--- | :--- | :--- |
| **Primary Perception Substrate** | **Accessibility Tree (Role + Name + State)** | Pure Computer Vision / Pixel Coordinates ($X, Y$) | Coordinate clicks are fragile to window resize, DPI scaling, and OS rendering. Raw DOM selectors break across tenant themes. The AX Tree represents the semantic contract exposed to assistive technologies and desktop accessibility bridges (macOS AX, Windows UIA), functioning identically across modern web, framesets, and native windows. |
| **Discovery vs Replay Decoupling** | **Compile to Typed Artifact, Replay with Zero LLM** | LLM Re-reasoning on every execution | LLM-in-the-loop per invocation costs \$0.02–\$0.10, adds 3–15 seconds of latency, and introduces stochastic failure risks into regulated banking transactions. Compiling once into a verified artifact yields sub-second, zero-cost, deterministic execution. |
| **Error Handling Taxonomy** | **Trinary Separation: Business Outcome vs Recoverable vs Hard Failure** | Monolithic try/catch exception raising | Treating "Record Not Found" as an application crash blinds the calling agent. Domain outcomes are legitimate business data. Interstitials are recoverable background noise. Only unresolvable blockades are hard failures. |
| **Human Escalation Seam** | **In-Session Lock Transfer on Active Instance** | Discard session and restart manual workflow | Banking sessions maintain state, authentication tokens, and audit trails. Restarting forfeits the entire multi-step progress and can trigger fraud locks. The automation must pause, yield session lock, and resume without closing the socket or browser context. |

---

## 2. Artifact Schema

The Capability Artifact (`src/schema/capability.ts`) is a typed, versioned, JSON-serializable specification representing an agent-callable skill. It is intentionally designed as an immutable contract between discovering agents, human compliance reviewers, and production execution engines.

### 2.1 Core Schema Primitives

1. **Identity & Governance Metadata**:
   - `capability_id`: Hierarchical identifier (`core_banking.member.lookup_savings_balance`).
   - `version`: Strict semantic versioning (`1.0.0`). Any behavioral modification triggers a minor/major increment.
   - `policy`: Binds the capability to an explicit domain allowlist, permitted action types (`NAVIGATE`, `CLICK`, `TYPE`, `EXTRACT`), and data classification tags.
2. **Typed Inputs & Outputs Contract**:
   - `inputs_schema`: Standard JSON Schema declaring required variables, regex patterns (`pattern: "^[0-9]{5}$"`), and defaults.
   - `outputs_schema`: Strictly typed return shapes (`member_name: string`, `savings_balance: number`, `account_status: enum`).
3. **Action Steps with Multi-Strategy Locators**:
   - Each step specifies an `intent`, an `action`, parameter bindings (`{{inputs.member_id}}`), an execution timeout, an action risk tier (`SAFE_READ`, `REVERSIBLE_WRITE`, `IRREVERSIBLE_MUTATION`), and a `TargetDescriptor`.
   - **Multi-Strategy Descriptor**:
     - `primary`: Accessibility semantic locator (`role: "textbox"`, `name: "Member ID or SSN"`).
     - `fallbacks`: Array of prioritized fallbacks (Text search, semantic CSS, normalized XPath).
     - `robustness_rationale`: Human/LLM documented rationale explaining why this targeting holds.
4. **First-Class Domain Outcome & Recovery Blocks**:
   - `business_outcomes`: Explicit detectors matching known domain states (e.g. `MEMBER_NOT_FOUND`) and mapping them to structured output contracts.
   - `recoverable_conditions`: Registered interceptors for transient interruptions (e.g. batch maintenance notices, modal disclosures) with pre-authorized resolution actions.
5. **Checkpoints**: Pre- and post-condition assertions verifying state transitions before the sequencer advances.

---

## 3. Determinism & Error Handling

To achieve true determinism without an LLM in the production loop, our replay engine (`src/replay/executor.ts`) implements a layered resolution pipeline:

```
[Step N Triggered]
       |
       v
[1. Recoverable Condition Check] ----> (Modal Detected?) ---> [Auto-Dismiss & Resume]
       |
       v
[2. Business Outcome Check] ---------> (Outcome Matched?) --> [Return Structured Result: BUSINESS_OUTCOME]
       |
       v
[3. Safety & Risk Classification] ---> (Irreversible?) -----> [Trigger Human Authorization]
       |
       v
[4. Parameter Substitution] ({{inputs.member_id}} -> "10042")
       |
       v
[5. Multi-Strategy Locator Cascade]
       |---> Try Primary (Accessibility: role + name) [Timeout: 2000ms]
       |---> Fallback 1 (Visible Label / Proximity Text)
       |---> Fallback 2 (Semantic CSS Selector)
       |---> Fallback 3 (Normalized XPath)
       |
       v
(Resolved?) --YES--> [Execute Action] ---> [Verify Checkpoint] ---> [Step N Complete]
       |
       NO (Exhausted all fallbacks after retries)
       |
       v
[6. Escalate to Human Operator Console]
```

### 3.1 Resolving Runtime Errors vs Exceptional States
- **Expected Business Outcomes**: When searching for member `99999`, the portal returns a banner: *"Record Not Found: Member ID 99999 does not exist"*. The engine's `OutcomeDetector` evaluates regex patterns on visible alerts. Instead of throwing a locator timeout exception when looking for the account table, it immediately terminates with `ExecutionResult(status='BUSINESS_OUTCOME', outcome_id='MEMBER_NOT_FOUND', outputs={ account_status: 'RECORD_NOT_FOUND', savings_balance: 0.0 })`. The calling agent receives an informative domain answer, not an uncaught exception.
- **Recoverable Conditions**: Bank systems frequently display compliance acknowledgements or maintenance reminders. Before executing any step, the engine sweeps registered `recoverable_conditions`. If a matching modal is present, it auto-executes the handler (e.g. clicking *"Acknowledge & Dismiss"*), logs the recovery event, and proceeds seamlessly.
- **Hard Technical Failures**: If an unexpected 500 server error occurs or an element remains unresolvable across all fallbacks, the run pauses, captures a full-page screenshot, extracts the DOM excerpt, logs the strategy execution history, and produces a debuggable error record (`what step`, `what was expected`, `what was observed`).

---

## 4. Heterogeneity & Multi-Tenant Architecture

### 4.1 Surface Abstraction Layer
While our implementation targets a browser surface via Playwright, the core architecture is governed by a surface-agnostic driver interface:

```typescript
export interface ISurfaceDriver {
  getAccessibilitySnapshot(): Promise<AccessibilityNode>;
  resolveControl(descriptor: TargetDescriptor): Promise<NativeControlHandle>;
  click(handle: NativeControlHandle): Promise<void>;
  type(handle: NativeControlHandle, text: string): Promise<void>;
  extract(handle: NativeControlHandle): Promise<string>;
}
```

- **Modern & Legacy Web**: Implemented via Playwright CDP (Chrome DevTools Protocol) using the DOM accessibility tree (`page.accessibility.snapshot()`). Framesets and nested tables are flattened into an accessible tree, making frame navigation transparent to the artifact.
- **Desktop Core Banking Applications**: Many credit unions still operate Win32, WPF, Java Swing, or terminal emulator apps (e.g. Fiserv DNA, Jack Henry Symitar, FIS Horizon). Because macOS (Accessibility API / AXUIElement) and Windows (UI Automation / UIA) expose the exact same concept of **Role**, **Name**, **Value**, and **BoundingRect**, the artifact schema requires zero changes. An OS-level driver implementing `ISurfaceDriver` replaces Playwright without altering the recorded flow.

### 4.2 Multi-Tenant Reuse & Drift Management
In banking SaaS, hundreds of institutions run the same underlying vendor platform (e.g. nCino, Q2, Alkami) branded with unique CSS themes, colors, and tenant-specific field configurations.

1. **Base Capability with Tenant Overlays**:
   - A capability is defined as a canonical **Base Flow** (generic workflows, standard field names).
   - Each institution maintains a lightweight **Tenant Overlay**:
     ```json
     {
       "tenant_id": "horizon_fcu",
       "base_capability": "core_banking.member.lookup_savings_balance",
       "overrides": {
         "step_input_member_id": {
           "target": { "primary": { "strategy": "accessibility", "role": "textbox", "name": "Member #" } }
         }
       }
     }
     ```
2. **Drift Detection via Locator Health Scoring**:
   - The replay engine records which strategy in the fallback cascade resolved each control.
   - If a primary accessibility locator begins failing and falling back to XPath for a specific tenant, the system emits a **Drift Warning Metric**. When drift exceeds a confidence threshold, the capability is flagged for unattended execution suspension and queued for agent re-discovery.

---

## 5. Escalation & Handoff

When automation encounters an ambiguous roadblock, an unresolvable control, or an irreversible financial mutation, it must gracefully escalate to a human operator without losing context.

```
+-----------------------------------------------------------------------------------------+
|                                HUMAN ESCALATION TIMELINE                                |
|                                                                                         |
| [Automation Running]                                                                    |
|          |                                                                              |
|          v                                                                              |
| [Blocker Encountered / Risk Policy Triggered]                                           |
|          |                                                                              |
|          +---> 1. Pause Sequencer Loop                                                  |
|          +---> 2. Capture Diagnostic State (Screenshot, URL, Failed Strategies, DOM)    |
|          +---> 3. Transition SessionControlLock: [AUTOMATION] -> [OPERATOR]             |
|          +---> 4. Emit InterventionRequest to Operator Console                          |
|                                                                                         |
| [Human Takes Control of LIVE Session Window]                                            |
|          |                                                                              |
|          +---> Operator dismisses blocking modal, enters MFA, or inspects transaction   |
|          +---> Operator selects Action in Console:                                      |
|                [R] Resume step  |  [C] Mark step manually done  |  [A] Abort            |
|                                                                                         |
| [Resumption Protocol]                                                                   |
|          |                                                                              |
|          +---> 1. Validate Session Health (Page responsive, URL matches boundary)       |
|          +---> 2. Transition SessionControlLock: [OPERATOR] -> [AUTOMATION]             |
|          +---> 3. Re-verify Checkpoint & Resume Sequencer                               |
+-----------------------------------------------------------------------------------------+
```

### 5.1 The Session Control Lock Seam
The critical primitive is `SessionControlLock` (`src/escalation/session-lock.ts`). The live session socket is held open. The state machine enforces mutual exclusion: automation operations are halted while the operator holds the token. Once the operator resolves the obstacle, control is transferred back, state assertions are re-evaluated against the live page, and automation resumes on the exact same HTTP/socket session.

---

## 6. Safety & Guardrails

Automating banking back-office software requires enterprise-grade defense-in-depth:

1. **Configurable Domain & Route Allowlist**:
   - `PolicyGuardrail` strictly inspects every navigation event. Navigation outside approved domains (`localhost`, `127.0.0.1`, `*.bank.internal`) is aborted immediately.
2. **Action Risk Tiering**:
   - `SAFE_READ`: Directory searches, balance readings, transaction inspections. Run unattended.
   - `REVERSIBLE_WRITE`: Staging form inputs before submission. Permitted with audit logging.
   - `IRREVERSIBLE_MUTATION`: Submitting wire transfers, account status changes, fund debits. In guarded mode, the engine mandates operator confirmation before firing the event.
3. **Automated PII & Secret Redaction**:
   - `PiiRedactor` runs continuously across all logging pipelines, error messages, and artifact generators.
   - US Social Security Numbers (`\b\d{3}-\d{2}-\d{4}\b`) are converted to `***-**-XXXX`.
   - 16-digit Payment Card PANs are masked to `****-****-****-XXXX`.
   - Bearer tokens, passwords, and API keys are scrubbed before any persistence to disk.

---

## 7. Cuts & Next Steps

### 7.1 What We Deliberately Cut (and Why)
- **Multi-Tenant Distributed Queue Infrastructure**: We omitted Kafka/RabbitMQ job queues, Redis lock brokers, and Kubernetes worker pools. Building premature scaling infrastructure obscures the core problem; our focus was on rock-solid primitives (the artifact contract, deterministic replay engine, locator cascade, and escalation seam).
- **Full Real-Time WebRTC Co-Browsing Video Canvas**: Real-time canvas streaming to remote browsers requires complex TURN/STUN/WebRTC relay infrastructure. We implemented the live session handoff seam directly in the process session lock with an interactive CLI operator console and contextual screenshot capture.
- **Multi-App Cross-System Workflows**: We focused on an exhaustive, realistic single-portal workflow (search $\rightarrow$ account listing $\rightarrow$ ledger drilldown $\rightarrow$ extraction) rather than shallow multi-tab hops.

### 7.2 What We Would Build Next
1. **Self-Healing Adaptive Locator Optimizer**: Track locator latency over time; automatically re-weight fallback priorities based on tenant performance without requiring human intervention.
2. **LLM Single-Step Assisted Recovery**: If all fallbacks fail on replay, permit a bounded, single-step LLM recovery prompt to find the displaced element, verify against safety policy, and propose an artifact patch.
3. **Web-Based Operator Hub**: Expand the CLI operator console into a lightweight WebSocket/React dashboard for centralized bank operations teams to monitor and intervene across concurrent terminal sessions.
