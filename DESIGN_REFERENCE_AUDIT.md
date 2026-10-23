# RelayCase — Design Reference Audit & Translation Plan

**Audit Date:** 2026-10-23  
**Auditor:** Senior Product Designer & UI/UX Architect  
**References Analyzed:**
1. `D:\Projects\FullStack_Capstone` (CollabHub — "The Anti-AI Craft Paradigm")
2. `D:\hackathons\baby-hax` (Pip — "DreamOS 93 / Tactile Web Engineering")

---

## 1. Forensic Analysis of References

### A. Reference 1: CollabHub (`D:\Projects\FullStack_Capstone`)

#### Design Philosophy: "The Anti-AI Craft Paradigm"
CollabHub rejects generic "AI SaaS" templates (e.g. purple neon gradients, floating canvas particles, low-contrast text) in favor of **tactile, architectural craftsmanship**.

- **Artistic Direction:** Architectural drafting table, technical telemetry, engineering precision, honest material surfaces.
- **Background & Textures:**
  - Base: Warm drafting paper (`#f5f2ec`), card surface (`#faf8f3`), elevated panels (`#ffffff`).
  - Texture: Subtle SVG fractal noise (`opacity: 0.025`) simulating tactile paper fiber, plus 48px hairline drafting grid.
- **Color Palette:**
  - Primary text: Deep obsidian stone (`#2b2318`).
  - Secondary/muted text: Warm earth slate (`#5c4f3f`, `#675a4d`).
  - Hairline borders: Neutral bone stone (`#ddd9d0`, `#e5dfd5`).
  - Primary Accent: Terracotta clay (`#b04c18` / `#c45c26`), fully WCAG AA compliant.
  - Success/Safety: Deep forest botanical green (`#2e5c38`).
  - Caution/Danger: Rich rust crimson (`#b82e20`).
- **Typography:**
  - Display/Headings: `Outfit` (geometric, warm humanist curve, high legibility).
  - Body/Interface: `DM Sans` / `Outfit` (clean, generous line-height 1.6).
  - Telemetry/Technical Stamps: `JetBrains Mono` / monospace for status tags, case hashes, IDs, and payload inspection.
- **Motion & Physics:**
  - `fadeUp`: `cubic-bezier(0.22, 1, 0.36, 1)`, duration 450–550ms.
  - Staggered entrances for children cards (`0.08s`, `0.14s`, `0.20s` delays).
  - Subtle interactive scale/hover (`translateY(-2px)`, shadow bloom).
- **Sound Synthesis:**
  - Web Audio API zero-asset mechanical switch clicks (820Hz triangle oscillator ramping to 140Hz over 40ms, gain 0.04) and warm pop sounds on toggles.
  - Persistent sound toggle (`🔊 / 🔇`) stored in `localStorage`.

---

### B. Reference 2: Pip DreamOS (`D:\hackathons\baby-hax`)

- **Artistic Direction:** Tactile OS environment, high user agency, delightful responsive micro-interactions.
- **Interaction Architecture:**
  - Clear taskbar/header with live telemetry indicators (status pill, active user, mode indicator).
  - Status tokens and chips that act as physical tags (`[+ Frontend]`, `[PHASE-01]`, `[STEP 03/06]`).
  - Keyboard shortcuts (`Esc` closes modals, `M` toggles mute, `Enter` submits).
  - Visible focus rings with 2px offset for accessibility.
- **Mobile First Adaptation:**
  - Minimum 44px tap targets for every interactive button.
  - Responsive collapse: two-column workbench smoothly collapses into a single-column stacked tab flow without horizontal overflow.

---

## 2. Translation into RelayCase Premium Identity

RelayCase is **not** a social network or an OS game; it is an **accountable household responsibility handoff system**.
Its core value is **epistemic honesty**:
- Distinguishing an AI draft from a human commitment.
- Distinguishing a human claim from physical reality verification.
- Proving immutability and separate first-party approval before task dispatch.

