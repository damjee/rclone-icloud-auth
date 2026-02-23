# Copilot Instructions

## Running the project

```bash
npm start      # run the authenticator
npm test       # run all unit tests
```

No build step. TypeScript runs directly via `tsx`.

## Project structure

```
src/
  index.ts                        ← CLI entry point — wiring only, no flow logic
  core/                           ← pure, testable, zero I/O dependencies
    args.ts                       ← CLI argument parsing
    auth-flow.ts                  ← Apple sign-in flow (injectable deps)
    config.ts                     ← rclone.conf patching + remote parsing
    cookies.ts                    ← trust cookie extraction
    messages.ts                   ← all user-facing strings
    orchestrator.ts               ← top-level auth orchestration
    remote-selection.ts           ← remote selection flow (injectable deps)
  adapters/                       ← I/O boundary: browser, filesystem, prompts, process
    browser-driver.ts             ← puppeteer-extra headless driver
    browser-driver-builder.ts     ← builder for the driver (debug mode opt-in)
    debugging-browser-driver.ts   ← debug screenshot decorator
    filesystem.ts                 ← rclone.conf + preferences file I/O
    launcher.ts                   ← BrowserAuthAdapter (wires browser driver to core)
    process.ts                    ← rclone connection test (execSync)
    prompt.ts                     ← stdin prompts
tests/
  core/                           ← Vitest unit tests (core only)
temp/                             ← gitignored; stores preferences.json
```

## Architecture

Ports & adapters. `src/core/` contains pure business logic with zero Apple, puppeteer, or filesystem dependencies. `src/adapters/` is the I/O boundary. `src/index.ts` wires them together.

### Core flow pattern

**All new user-facing flows must follow this pattern**, established by `auth-flow.ts` and `remote-selection.ts`:

1. Create a pure function in `src/core/` that accepts injected dependencies:
   - `prompt*` functions for any user input
   - `log` for any console output (`(message: string) => void`, defaults to no-op)
2. All user-facing strings go in `src/core/messages.ts` — never inline strings in flow functions or `index.ts`
3. `index.ts` wires the adapter implementations to the core function — no flow logic in `index.ts`

Example:
```typescript
// src/core/my-flow.ts
export async function runMyFlow(
  promptSomething: (prompt: string) => Promise<string>,
  log: (message: string) => void = () => {}
): Promise<MyResult> {
  log(Messages.SOME_STATUS);
  const value = await promptSomething(Messages.SOME_PROMPT);
  ...
}

// src/index.ts — wiring only
const result = await runMyFlow(promptUser, console.log);
```

### AuthAdapter seam

```typescript
interface AuthResult { trustToken: string; cookies: string; }
interface AuthAdapter { authenticate(): Promise<AuthResult>; }
```

### Key auth details
- Apple's login page loads inside an **iframe** from `idmsa.apple.com` — always check `page.frames()` when looking for input fields
- The password field has `tabindex="-1"` until Apple validates the Apple ID; poll until it becomes `"0"` before typing
- Apple sets the trust cookie via **response headers** — poll `page.cookies()` rather than intercepting requests
- `extended_login: true` is injected into the `/accountLogin` POST body for a longer-lived token

## Key conventions

- **ESM with top-level `await`** — `package.json` has `"type": "module"`. `src/index.ts` uses top-level `await`.
- **rclone.conf patching** — pure string transformation in `src/core/config.ts`. Filesystem I/O only in `src/adapters/filesystem.ts`. Writes with mode `0o600`.
- **Preferences** — saved at `temp/preferences.json` (repo-local, gitignored) via `src/adapters/filesystem.ts`.
- **Clean code standards** — early returns over nesting, named constants for all magic values, intent-revealing names (no abbreviations), self-documenting code (no inline comments), functions ~20 lines max.
- **Testing philosophy** — test behaviour/contracts not implementation, fakes over mocks, F.I.R.S.T., no snapshots. Unit tests cover `src/core/` only; adapters are not unit tested.
- **TDD** — write failing tests before implementing new core logic.


## Running the project

```bash
# Headless mode (automated — prompts for Apple ID, password, and 2FA code)
tsx src/index.ts --headless

# Headless with debug screenshots saved to /tmp/icloud-debug-*.png
tsx src/index.ts --headless --debug

# Run tests
npm test
```

No build step. Run directly via `tsx` (installed as a dependency: `npx tsx` or `./node_modules/.bin/tsx`).

## Active refactor

**Branch:** `testability-refactor` — a ports & adapters refactor is in progress. `main` is untouched.

**Current state:** GREEN phase complete. All 29 tests pass. `src/core/` and `src/adapters/` are fully implemented. Old top-level `index.ts` and `headless.ts` have been removed.

