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

```bash
npm start
```

Prompts for your Apple ID, password, and 2FA code via the terminal. Patches `rclone.conf` automatically.

---

## Troubleshooting

**No iCloud remotes found**
Run `rclone config` to add an iCloud remote first, then re-run this tool.

**rclone.conf not found**
If `~/.config/rclone/rclone.conf` doesn't exist, run `rclone config update` to create it.