### The RelayCase Visual Language: "The Architectural Accountability Workbench"

| Element | Prior RelayCase Design | Redesigned RelayCase Identity |
|---|---|---|
| **Canvas** | Cold grey `#f7f9fc` background | Warm architectural parchment (`#f6f4ee`) with subtle paper fiber texture and hairline blueprint grid. |
| **Typography** | Generic system sans-serif | Editorial & Technical hierarchy: `Outfit` (headings/brand) + `DM Sans` (body) + `JetBrains Mono` (hashes, case IDs, telemetry). |
| **Header** | Flat divider with plain text | Floating architectural navbar with live telemetry ticker (`● LOCAL LOOPBACK · MCP HTTP ACTIVE · SQLITE PERSISTENT`), sound synthesis toggle (`🔊`), and identity pill. |
| **Authentication** | Plain centered form with single input | High-craft Session Gateway with fast demo identity quick-switcher chips (Priya, Sam, Alex) for instant reviewer testing, plus manual token field and security badges. |
| **Assistant Panel** | Basic border box with monospace dump | Dedicated "Simulated Assistant Workbench": prompt suggestions chips, real-time tool execution shimmer, structured MCP request/response inspector with JSON highlighting. |
| **Handoff Workflow** | Flat text status pill | **7-Stage Interactive Workflow Stepper**: `01 DRAFT` → `02 PREVIEW` → `03 APPROVED` → `04 INVITED` → `05 ACCEPTED` → `06 CLAIMED` → `07 CLOSED`. Current stage pulses with tactile accent. |
| **Approval Boundary** | Standard button row | **First-Party Cryptographic Sign-off Seal**: Distinct approval stamp with countdown TTL, golden verified border, server-derived badge, and separate send dispatch button. |
| **Claim vs Proof** | Generic text note | High-visibility **Epistemic Truth Banner**: Clear visual badge distinguishing `CLAIMED_DONE` from physical verification, preserving household trust. |
| **Audit History** | Raw unordered list | **Architectural Timeline**: Connected vertical ledger nodes with actor avatar pills, event type stamps, and relative timestamps. |
| **Audio Feedback** | None | Synthesized zero-asset mechanical clicks & tactile feedback for state changes via Web Audio API. |
| **Modals / Prompts** | Raw browser `window.prompt()` | Styled accessible modal sheets with tactile buttons, keyboard trapping, and backdrop blur. |

---

## 3. Implementation Plan & Milestones

1. **Tokens & Base Styles (`style.css`)**:
   - Define CSS custom properties for palette, shadows, typography, grid, and animations.
   - Clean reset, typography rules, layout shells, and responsive media queries.
2. **Audio Synthesis Service (`sound.js` / inline)**:
   - Implement zero-dependency Web Audio API sound synthesizer with mute toggle and localStorage persistence.
3. **Application Shell & Header (`app.js`, `index.html`)**:
   - Enhance `index.html` with Google Font preconnects (`Outfit`, `DM Sans`, `JetBrains Mono`).
   - Build modern architectural header with telemetry bar and sound toggle.
4. **Login Experience & Demo Identity Switcher**:
   - Interactive identity chips for Priya, Sam, and Alex that auto-fill demo credentials for judges and reviewers.
5. **Cases Sidebar & Workspace Layout**:
   - Case search/filter, stage badges, active selection indicators, and "New handoff" creation modal/drawer.
6. **7-Stage Handoff Stepper & Case Detail View**:
   - Visual progress stepper, immutable preview hash badge, approval seal, and clear claim-vs-proof disclosure.
7. **Simulated Assistant Workbench**:
   - Suggestion chips, animated thinking/tool calling state, and styled MCP JSON-RPC trace details.
8. **Automated Testing & Visual Verification**:
   - Verify `npm test`, `npm run judge-dry-run`, `npm run sdk-check`, and `npm run test:browser` across 1440px, 1024px, 768px, and 390px viewports.
