import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { formatCookiesArray } from "../core/cookies.js";
import { promptUser, resumePrompt, closePrompt } from "./prompt.js";
import type { AuthAdapter, AuthResult } from "../core/orchestrator.js";

puppeteer.use(StealthPlugin());

const ICLOUD_URL = "https://www.icloud.com";
const ACCOUNT_LOGIN_PATH = "/accountLogin";
const SIGN_IN_BUTTON_SELECTOR = ".sign-in-button";
const APPLE_ID_FIELD_SELECTOR = "#account_name_text_field";
const PASSWORD_FIELD_SELECTOR = "#password_text_field";
const TWO_FA_INPUT_SELECTOR = "input[name='code'], input[data-mode='number'], input.digit-input, input[inputmode='numeric'], input[autocomplete='one-time-code'], input[type='number'], input[type='tel']";
const TRUST_BUTTON_SELECTOR = "button#trust-browser, button[name='trust'], button[data-mode='trust']";
const TRUST_COOKIE_NAME = "X-APPLE-WEBAUTH-HSA-TRUST";
const AUTH_FRAME_URL_FRAGMENTS = ["idmsa.apple.com", "appleid"];
const STEALTH_USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SIGN_IN_BUTTON_TIMEOUT_MS = 15000;
const AUTH_FRAME_WAIT_MS = 6000;
const POST_APPLE_ID_WAIT_MS = 3000;
const POST_PASSWORD_WAIT_MS = 5000;
const POST_2FA_WAIT_MS = 3000;
const POST_TRUST_WAIT_MS = 2000;
const POLL_INTERVAL_MS = 500;
const PASSWORD_POLL_ATTEMPTS = 30;
const APPLE_ID_POLL_ATTEMPTS = 20;
const TWO_FA_POLL_ATTEMPTS = 20;
const TRUST_COOKIE_POLL_ATTEMPTS = 60;
const TRUST_COOKIE_POLL_INTERVAL_MS = 2000;
const TYPE_DELAY_MS = 50;
const TWO_FA_TYPE_DELAY_MS = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HeadlessBrowserAdapter implements AuthAdapter {
  private readonly debugEnabled: boolean;

  constructor(debugEnabled: boolean) {
    this.debugEnabled = debugEnabled;
  }

  async authenticate(): Promise<AuthResult> {
    console.log("=== rclone iCloud Headless Authenticator ===\n");

    const appleId = await promptUser("Apple ID email: ");
    const password = await promptUser("Password (will be visible): ");

    console.log("\nLaunching headless browser...");

    const browser = await puppeteer.launch({
      headless: true,
      timeout: 0,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        `--user-agent=${STEALTH_USER_AGENT}`,
      ],
    });

    const page = (await browser.pages())[0] ?? (await browser.newPage());
    await page.setUserAgent(STEALTH_USER_AGENT);

    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      if (request.isInterceptResolutionHandled()) return;
      if (request.url().includes(ACCOUNT_LOGIN_PATH)) {
        const rawPostBody = await request.fetchPostData();
        if (rawPostBody) {
          try {
            const parsedBody = JSON.parse(rawPostBody);
            request.continue({
              postData: JSON.stringify({ ...parsedBody, extended_login: true }),
            });
            return;
          } catch {}
        }
      }
      request.continue();
    });

    console.log("Navigating to iCloud...");
    await page.goto(ICLOUD_URL, { waitUntil: "networkidle2" });

    console.log("Clicking sign-in button...");
    const signInButton = await page.waitForSelector(SIGN_IN_BUTTON_SELECTOR, {
      timeout: SIGN_IN_BUTTON_TIMEOUT_MS,
    });
    if (!signInButton) throw new Error("Could not find sign-in button on iCloud page");
    await signInButton.click();

    console.log("Waiting for Apple auth frame...");
    await sleep(AUTH_FRAME_WAIT_MS);
    this.captureDebugScreenshot(page, "/tmp/icloud-debug-01-after-signin-click.png");

    const findAuthFrame = async () => {
      for (const frame of page.frames()) {
        const frameUrl = frame.url();
        if (AUTH_FRAME_URL_FRAGMENTS.some((fragment) => frameUrl.includes(fragment))) {
          return frame;
        }
      }
      return null;
    };

    console.log("Entering Apple ID...");
    await this.fillFieldWithPolling(
      APPLE_ID_POLL_ATTEMPTS,
      POLL_INTERVAL_MS,
      findAuthFrame,
      page,
      APPLE_ID_FIELD_SELECTOR,
      async (input, target) => {
        await input.click({ clickCount: 3 });
        await input.type(appleId, { delay: TYPE_DELAY_MS });
        await input.press("Enter");
      },
      "/tmp/icloud-debug-02-no-appleid-input.png",
      "Could not find Apple ID input field"
    );

    await sleep(POST_APPLE_ID_WAIT_MS);
    this.captureDebugScreenshot(page, "/tmp/icloud-debug-03-after-appleid.png");

    console.log("Entering password...");
    await this.fillPasswordWithTabindexPolling(
      PASSWORD_POLL_ATTEMPTS,
      POLL_INTERVAL_MS,
      findAuthFrame,
      page,
      password,
      "/tmp/icloud-debug-04-no-password-input.png"
    );

    await sleep(POST_PASSWORD_WAIT_MS);
    this.captureDebugScreenshot(page, "/tmp/icloud-debug-05-after-password.png");

    console.log("Checking for 2FA...");
    await this.handle2FA(findAuthFrame, page);

    console.log("Waiting for authentication to complete...");
    const authResult = await this.pollForTrustCookie(page);

    await browser.close();
    closePrompt();

    return authResult;
  }

  private async fillFieldWithPolling(
    maxAttempts: number,
    intervalMs: number,
    findAuthFrame: () => Promise<any>,
    page: any,
    selector: string,
    fillAction: (input: any, target: any) => Promise<void>,
    debugScreenshotPath: string,
    errorMessage: string
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const authFrame = await findAuthFrame();
      const target = authFrame ?? page;
      const input = await target.$(selector);

      if (input) {
        await fillAction(input, target);
        return;
      }

      await sleep(intervalMs);

      if (attempt === maxAttempts - 1) {
        await page.screenshot({ path: debugScreenshotPath });
        throw new Error(`${errorMessage} — see ${debugScreenshotPath}`);
      }
    }
  }

  private async fillPasswordWithTabindexPolling(
    maxAttempts: number,
    intervalMs: number,
    findAuthFrame: () => Promise<any>,
    page: any,
    password: string,
    debugScreenshotPath: string
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const authFrame = await findAuthFrame();
      const target = authFrame ?? page;
      const passwordInput = await target.$(PASSWORD_FIELD_SELECTOR);

      if (passwordInput) {
        const tabIndex = await passwordInput.evaluate((el: Element) =>
          el.getAttribute("tabindex")
        );
        if (tabIndex !== "-1") {
          await passwordInput.click({ clickCount: 3 });
          await passwordInput.type(password, { delay: TYPE_DELAY_MS });
          await passwordInput.press("Enter");
          return;
        }
      }

      await sleep(intervalMs);

      if (attempt === maxAttempts - 1) {
        await page.screenshot({ path: debugScreenshotPath });
        throw new Error(
          `Password field never became accessible — see ${debugScreenshotPath}`
        );
      }
    }
  }

  private async handle2FA(findAuthFrame: () => Promise<any>, page: any): Promise<void> {
    for (let attempt = 0; attempt < TWO_FA_POLL_ATTEMPTS; attempt++) {
      const authFrame = await findAuthFrame();
      const target = authFrame ?? page;
      const digitInput = await target.$(TWO_FA_INPUT_SELECTOR);

      if (digitInput) {
        this.captureDebugScreenshot(page, "/tmp/icloud-debug-07-2fa-screen.png");
        resumePrompt();
        const code = await promptUser("\n2FA code (from your iPhone): ");

        const freshAuthFrame = await findAuthFrame();
        const freshTarget = freshAuthFrame ?? page;
        const freshInput = (await freshTarget.$(TWO_FA_INPUT_SELECTOR)) ?? digitInput;

        await freshInput.click();
        await freshInput.type(code, { delay: TWO_FA_TYPE_DELAY_MS });
        await sleep(1000);
        await freshInput.press("Enter");

        console.log("  2FA submitted, waiting for Apple to verify...");
        await sleep(POST_2FA_WAIT_MS);
        this.captureDebugScreenshot(page, "/tmp/icloud-debug-08-after-2fa.png");

        await this.clickTrustButtonIfPresent(freshAuthFrame, page);
        await sleep(POST_TRUST_WAIT_MS);
        return;
      }

      await sleep(1000);

      if (attempt === TWO_FA_POLL_ATTEMPTS - 1) {
        this.captureDebugScreenshot(page, "/tmp/icloud-debug-07-2fa-not-found.png");
        console.log("  WARNING: 2FA input not found — proceeding anyway.");
      }
    }
  }

  private async clickTrustButtonIfPresent(authFrame: any, page: any): Promise<void> {
    const target = authFrame ?? page;

    const trustButton = await target.$(TRUST_BUTTON_SELECTOR);
    if (trustButton) {
      console.log("  Clicking Trust button...");
      await trustButton.click();
      return;
    }

    const clicked = await target.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const trustButton = buttons.find((b) => b.textContent?.trim() === "Trust");
      if (trustButton) {
        trustButton.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log("  Clicked Trust button.");
    } else {
      console.log("  Trust button not found — may proceed anyway.");
    }
  }

  private async pollForTrustCookie(page: any): Promise<AuthResult> {
    for (let attempt = 0; attempt < TRUST_COOKIE_POLL_ATTEMPTS; attempt++) {
      await sleep(TRUST_COOKIE_POLL_INTERVAL_MS);

      const cookies = await page.cookies(
        "https://www.icloud.com",
        "https://idmsa.apple.com",
        "https://apple.com"
      );
      const trustCookie = cookies.find((c: any) => c.name === TRUST_COOKIE_NAME);

      if (trustCookie) {
        console.log("✓ Trust cookie found.");
        return {
          trustToken: trustCookie.value,
          cookies: formatCookiesArray(cookies.map((c: any) => `${c.name}=${c.value}`)),
        };
      }

      if (attempt % 5 === 0) {
        console.log(`  Waiting... (${attempt * 2}s elapsed, ${cookies.length} cookies so far)`);
      }
    }

    await page.screenshot({ path: "/tmp/icloud-debug-08-timeout.png" });
    throw new Error("Timed out waiting for trust cookie — see /tmp/icloud-debug-08-timeout.png");
  }

  private captureDebugScreenshot(page: any, path: string): void {
    if (!this.debugEnabled) return;
    page.screenshot({ path }).catch(() => {});
    console.log(`  [debug] screenshot: ${path}`);
  }
}
