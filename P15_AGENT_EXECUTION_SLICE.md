# P15 — The single task to execute in Antigravity / Claude Code

**Urgency:** Deadline 24 Oct 2026 at 00:30 IST. Do not run further research passes before the required submission checks.

## Inputs
Extract `RELAYCASE_PASS15_MCP_SDK_CANDIDATE.zip`, open `relaycase/`, and read `README.md` under its **Pass 15** section. This is a local synthetic prototype. It does not connect to actual Alexa+ and cannot safely be published as an open Internet service in its current bearer-token form.

## Step 1 — real official MCP SDK test (must do first)

Node >=22.13, npm registry access required:

```sh
npm install --save-exact
npm run sdk-check
```

This creates a throwaway local in-memory server using **actual SDK v1.32.1** (`RELAY_MCP_TRANSPORT=official` internally), connects an independent maintained SDK client over real Streamable HTTP and must print `"result":"PASS"` with 9 checks, seven tools, and a state of `AWAITING_ASSIGNEE_RESPONSE`. Record the actual stdout, npm version, Node version and `package-lock.json` hash. Never invent a PASS. If it fails, use the exception to fix `mcp-official.mjs`/`server.mjs`, then rerun both `npm run sdk-check` and `npm test` (34 local regression tests). If the registry is blocked, record **BLOCKED**, not passed.

## Step 2 — browser and demo

```sh
# run the official-backed local demo only AFTER SDK verification succeeds
# PowerShell:
$env:RELAY_MCP_TRANSPORT = 'official'
node demo-launcher.mjs
```

In a **normal, direct** local Chrome/Edge session, complete Priya draft/preview/approval; assistant tool sends; Sam accepts and claims completion; Priya acknowledges. Test 1440px, 390px, 320px. Record console errors and screenshots with no credentials visible. SDK adapter must preserve approval boundaries.

## Step 3 — publish/submit after manual verification

- Verify no secrets, DB files, `node_modules`, local token strings or third-party copyrighted assets are included. Git repository must have a legitimate license.
- Record a public English video < 3 minutes showing the actual experience and explicitly stating simulated Alexa+ and local SDK tool calls (do not claim direct live Alexa+ preview access).
- Host code publicly (or follow Devpost's private collaboration flow) and include valid run/test instructions.
- Describe real SDK tools and authentic friction in Devpost form; do not claim AWS or Open Source mini-challenge integrations that are not built.
- Submit before the official deadline and keep the confirmation; only then mark `SUBMITTED`.

## Stop conditions
No access to npm, public hosting or Devpost means external steps remain BLOCKED. Do not replace them with a self-reported success. Do not add extra research, animations or product features while these gates are open.