**Structure:**
```
src/
  index.ts                  ← CLI entry (--headless, --debug flags)
  core/                     ← pure, testable, zero Apple/puppeteer/fs deps
    cookies.ts / config.ts / args.ts / orchestrator.ts
  adapters/                 ← Apple/library boundary, not unit tested
    browser-gui.ts / browser-headless.ts / filesystem.ts / prompt.ts / process.ts
tests/
  core/                     ← Vitest unit tests (behavior, fakes over mocks)
    cookies.test.ts / config.test.ts / args.test.ts / orchestrator.test.ts
llm-docs/                   ← gitignored LLM communication docs
  testing-strategy.md       ← explains test intent for reviewing LLMs
```

**AuthAdapter interface** is the seam between core and adapters:
```typescript
interface AuthResult { trustToken: string; cookies: string; }
interface AuthAdapter { authenticate(): Promise<AuthResult>; }
```

## Architecture

This tool automates the iCloud auth flow required to keep an **rclone iCloud remote** working. Apple's iCloud requires a short-lived session cookie (`X-APPLE-WEBAUTH-HSA-TRUST`) for rclone to connect. This tool retrieves that cookie via a browser and writes it into `~/.config/rclone/rclone.conf`.

### Auth modes

| Flag | Mode | Adapter |
|------|------|---------|
| _(none)_ | **GUI / headful** | `browser-gui.ts` — opens visible Chrome, intercepts `/accountLogin`, waits for trust cookie in request headers |
| `--headless` | **Headless / automated** | `browser-headless.ts` — prompts for Apple ID + password + 2FA via stdin, uses puppeteer-extra + stealth plugin |

### Key auth details
- Apple's login page loads inside an **iframe** from `idmsa.apple.com` — always check `page.frames()` when looking for input fields, not just the top-level page.
- The password field has `tabindex="-1"` until Apple validates the Apple ID; poll until it becomes `"0"` before typing.
- Apple sets the trust cookie via **response headers**, not JavaScript — poll `page.cookies()` rather than intercepting requests.
- `extended_login: true` is injected into the `/accountLogin` POST body to obtain a longer-lived trust token.

## Key conventions

- **ESM with top-level `await`** — `package.json` has `"type": "module"`. `src/index.ts` uses top-level `await`.
- **`puppeteer` vs `puppeteer-extra`** — `browser-gui.ts` uses plain `puppeteer`; `browser-headless.ts` uses `puppeteer-extra` + stealth plugin.
- **Request interception order** — Always check `request.isInterceptResolutionHandled()` before calling `request.continue()`.
- **rclone.conf patching** — Pure string transformation in `src/core/config.ts`. Filesystem I/O only in `src/adapters/filesystem.ts`. Writes with mode `0o600`.
- **Debug screenshots** — Opt-in via `--debug` flag; captured only in `browser-headless.ts`.
- **Clean code standards** — Early returns over nesting, named constants for all magic values (selectors, timeouts, URL fragments), intent-revealing names (no abbreviations), self-documenting code (no inline comments), functions ~20 lines max.
- **Testing philosophy** — Test behavior/contracts not implementation, fakes over mocks, F.I.R.S.T., no snapshots. See `llm-docs/testing-strategy.md` for full test intent documentation.

## Running the project

```bash
# GUI mode (opens a visible browser window — user logs in manually)
node index.ts

# Headless mode (automated — prompts for Apple ID, password, and 2FA code)
node headless.ts

# Run tests
npm test
```

No build step. Scripts run directly via Node.js with native TypeScript support.

## Active refactor

**Branch:** `testability-refactor` — a ports & adapters refactor is in progress. `main` is untouched.

**Current state:** RED phase complete. `tests/core/` has 4 failing test files. `src/core/` does not exist yet. Next step is GREEN: implement `src/core/` to make the tests pass.

**Planned structure (in progress):**
```
src/
  index.ts                  ← CLI entry (--headless, --debug flags)
  core/                     ← pure, testable, zero Apple/puppeteer/fs deps
    cookies.ts / config.ts / args.ts / orchestrator.ts
  adapters/                 ← Apple/library boundary, not unit tested
    browser-gui.ts / browser-headless.ts / filesystem.ts / prompt.ts / process.ts
tests/
  core/                     ← Vitest unit tests (behavior, fakes over mocks)
    cookies.test.ts / config.test.ts / args.test.ts / orchestrator.test.ts
llm-docs/                   ← gitignored LLM communication docs
  testing-strategy.md       ← explains test intent for reviewing LLMs
```

**AuthAdapter interface** is the seam between core and adapters:
```typescript
interface AuthResult { trustToken: string; cookies: string; }
interface AuthAdapter { authenticate(): Promise<AuthResult>; }
```

## Architecture (original, on main)

This tool automates the iCloud auth flow required to keep an **rclone iCloud remote** working. Apple's iCloud requires a short-lived session cookie (`X-APPLE-WEBAUTH-HSA-TRUST`) for rclone to connect. This tool retrieves that cookie via a browser and writes it into `~/.config/rclone/rclone.conf`.

There are two auth modes:

