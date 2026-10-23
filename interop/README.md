# Independent MCP SDK interoperability gate — NOT YET EXECUTED

Official source: https://ts.sdk.modelcontextprotocol.io/ (v1, 2025-11-25 support).

1. Start RelayCase with six different credentials (`README.md` or `demo-launcher.mjs`).
2. In a separate terminal, run `cd interop && npm install --save-exact`. This must successfully produce a `package-lock.json`; commit the lockfile for a future public repository.
3. Set `RELAY_MCP_TEST_TOKEN` to the **Priya MCP token**, not a UI token. With `demo-launcher.mjs`, MCP tokens are hidden from stdout: for this independent test, start `server.mjs` using explicit secret environment variables as shown in the main README, and select `RELAY_MCP_PRIYA`.
4. Run `npm run check` and capture its *actual* sanitized stdout. It should execute `connect`/initialize, `tools/list`, `tools/call` draft and read using the independent SDK client.
5. Inspect any errors; don't declare compliance from an unsuccessful run. Add re-open/restart verification, invalid-Origin checks and strict client testing before production claims.

This check was **NOT RUN** in the present container because `npm view @modelcontextprotocol/sdk@1.32.1` failed with registry DNS `EAI_AGAIN`. No SDK dependencies or package lock are bundled.


### Faster fully independent local check (Pass 15)
From the project **root** (not this folder), use `npm install --save-exact`
then `npm run sdk-check`. The root package pins SDK v1.32.1 and Zod 4.2.0.
This automated test generates and protects its own random UI and MCP tokens,
starts the candidate official SDK server on a random loopback port, and uses
another SDK client implementation over HTTP. It checks the separate human
approval gate and correct database updates. It is **not marked passed** unless
executed successfully after installation. Never replace a failure log with a
handwritten JSON-RPC client's test output.
