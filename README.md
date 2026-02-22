# rclone-icloud-auth

Automates the iCloud authentication flow required to keep an [rclone](https://rclone.org/) iCloud remote working.

Apple's iCloud requires a short-lived session cookie (`X-APPLE-WEBAUTH-HSA-TRUST`) for rclone to connect. This tool retrieves that cookie via a browser and writes it into your `rclone.conf`.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [rclone](https://rclone.org/install/) with an iCloud remote named `iclouddrive` already configured
- Chrome/Chromium (installed automatically by puppeteer)

---

## Install

```bash
git clone https://github.com/damjee/rclone-icloud-auth
cd rclone-icloud-auth
npm install
```

---

## Usage

### GUI mode (default)

Opens a visible Chrome window. Log in manually with your Apple ID and 2FA. The script intercepts the auth flow and patches your `rclone.conf` automatically.

```bash
node src/index.ts
```

### Headless mode

Automated — prompts for your Apple ID, password, and 2FA code via the terminal. No browser window appears.

```bash
node src/index.ts --headless
```

### Debug mode

Saves screenshots to `/tmp/icloud-debug-*.png` at each step of the headless flow. Useful when the flow breaks.

```bash
node src/index.ts --headless --debug
```

---

## How it works

The project uses a **ports & adapters** architecture to keep the core logic pure and testable:

- **`src/core/`** — pure functions: cookie parsing, rclone.conf patching, CLI arg parsing, flow orchestration. No Apple or browser dependencies.
- **`src/adapters/`** — the Apple/browser boundary: puppeteer automation (GUI and headless), filesystem read/write, stdin prompts, rclone connection test.
- **`src/index.ts`** — wires the selected adapter to the core orchestrator based on CLI flags.

The `--headless` adapter uses [`puppeteer-extra`](https://github.com/berstend/puppeteer-extra) with the stealth plugin to bypass Apple's bot detection.

### What the auth flow does

1. Navigates to `icloud.com` and clicks the sign-in button
2. Injects `extended_login: true` into the `/accountLogin` POST body for a longer-lived token
3. In headless mode: fills Apple ID, waits for the password field to activate (`tabindex` changes from `-1` to `0`), fills password, handles 2FA, and clicks the Trust button if prompted
4. Polls for the `X-APPLE-WEBAUTH-HSA-TRUST` cookie
5. Writes the cookie and trust token into `~/.config/rclone/rclone.conf` under `[iclouddrive]`
6. Runs `rclone lsd iclouddrive:` as a connection test

---

## Troubleshooting

**rclone.conf not found**
If `~/.config/rclone/rclone.conf` doesn't exist, the script prints the `rclone config update` command to run manually.

**2FA / Trust button not found**
Run with `--debug` to capture screenshots at each step:
```bash
node src/index.ts --headless --debug
# screenshots saved to /tmp/icloud-debug-*.png
```

**Connection test fails after patching**
The trust cookie is short-lived. Re-run the script to refresh it.

---

## Development

```bash
npm test          # run all unit tests
```

Tests cover the pure core logic only (`src/core/`). Browser and Apple integrations are not unit tested — use `--debug` screenshots for those.
