# RelayCase — Architectural & Release Decisions

## Context
RelayCase is a bounded household handoff assistant prototype with a real Node.js/SQLite backend, a deterministic simulated assistant, and real HTTP MCP-shaped calls. It addresses accountability in AI-mediated household task delegation: ensuring AI agents cannot unilaterally commit humans to real-world tasks or falsely verify physical completion.

---

## Decision 1: Truthful Simulation Scope vs. Live Alexa+ Claims
- **Decision:** Clearly label the application as a **simulated Alexa+ web experience** backed by real local MCP HTTP transport and SQLite persistence.
- **Rationale:** No developer has access to unpublished proprietary Alexa+ internal agent runtimes. The official Devpost rules explicitly permit simulated web experiences. Faking a live Alexa+ connection would violate hackathon rules and engineering integrity.
- **Implementation:** Prominent persistent banners in UI, clear stdout statements in demo launcher and test runners, transparent disclosures in README and Devpost submission text.

---

## Decision 2: Official MCP SDK Interoperability Verification
- **Decision:** Execute and verify `npm run sdk-check` using the pinned `@modelcontextprotocol/sdk` v1.32.1 and `zod` v4.2.0 on the network-connected host.
- **Rationale:** Pass 16 previously flagged the official SDK check as unverified due to DNS lookup failures (`EAI_AGAIN`) in the prior sandbox. Upon testing in the current Windows environment, `npm install --save-exact` and `npm run sdk-check` completed with `PASS` across 9 checks and 7 tools.
- **Integrity Rule:** We document the exact observed JSON output and do not claim official Amazon certification or third-party client endorsement beyond the tested v1 Streamable HTTP transport compliance.

---

## Decision 3: Human Approval Separation Gate
- **Decision:** Strictly enforce server-side human approval for task invitations. MCP tools can create drafts and request previews, but cannot call `send_approved_handoff` without separate first-party UI human approval.
- **Rationale:** Preventing AI agents from unilaterally dispatching commitments without human review is the core safety invariant of RelayCase.
- **Implementation:** `domain.mjs` enforces approval token/timestamp checks; `server.mjs` exposes distinct endpoint `/api/cases/:id/approve` requiring first-party bearer tokens rather than assistant MCP tokens.

---

## Decision 4: Claim vs. Proof Distinction in Completion Statuses
- **Decision:** Transition tasks from `ACCEPTED` to `CLAIMED_DONE`, never `VERIFIED_DONE`.
- **Rationale:** An AI or web software system cannot physically guarantee that a parcel was brought indoors, dishes were washed, or a gate was locked. Conflating human claim with physical verification leads to automation bias and real-world failure.
- **Status Lifecycle:** `DRAFT` -> `AWAITING_REQUESTER_APPROVAL` -> `AWAITING_ASSIGNEE_RESPONSE` -> `ACCEPTED` -> `CLAIMED_DONE` -> `CLOSED_ACKNOWLEDGED` (or `DISPUTED` / `NEEDS_REASSIGNMENT`).

---

## Decision 5: Loopback Origin Normalization for Browser Environments
- **Decision:** In `server.mjs`, when bound to a loopback host (`127.0.0.1`, `localhost`, or `::1`), permit requests whose `Origin` header matches any standard loopback format on the active port.
- **Rationale:** Chromium and Windows users frequently navigate using `http://localhost:<port>` as well as `http://127.0.0.1:<port>`. Previously, `server.mjs` strictly matched only `http://127.0.0.1:<port>`, causing valid browser fetch calls from `localhost` to be rejected with `403 BAD_ORIGIN`. This was the root cause of the limitation noted in Pass 16 regarding direct browser loopback networking. External untrusted origins (e.g., `attacker.example`) remain firmly rejected with 403.
- **Verification:** Verified via `verify-real-browser.mjs` against Google Chrome with native CDP, confirming direct navigation to both `http://127.0.0.1` and `http://localhost` without errors.

---

## Decision 6: Continuous English Audio-Narrated Demo Video
- **Decision:** Produce a brand-new, continuous English audio-narrated MP4 video (`RelayCase_Continuous_English_Demo.mp4`) with an exact runtime of 170.80 seconds (2m 50s), satisfying the Devpost under-3-minute rule.
- **Rationale:** The Pass 16 kit previously contained only a 102s silent slide preview (`RelayCase_English_Captioned_Demo_Preview.mp4`) with no audio track. Hackathon rules encourage a clear, continuous demonstration with English narration.
- **Implementation:** Generated 14 distinct spoken narration clips using Windows Speech Synthesis (`Microsoft David Desktop` at natural rate 1), rendered 1600x900 composite UI frames via headless Chrome CDP, and encoded into progressive H.264 video with AAC audio via FFmpeg.
- **Disclosures Included:** Explicit callouts in both spoken voice and lower-third banners explaining that RelayCase is a simulated Alexa+ web experience backed by local SQLite and real HTTP MCP, and that task completion is an unverified human claim rather than physical AI proof.

---

## Decision 7: Anti-AI Craft Paradigm & Architectural Workbench UI/UX Redesign
- **Decision:** Transform the frontend interface from a plain utility dashboard into a tactile, high-craft architectural accountability workbench inspired by CollabHub ("The Anti-AI Craft Paradigm") and Pip DreamOS.
- **Rationale:** The previous UI was utilitarian and generic. Household delegation and accountability require trust, transparency, and human agency. By adopting warm drafting paper textures (`#f6f4ee`), accessible terracotta accents (`#b04c18`), deep stone typography (`#2b2318`), and an architectural 7-stage workflow stepper, the interface communicates technical sophistication and human sovereignty.
- **Key Visual & Interaction Upgrades:**
  1. **Typographic Hierarchy:** Paired `Outfit` (display/headings), `DM Sans` (body), and `JetBrains Mono` (hashes, IDs, telemetry).
  2. **7-Stage Workflow Progress Stepper:** Explicit horizontal pipeline visually tracking `DRAFT` → `PREVIEW` → `APPROVED` → `INVITED` → `ACCEPTED` → `CLAIMED DONE` → `CLOSED`.
  3. **Zero-Asset Web Audio API Sound Synthesis:** Mechanical switch clicks and pop transitions on interactions, with an accessible navbar sound toggle (`🔊` / `🔇`).
  4. **Session Gateway Persona Switcher:** Direct quick-switch persona chips for Priya (Requester), Sam (Assignee), and Alex (Member) for effortless reviewer evaluation.
  5. **Simulated Assistant Workbench:** Suggested command chips (`[who can help?]`, `[draft: ...]`), animated execution shimmer, and syntax-highlighted MCP JSON-RPC trace inspector.
  6. **Epistemic Truth Banners:** Explicit visual seals reinforcing that `CLAIMED_DONE` is a human report, not independent physical proof.
- **Verification:** All 35 regression tests, 19 judge rehearsal checks, 9 official SDK checks, and 16 real Chrome CDP browser checks pass with 0 errors.