| File | Mode | How it works |
|------|------|-------------|
| `index.ts` | **GUI / headful** | Opens a visible Chrome window. User logs in manually. Script intercepts the `/accountLogin` request to inject `extended_login: true`, then waits for the trust cookie to appear in outgoing request headers. Prints the `rclone config update` command to stdout. |
| `headless.ts` | **Headless / automated** | Prompts for Apple ID + password + 2FA code via stdin. Uses `puppeteer-extra` with the stealth plugin to bypass bot detection. Fills credentials into Apple's auth iframe (`idmsa.apple.com`). Polls `page.cookies()` for the trust cookie. Auto-patches `rclone.conf` and runs `rclone lsd iclouddrive:` as a connection test. |

### Key auth details
- Apple's login page loads inside an **iframe** from `idmsa.apple.com` — always check `page.frames()` when looking for input fields, not just the top-level page.
- The password field has `tabindex="-1"` until Apple validates the Apple ID; poll until it becomes `"0"` before typing.
- Apple sets the trust cookie via **response headers**, not JavaScript — in `headless.ts` this means polling `page.cookies()` rather than intercepting requests.
- `extended_login: true` is injected into the `/accountLogin` POST body to obtain a longer-lived trust token.

## Key conventions

- **ESM with top-level `await`** — `package.json` has `"type": "module"`. Both files use top-level `await` throughout; no wrapper functions.
- **`puppeteer` vs `puppeteer-extra`** — `index.ts` uses plain `puppeteer`; `headless.ts` uses `puppeteer-extra` + `puppeteer-extra-plugin-stealth` to avoid Apple's bot detection in headless mode.
- **Request interception order** — Always check `request.isInterceptResolutionHandled()` before calling `request.continue()` to avoid double-handling conflicts with puppeteer-extra plugins.
- **rclone.conf patching** — Uses regex replace on the raw file content. Targets the `[iclouddrive]` section. Writes back with mode `0o600`.
- **Debug screenshots** — `headless.ts` saves intermediate screenshots to `/tmp/icloud-debug-*.png` to aid debugging when the headless flow breaks.
- **Clean code standards** — Early returns over nesting, named constants for all magic values (selectors, timeouts, URL fragments), intent-revealing names (no abbreviations), self-documenting code (no inline comments), functions ~20 lines max.
- **Testing philosophy** — Test behavior/contracts not implementation, fakes over mocks, F.I.R.S.T., no snapshots. See `llm-docs/testing-strategy.md` for full test intent documentation.

## Running the project

```bash
# GUI mode (opens a visible browser window — user logs in manually)
node index.ts

# Headless mode (automated — prompts for Apple ID, password, and 2FA code)
node headless.ts
```

No build step. Scripts run directly via Node.js using native TypeScript support (`node` runs `.ts` files directly in the version configured for this project).

No linter or test runner is configured yet (Vitest is planned).

## Architecture

This tool automates the iCloud auth flow required to keep an **rclone iCloud remote** working. Apple's iCloud requires a short-lived session cookie (`X-APPLE-WEBAUTH-HSA-TRUST`) for rclone to connect. This tool retrieves that cookie via a browser and writes it into `~/.config/rclone/rclone.conf`.

There are two auth modes:

| File | Mode | How it works |
|------|------|-------------|
| `index.ts` | **GUI / headful** | Opens a visible Chrome window. User logs in manually. Script intercepts the `/accountLogin` request to inject `extended_login: true`, then waits for the trust cookie to appear in outgoing request headers. Prints the `rclone config update` command to stdout. |
| `headless.ts` | **Headless / automated** | Prompts for Apple ID + password + 2FA code via stdin. Uses `puppeteer-extra` with the stealth plugin to bypass bot detection. Fills credentials into Apple's auth iframe (`idmsa.apple.com`). Polls `page.cookies()` for the trust cookie. Auto-patches `rclone.conf` and runs `rclone lsd iclouddrive:` as a connection test. |

### Key auth details
- Apple's login page loads inside an **iframe** from `idmsa.apple.com` — always check `page.frames()` when looking for input fields, not just the top-level page.
- The password field has `tabindex="-1"` until Apple validates the Apple ID; poll until it becomes `"0"` before typing.
- Apple sets the trust cookie via **response headers**, not JavaScript — in `headless.ts` this means polling `page.cookies()` rather than intercepting requests.
- `extended_login: true` is injected into the `/accountLogin` POST body to obtain a longer-lived trust token.

## Key conventions

- **ESM with top-level `await`** — `package.json` has `"type": "module"`. Both files use top-level `await` throughout; no wrapper functions.
- **`puppeteer` vs `puppeteer-extra`** — `index.ts` uses plain `puppeteer`; `headless.ts` uses `puppeteer-extra` + `puppeteer-extra-plugin-stealth` to avoid Apple's bot detection in headless mode.
- **Request interception order** — Always check `request.isInterceptResolutionHandled()` before calling `request.continue()` to avoid double-handling conflicts with puppeteer-extra plugins.
- **rclone.conf patching** — Uses regex replace on the raw file content. Targets the `[iclouddrive]` section. Writes back with mode `0o600`.
- **Debug screenshots** — `headless.ts` saves intermediate screenshots to `/tmp/icloud-debug-*.png` to aid debugging when the headless flow breaks.
