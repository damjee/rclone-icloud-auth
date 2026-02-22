import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as readline from "readline";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";

puppeteer.use(StealthPlugin());

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q: string): Promise<string> =>
  new Promise((res) => rl.question(q, (answer) => { rl.pause(); res(answer); }));

console.log("=== rclone iCloud Headless Authenticator ===\n");

const appleId = await prompt("Apple ID email: ");
const password = await prompt("Password (will be visible): ");

console.log("\nLaunching headless browser...");

const browser = await puppeteer.launch({
  headless: true,
  timeout: 0,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ],
});

const page = (await browser.pages())[0] ?? (await browser.newPage());

await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

// Intercept accountLogin to force extended_login (longer-lived token)
await page.setRequestInterception(true);
page.on("request", async (request) => {
  if (request.isInterceptResolutionHandled()) return;
  if (request.url().includes("/accountLogin")) {
    console.log("  → Intercepted accountLogin, setting extended_login=true");
    const bodyRaw = await request.fetchPostData();
    if (bodyRaw) {
      try {
        const bodyJson = JSON.parse(bodyRaw);
        request.continue({ postData: JSON.stringify({ ...bodyJson, extended_login: true }) });
        return;
      } catch {}
    }
  }
  request.continue();
});

console.log("Navigating to iCloud...");
await page.goto("https://www.icloud.com", { waitUntil: "networkidle2" });

// Click the sign-in button on the iCloud landing page
console.log("Clicking sign-in button...");
const signInButton = await page.waitForSelector(".sign-in-button", { timeout: 15000 });
if (!signInButton) throw new Error("Could not find sign-in button on iCloud page");
await signInButton.click();

// Apple auth loads in an iframe — wait for it
console.log("Waiting for Apple auth frame...");
await sleep(6000);
await page.screenshot({ path: "/tmp/icloud-debug-01-after-signin-click.png" });
console.log("  [debug] screenshot: /tmp/icloud-debug-01-after-signin-click.png");
console.log("  [debug] frames:", page.frames().map(f => f.url()).join(" | "));

// Find the auth iframe (Apple uses an iframe from idmsa.apple.com)
const getAuthFrame = async () => {
  for (const frame of page.frames()) {
    if (frame.url().includes("idmsa.apple.com") || frame.url().includes("appleid")) {
      return frame;
    }
  }
  return null;
};

// Try direct page selectors first (sometimes auth is inline), then iframe
let authFrame: any = await getAuthFrame();
console.log("  [debug] authFrame:", authFrame ? authFrame.url() : "none (using page directly)");

// Fill Apple ID — password field is hidden (tabindex=-1) until Apple ID is submitted
console.log("Entering Apple ID...");
for (let attempt = 0; attempt < 20; attempt++) {
  authFrame = await getAuthFrame();
  const target = authFrame ?? page;
  const input = await target.$("#account_name_text_field");
  if (input) {
    await input.click({ clickCount: 3 });
    await input.type(appleId, { delay: 50 });
    console.log("  [debug] Apple ID filled, pressing Enter");
    await input.press("Enter");
    break;
  }
  await sleep(500);
  if (attempt === 19) {
    await page.screenshot({ path: "/tmp/icloud-debug-02-no-appleid-input.png" });
    const frameUrls = page.frames().map(f => f.url());
    console.log("  [debug] frames at failure:", frameUrls);
    throw new Error("Could not find Apple ID input field — see /tmp/icloud-debug-02-no-appleid-input.png");
  }
}

await sleep(3000);
await page.screenshot({ path: "/tmp/icloud-debug-03-after-appleid.png" });
console.log("  [debug] screenshot: /tmp/icloud-debug-03-after-appleid.png");

// Wait for password field to become accessible (tabindex=-1 → 0 after Apple validates Apple ID)
console.log("Entering password...");
for (let attempt = 0; attempt < 30; attempt++) {
  authFrame = await getAuthFrame();
  const target = authFrame ?? page;
  const pwInput = await target.$("#password_text_field");
  if (pwInput) {
    const tabIndex = await pwInput.evaluate((el: Element) => el.getAttribute("tabindex"));
    console.log("  [debug] password field tabindex:", tabIndex, "attempt:", attempt);
    if (tabIndex !== "-1") {
      await pwInput.click({ clickCount: 3 });
      await pwInput.type(password, { delay: 50 });
      console.log("  [debug] password filled, pressing Enter");
      await pwInput.press("Enter");
      break;
    }
  }
  await sleep(500);
  if (attempt === 29) {
    await page.screenshot({ path: "/tmp/icloud-debug-04-no-password-input.png" });
    throw new Error("Password field never became accessible — see /tmp/icloud-debug-04-no-password-input.png");
  }
}

await sleep(5000);
await page.screenshot({ path: "/tmp/icloud-debug-05-after-password.png" });
console.log("  [debug] screenshot: /tmp/icloud-debug-05-after-password.png");

