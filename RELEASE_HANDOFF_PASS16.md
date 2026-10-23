# Pass 16 — release handoff (read first in Antigravity/Claude Code)

## Current truth

- Full local Node suite: 35/35 passed, including UI-visible server-derived human approval marker.
- Independent Node loopback end-to-end judge rehearsal: 19/19 checks passed, including real HTTP MCP-shaped calls, first-party approval, human acceptance/claim, requester acknowledgement, privacy boundary and SQLite restart persistence.
- Chromium UI interaction capture: 14 actual UI states, real Node HTTP backend reached via Python/Playwright bridge; normal Chromium localhost networking NOT independently established in this environment.
- Demo preview: 102.04-second English-captioned MP4 of authentic captured states; **not** a continuous live browser recording and no live Alexa+ connection.
- Candidate maintained SDK adapter: written, source checked; npm registry unreachable (`EAI_AGAIN`), `npm run sdk-check` NOT verified.
- No public repository, YouTube/Vimeo URL, hosted demo, or Devpost receipt was created here.

## Minimal agent task: prioritize external release, do not start a fresh redesign

1. Extract the submission ZIP, open `relaycase/`, run `node --version` and `node --test ...`, then `node judge-dry-run.mjs`. Preserve exact stdout.
2. Run `node demo-launcher.mjs` and test the real browser/localhost workflow without a Playwright bridge. Diagnose any issues.
3. Attempt `npm install --save-exact` and `npm run sdk-check` on a connected machine. If it fails, keep the simulated-experience route and label this limitation honestly; do not fake a log.
4. Capture a **continuous**, English-narrated under-3-minute screen recording, showing the actual simulated assistant tool call, blocked unapproved send, approved send and human handoff. The included captioned preview is supplementary.
5. Check that source, LICENSE, run steps, and all demo assets are safe for a public GitHub repo. Inspect git status for `.sqlite`, `.env`, bearer tokens, logs and `node_modules`. Do not push secrets.
6. Create the public repo through your own GitHub account (or connect GitHub explicitly). Do not claim a repo URL before it exists. Make clear this is a simulated Alexa+ web experience.
7. Upload the actual video to public YouTube/Vimeo, include the exact video URL, project description, source link, genuine product feedback, real SDK friction, and selected track in Devpost.
8. Confirm Devpost submission receipt **before October 24, 2026, 00:30 IST**. Screenshots of an unsubmitted form do not constitute completion.

## Contest requirement facts

Official rulebook: https://amazonappdev2026.devpost.com/rules
Overview: https://amazonappdev2026.devpost.com/
- Alexa+ permits a simulated web experience; include its actual source and clearly show it working.
- Required video is public, English, under 3 minutes, on YouTube or Vimeo.
- Required code repository contains all required source and runtime instructions, with license if public.
- Do not claim a mini-challenge unless its additional criteria are independently met.

## Fallback decision if the maintained SDK fails

Release the **proven simulated-web-experience** path with truthful scope; do not substitute an unverified claim of official MCP interoperability. If organizers require a specific interpretation, ask them with the exact code/demo evidence and preserve the response.
