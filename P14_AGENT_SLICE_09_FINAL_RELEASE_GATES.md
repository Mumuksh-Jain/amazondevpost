# P14 — Agent execution slice 09: SHIP OR DOCUMENT THE BLOCKER

**Read this file first.** The master archive is historical reference only. Do not load 5,700+ lines into an AI agent's active prompt. The deadline is **Oct 24 2026, 00:30 IST** (official Oct 23 at 12:00 PDT). Prioritize publication and truthful verification, not more design.

## Source to run

Use `RELAYCASE_PASS14_RELEASE_HANDOFF.zip`, extracted into a new local folder. Work from the `relaycase/` folder. Do not modify original research ZIPs. Requires Node >=22.13 with `node:sqlite`.

### Phase A — baseline (do before editing)

```sh
node --version
node --test domain.baseline.test.mjs security.test.mjs mcp-http.test.mjs assistant-host.test.mjs
node demo-launcher.mjs
```

Expected baseline based on our Oct 22 sandbox re-run: **32 pass, 0 fail**. The launcher prints local fictional identity credentials; never capture them in published videos or commit them. Browser: open the local URL from a normal Windows Chrome/Edge browser and test actual direct networking (not the prior Python bridge).

### Phase B — independent MCP compatibility (primary technical gate)

In a second terminal on a network-connected machine:

```sh
cd interop
npm install --save-exact
```

Start server in the FIRST terminal with `RELAY_UI_{PRIYA,SAM,ALEX}` and separate `RELAY_MCP_{PRIYA,SAM,ALEX}` credentials per the main README, not with demo-launcher if you need the token for the second terminal. In SECOND terminal set `RELAY_MCP_TEST_TOKEN` to the Priya MCP token. Run:

```sh
node interop/official-client.mjs
```

- Confirm real `initialize` handshake negotiates `2025-11-25`, `tools/list` shows seven tools, `tools/call` creates draft and the read returns persisted data; test blocked pre-approval send and valid approved send through actor-separated surfaces.
- Save **sanitized actual terminal output**, SDK version and package lock in `MCP_SDK_EVIDENCE.txt`. Never invent success or commit bearer tokens.
- If compatibility fails, replace custom protocol transport with maintained SDK server transport, preserve **the same** existing domain and all negative tests. Re-run 32 tests plus official client check. Don't paper over an actual failure.
- Note: the separate **simulated Alexa+ experience** route exists in rules, but do not assume a deterministic parser qualifies as an AI/agentic tool without checking its eligibility. Never describe it as Amazon's live preview.

### Phase C — native UI browser testing

Run in normal Chrome/Edge over `http://127.0.0.1:3000` and test Priya → Sam → Priya. Show blocked send prior to explicit requester approval, approval on UI, MCP assistant send, assignee acceptance, human completion claim, and acknowledgement. Validate at 320, 390, 1440px. Capture screenshots **without credentials**. Record exact browser and command results in `BROWSER_NATIVE_EVIDENCE.txt`.

### Phase D — publish

- Push only source/assets, test code, LICENSE and README to a real GitHub repository. Check license visible and exclude `.env`, `*.sqlite`, `*.log`, generated credentials, node_modules.
- Do not expose the local demo to Internet with test bearer auth. Judging repository must be reproducible. If deploying, replace auth and use TLS.
- Create <180-second public ENGLISH YouTube or Vimeo video showing the actual simulator, live tool calls and truthful disclosures. No copyrighted audio/video.
- Complete Devpost fields, select only eligible tracks and mini-challenges, include accurate tool feedback and genuine friction log. If private repo, follow the **current** reviewer invitation rules (not an outdated shorter list).
- Verify real submission confirmation before deadline. Keep the demo path accessible during judging where required.

### Required final status format

For each phase report `PASS | FAIL | BLOCKED`, exact commands, actual outputs, UTC/IST date, filenames, and remediation. Update `BUILD_STATE.md` and `DECISIONS.md`. **No invented tests, no invented GitHub/YouTube/Devpost URLs.**
