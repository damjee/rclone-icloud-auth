# Copilot Instructions

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
