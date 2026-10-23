# RelayCase — Final Submission Candidate

> **Synthetic demonstration, not connected to a live Alexa+ account.** This is a bounded household handoff simulator with real local Node.js/SQLite state, a deterministic simulated assistant, and real HTTP MCP-shaped calls. Human approval is server-enforced through the first-party UI. This is not a deployed production service or a claim that a physical task was independently verified.

## Quick Start — No external dependencies required for the default local demo

- Requires Node.js **22.13+** (built-in `node:sqlite`) and a modern browser.
- From the `relaycase` directory run:
  ```bash
  node demo-launcher.mjs
  ```
- Open the printed **127.0.0.1:3000** or **localhost:3000** link in Chrome or Edge and sign in using one of the separate fictional identity credentials printed in the terminal (Priya, Sam, or Alex).
- Never copy those demo bearer tokens to GitHub, a public issue, a presentation or Devpost.

## Real Local Workflow

1. Sign in as **Priya**.
2. In the simulated assistant panel enter:
   `draft: Bring the parcel box indoors -> sam`
3. Select the saved draft in the sidebar, press **Preview request**.
4. Press **Send approved invitation** *before* approval to observe the deliberate security gate rejection (`403 APPROVAL_REQUIRED`).
5. Press **Approve invitation (human)**; the page displays a separate **Approval confirmed** indicator.
6. Press **Send approved invitation**, then sign out.
7. Sign in as **Sam**; open the case, click **Accept responsibility**, then **Report I finished**.
8. Sign back in as **Priya**; click **Acknowledge report** and **Load history**.
9. Note the distinct statuses: *invited*, *accepted*, *reported done*, *acknowledged*. Neither an AI message nor a human claim guarantees real-world physical completion.

## Tests and Verification Suite

```bash
# 1. Core unit and security regression suite (35/35 passing)
npm test

# 2. Independent synthetic judge rehearsal (19/19 checks passing)
npm run judge-dry-run

# 3. Official Model Context Protocol TypeScript SDK interop check (9/9 checks passing)
npm run sdk-check

# 4. Direct Windows Chromium loopback E2E verification (16/16 checks passing)
npm run test:browser
```

- **Regression Tests (35/35):** Verify SQLite transaction boundaries, actor identity scoping, tamper resistance, rate limiting, and server-derived human approval indicators.
- **Judge Dry-Run (19/19):** Performs an independent deterministic synthetic household loopback test, including negative security tests, human approval gates, cross-actor workflow, and SQLite persistence across server restart.
- **Official MCP SDK Integration (9/9):** Tests candidate `@modelcontextprotocol/sdk` v1.32.1 and `zod` v4.2.0 over Streamable HTTP transport against `server.mjs`. Verified passing on network-connected host.
- **Real Windows Browser Verification (16/16):** Drives direct Google Chrome loopback sessions via Chrome DevTools Protocol (CDP) over WebSocket, validating both `127.0.0.1` and `localhost` origins without any Playwright bridge, monkey-patching, or mocked fetch. 0 console errors.

## Demo Video

- **Continuous Spoken English Demo:** `RelayCase_Continuous_English_Demo.mp4` (located in root and `../demo/`)
  - **Runtime:** 170.80 seconds (2m 50s, strictly under the 3-minute hackathon limit)
  - **Format:** 1600x900 H.264 video, AAC audio, English spoken narration across all 14 steps.
  - **Captions:** On-screen lower-third badges, titles, and technical subtitles for full accessibility.
- **Preview Captioned Video (Supplementary):** `../demo/RelayCase_English_Captioned_Demo_Preview.mp4` (102.04s, Pass 16 silent preview).

## Publication and Safety Disclosures

- This local demo runs on loopback and uses temporary fictional-account bearer tokens, **not production authentication**. Do not expose port 3000 on a public host with those tokens.
- **No live Alexa+ account:** This submission truthfully implements a **simulated Alexa+ web experience** as permitted by contest rules, backed by real Node.js/SQLite and real Streamable HTTP MCP tools.
- **No physical task verification:** Software cannot guarantee that a physical household task occurred. The application explicitly records completion as a human *claim* (`CLAIMED_DONE`), never an AI verification.
- **License:** Licensed under the standard MIT License (see `LICENSE`).

## Key Files & Artifacts

- `server.mjs`: Node HTTP server supporting both custom MCP and official Streamable HTTP MCP transports, SQLite persistence, rate limiting, and origin validation.
- `domain.mjs`: Pure domain state machine enforcing immutability, idempotency, and separate human approvals.
- `assistant-host.mjs`: Deterministic simulated assistant communicating over real HTTP MCP JSON-RPC.
- `mcp-lite.mjs`: Zero-dependency Streamable HTTP MCP subset implementing the 2025-11-25 protocol specification.
- `mcp-official.mjs`: Maintained `@modelcontextprotocol/sdk` v1.32.1 transport adapter.
- `interop/run-local-interop.mjs`: Independent test harness verifying official SDK client interoperability.
- `verify-real-browser.mjs`: Direct Chromium CDP loopback automated verification test.
- `generate-demo-video.mjs`: Continuous English audio demo video generation pipeline.
- `judge-dry-run.mjs`: 19-check deterministic evaluation script.
- `DECISIONS.md`: Architecture and security decision records.
- `BUILD_STATE.md`: Real-time build, test, and release verification state.