// Handle 2FA — Apple shows 6 individual digit boxes
console.log("Checking for 2FA...");
for (let attempt = 0; attempt < 20; attempt++) {
  authFrame = await getAuthFrame();
  const target = authFrame ?? page;

  // Apple's 2FA uses individual digit inputs — type into the first one and digits flow automatically
  const digitInput = await target.$("input[name='code'], input[data-mode='number'], input.digit-input, input[inputmode='numeric'], input[autocomplete='one-time-code'], input[type='number'], input[type='tel']");
  if (digitInput) {
    await page.screenshot({ path: "/tmp/icloud-debug-07-2fa-screen.png" });
    console.log("  [debug] 2FA input found, screenshot: /tmp/icloud-debug-07-2fa-screen.png");
    rl.resume();
    const code = await prompt("\n2FA code (from your iPhone): ");
    console.log("  Submitting 2FA code...");
    // Re-query the input in case the element reference went stale during prompt
    authFrame = await getAuthFrame();
    const freshTarget = authFrame ?? page;
    const freshInput = await freshTarget.$("input[name='code'], input[data-mode='number'], input.digit-input, input[inputmode='numeric'], input[autocomplete='one-time-code'], input[type='number'], input[type='tel']") ?? digitInput;
    await freshInput.click();
    await freshInput.type(code, { delay: 200 });
    await sleep(1000);
    await freshInput.press("Enter");
    console.log("  2FA submitted, waiting for Apple to verify...");
    await sleep(3000);
    // Handle "Trust this browser?" prompt
    await page.screenshot({ path: "/tmp/icloud-debug-08-after-2fa.png" });
    const trustTarget = authFrame ?? page;
    const trustBtn = await trustTarget.$("button#trust-browser, button[name='trust'], button[data-mode='trust']")
      || await trustTarget.$x?.("//button[contains(text(),'Trust')]")?.then((r: any[]) => r[0])
      || null;
    if (trustBtn) {
      console.log("  Clicking Trust button...");
      await (trustBtn as any).click();
    } else {
      // Try by text content via evaluate
      const clicked = await trustTarget.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const tb = btns.find(b => b.textContent?.trim() === "Trust");
        if (tb) { tb.click(); return true; }
        return false;
      });
      if (clicked) console.log("  Clicked Trust button via evaluate.");
      else console.log("  [warn] Trust button not found — may proceed anyway.");
    }
    await sleep(2000);
    break;
  }
  await sleep(1000);
  if (attempt === 19) {
    await page.screenshot({ path: "/tmp/icloud-debug-07-2fa-not-found.png" });
    console.log("  [debug] WARNING: 2FA input not found after 20s — screenshot: /tmp/icloud-debug-07-2fa-not-found.png");
  }
}

// Poll page.cookies() until the trust cookie appears — Apple sets it via response header
console.log("Waiting for authentication to complete...");
let configTrustToken: string | undefined;
let configCookies: string | undefined;

for (let attempt = 0; attempt < 60; attempt++) {
  await sleep(2000);
  const cookies = await page.cookies("https://www.icloud.com", "https://idmsa.apple.com", "https://apple.com");
  const trustCookie = cookies.find((c) => c.name === "X-APPLE-WEBAUTH-HSA-TRUST");
  if (trustCookie) {
    configTrustToken = trustCookie.value;
    configCookies = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    console.log("✓ Trust cookie found.");
    break;
  }
  if (attempt % 5 === 0) console.log(`  [debug] waiting... (${attempt * 2}s, ${cookies.length} cookies so far)`);
  if (attempt === 59) {
    await page.screenshot({ path: "/tmp/icloud-debug-08-timeout.png" });
    throw new Error("Timed out waiting for trust cookie — see /tmp/icloud-debug-08-timeout.png");
  }
}

await browser.close();
rl.close();

// Update rclone.conf
const rcloneConf = `${os.homedir()}/.config/rclone/rclone.conf`;
if (fs.existsSync(rcloneConf)) {
  let conf = fs.readFileSync(rcloneConf, "utf8");
  const cookiesLine = `cookies = ${configCookies}`;
  const trustLine = `trust_token = ${configTrustToken}`;

  if (conf.includes("cookies =")) {
    conf = conf.replace(/cookies = .*/g, cookiesLine);
  } else {
    conf = conf.replace(/(\[iclouddrive\][^\[]*)/s, `$1${cookiesLine}\n`);
  }
  if (conf.includes("trust_token =")) {
    conf = conf.replace(/trust_token = .*/g, trustLine);
  } else {
    conf = conf.replace(/(\[iclouddrive\][^\[]*)/s, `$1${trustLine}\n`);
  }

  fs.writeFileSync(rcloneConf, conf, { mode: 0o600 });
  console.log("\n✓ rclone.conf updated successfully.\n");

  try {
    const result = execSync("rclone lsd iclouddrive:", { encoding: "utf8" });
    console.log("✓ Connection test passed:\n" + result);
  } catch (e) {
    console.log("✗ Connection test failed — check rclone.conf manually.");
  }
} else {
  console.log("\nrclone.conf not found. Run these commands manually:");
  console.log(`rclone config update iclouddrive cookies='${configCookies}' trust_token='${configTrustToken}'`);
}
