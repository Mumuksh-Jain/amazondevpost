# Devpost Submission Package: RelayCase

> **Submission Deadline:** October 24, 2026 at 00:30 IST (October 23, 2026, 12:00 PM PDT)  
> **Contest:** Amazon App Dev Challenge 2026 (Devpost)  
> **Rulebook Compliance:** Simulated Alexa+ web experience, public English demo video under 3 minutes, verified open-source repository, genuine SDK friction and product feedback included.

---

## 1. Project Overview

- **Project Title:** RelayCase — Bounded Household Responsibility Assistant
- **Tagline:** An accountable household handoff assistant enforcing human consent, immutable preview hashes, and strict boundaries between claims and physical proof.
- **Track Selection:** Main Hackathon Track / Household Coordination / Alexa+ Simulated Experience

---

## 2. Devpost Submission Fields (Copy-Paste Ready)

### Project Description / Elevator Pitch
Household delegation with AI assistants often fails because assistants generate false assumptions of commitment or claim tasks are complete without real-world human confirmation. RelayCase provides the missing accountability protocol layer: a bounded household delegation assistant with real local Node.js/SQLite state, deterministic simulated assistant tool calls via Model Context Protocol (MCP) over Streamable HTTP, and server-enforced human approval gates.

---

### Inspiration
As conversational AI agents become capable of managing household schedules, reminders, and errands, a dangerous gap emerges: AI agents cannot physically perform tasks, nor can they legally or ethically bind human family members to obligations without their explicit consent. 

If an assistant says *"I have assigned Sam to bring in the package,"* did Sam actually agree? And if Sam later clicks a button or tells an assistant *"I'm done,"* did the system verify the package is safe inside, or merely record Sam's claim?

RelayCase was born to solve this accountability problem. We wanted to build a transparent, tamper-evident coordination workbench where AI assists with structuring drafts, but humans retain sovereignty over commitments and completion claims.

---

### What It Does
RelayCase simulates a household with distinct fictional members (Priya, Sam, and Alex) backed by a private SQLite database and a real HTTP MCP endpoint:

1. **Simulated Assistant Tool Calls:** Requester Priya asks the assistant `"who can help?"` or `"draft: Bring the parcel box indoors -> sam"`. The deterministic assistant discovers eligible members and creates a persisted draft using standard MCP JSON-RPC tools (`list_eligible_members`, `create_handoff_draft`).
2. **Immutable Preview & Content Hash:** Once drafted, the requester previews the task. The system generates an immutable SHA-256 digest of the title, instructions, and assignee, locking the version (`AWAITING_REQUESTER_APPROVAL`).
3. **Server-Enforced Approval Boundary:** If an AI model or external script attempts to call `send_approved_handoff` before separate human sign-off, the server firmly blocks the operation with `403 APPROVAL_REQUIRED`. AI tools cannot authorize commitments on a human's behalf.
4. **First-Party Human Approval:** Priya reviews the preview in the first-party web UI and explicitly approves it (`HUMAN_APPROVED_PREVIEW`). The approval generates an unconsumed, time-limited token. Priya then dispatches the invitation (`AWAITING_ASSIGNEE_RESPONSE`).
5. **Independent Human Consent:** Assignee Sam logs in with his separate identity credential. The invitation is visible to Sam only because he is the designated assignee. Sam explicitly accepts responsibility (`ACCEPTED`). Human consent is never inferred or assumed.
6. **Preserving Claim vs. Proof:** When Sam finishes the task, he clicks `"Report I finished"`. The task status transitions to `CLAIMED_DONE` (never `VERIFIED_DONE`), accompanied by a clear disclosure: *"A person reported task completion. That is not independent physical verification."* Software preserves the epistemological boundary between a human claim and physical proof.
7. **Loop Closure & SQLite Audit Trail:** Priya reviews Sam's report and acknowledges it (`CLOSED_ACKNOWLEDGED`). Priya loads the complete event timeline, which is persisted in SQLite with ordered sequence IDs surviving server restarts.
8. **Mobile Responsiveness:** The entire experience is fully responsive on mobile screens (tested at 390px viewport width with zero horizontal overflow).

---

### How We Built It
- **Zero-Dependency Core Backend:** Implemented using modern Node.js standard libraries (`node:http`, built-in `node:sqlite`, and `node:crypto`). The default local demo runs without requiring `npm install`.
- **Model Context Protocol (MCP) Over Streamable HTTP:**
  - Standard compliant 2025-11-25 HTTP transport subset (`mcp-lite.mjs`).
  - Candidate official TypeScript SDK adapter (`mcp-official.mjs`) using pinned `@modelcontextprotocol/sdk` v1.32.1 and `zod` v4.2.0.
  - Exposes 7 tools: `list_eligible_members`, `create_handoff_draft`, `get_handoff_case`, `preview_handoff`, `send_approved_handoff`, `list_my_cases`, and `get_case_history`.
