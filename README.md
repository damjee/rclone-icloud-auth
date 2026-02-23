# rclone-icloud-auth

Automates the iCloud authentication flow required to keep an [rclone](https://rclone.org/) iCloud remote working.

Apple's iCloud requires a short-lived session cookie (`X-APPLE-WEBAUTH-HSA-TRUST`) for rclone to connect. This tool retrieves that cookie via a browser and writes it into your `rclone.conf`.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [rclone](https://rclone.org/install/) with at least one iCloud remote already configured (`rclone config`)
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

Prompts for your Apple ID, password, and 2FA code via the terminal. Patches `rclone.conf` automatically.

On startup the tool reads your `rclone.conf`, finds all iCloud remotes (`type = iclouddrive`), and asks you to select which one to update. If there is only one iCloud remote it is selected automatically. Your choice is remembered in `temp/preferences.json` and pre-selected on the next run.

```bash
npm start
```

---

## Troubleshooting

**No iCloud remotes found**
Run `rclone config` to add an iCloud remote first, then re-run this tool.

**rclone.conf not found**
If `~/.config/rclone/rclone.conf` doesn't exist, the script prints the `rclone config update` command to run manually.

**2FA / Trust button not found**
Re-run the script and check your Apple ID credentials. Ensure your device is nearby to receive the 2FA prompt.

**Connection test fails after patching**
The trust cookie is short-lived. Re-run the script to refresh it.