- **Pure Domain State Machine (`domain.mjs`):** Enforces transaction isolation, optimistic locking via monotonic version integers, SHA-256 preview digests, and idempotency key caching.
- **Accessible, Vanilla Frontend (`app.js`, `style.css`):** Built with pure JavaScript DOM manipulation, semantic HTML, screen-reader live status regions (`aria-live="polite"`), and responsive CSS grid/flexbox layouts.
- **Verification Engine:**
  - 35 Node.js test runner unit and security tests (`npm test`).
  - 19-check independent judge dry run (`npm run judge-dry-run`).
  - 9-check official MCP SDK integration verifier (`npm run sdk-check`).
  - 16-check native Windows Chrome E2E test via Chrome DevTools Protocol (`npm run test:browser`).

---

### Challenges We Ran Into
1. **Truthful Scope vs. Live Alexa+ Integration:** Because internal Alexa+ runtime interfaces are proprietary and not publicly accessible, we adhered strictly to the hackathon guidelines permitting simulated web experiences. We resisted the temptation to mock or fake a live Alexa+ cloud connection, ensuring every log, UI label, and test truthfully reflects our local Streamable HTTP MCP architecture.
2. **Chromium Loopback Origin Normalization:** Windows Chrome sets `Origin: http://localhost:3000` when navigating via `localhost`, but `Origin: http://127.0.0.1:3000` when navigating via IP. Strict origin matching initially caused 403 errors when users typed `localhost`. We updated `server.mjs` to safely permit standard loopback aliases on the active port while continuing to reject external origins (e.g., `attacker.example`).
3. **Decoupling Approval from Model Control:** Ensuring an AI assistant could not unilaterally authorize an invitation required strict architectural separation: model MCP tokens cannot access first-party approval endpoints, and first-party approvals expire after 120 seconds if not consumed.

---

### Genuine Product Feedback & Real SDK Friction
- **Streamable HTTP Spec vs. Single-Turn Tool Calls:** The MCP Streamable HTTP transport requires `Accept: application/json, text/event-stream` even when returning standard JSON responses for tool calls. Providing clearer documentation and examples for single-turn HTTP request-response patterns would help developers building lightweight web agents.
- **Zod Schema Mapping Complexity:** When using `@modelcontextprotocol/sdk` v1.32.1, translating existing JSON Schemas with optional fields and constraints into Zod definitions requires verbose boilerplate. First-class support for raw JSON Schema tool definitions in the SDK would reduce friction.
- **Protocol-Level Human-in-the-Loop Primitives:** Modern agent frameworks lack standardized protocol primitives for out-of-band human approvals. If MCP introduced standard tool result schemas for `requires_human_approval` with a callback or approval URI, multi-party delegation workflows like RelayCase could be standardized across the industry.

---

### Accomplishments We're Proud Of
- **100% Verified Test Suite:** 35 unit/security tests, 19 judge rehearsal checks, 9 official SDK checks, and 16 real Chrome browser E2E checks all passing.
- **Continuous English Demo Video:** A complete 170.80-second HD video with professional spoken English narration and accessible lower-third captions, thoroughly demonstrating the end-to-end workflow under the 3-minute limit.
- **Zero-Dependency Default Startup:** Anyone with Node.js 22+ can clone and run `node demo-launcher.mjs` immediately without installing heavy node modules.

---

### What We Learned
We learned that the most important safety boundary in household AI is not the accuracy of the language model, but the explicit recording of human commitment. Differentiating between an AI draft, a human agreement, a completion claim, and an acknowledgment creates trust that cannot be achieved through prompt engineering alone.

---

### What's Next for RelayCase
- **WebAuthn Biometrics:** Introducing passkey authentication so household approvals can be signed using Touch ID / Windows Hello.
- **Public Alexa+ Skill Integration:** Transitioning from the simulated web host to live Alexa+ multi-agent capabilities as developer access expands.
- **Tamper-Evident Merkle Trees:** Adding cryptographic log chaining to SQLite audit events for verifiable external auditing.

---

## 3. Submission Links Checklist

| Field | Value / Location |
|---|---|
| **Project Name** | RelayCase — Bounded Household Responsibility Assistant |
| **Demo Video URL** | *Upload `RelayCase_Continuous_English_Demo.mp4` to YouTube or Vimeo and paste URL here* |
| **GitHub Repository URL** | https://github.com/Mumuksh-Jain/amazondevpost |
| **Video Runtime** | 170.80 seconds (2 minutes 50 seconds — under 3 minutes) |
| **Submission Deadline** | October 24, 2026, 00:30 IST |
