import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { formatCookiesArray } from "../core/cookies.js";
import type { AuthFlowDriver } from "../core/auth-flow.js";
import type { AuthResult } from "../core/orchestrator.js";

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

export class BrowserDriver implements AuthFlowDriver {
  private browser: any = null;
  private page: any = null;

  constructor(private readonly debugEnabled: boolean) {}

  async launch(): Promise<void> {
    this.browser = await puppeteer.launch({
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

    this.page = (await this.browser.pages())[0] ?? (await this.browser.newPage());
    await this.page.setUserAgent(STEALTH_USER_AGENT);

    await this.page.setRequestInterception(true);
    this.page.on("request", async (request: any) => {
      if (request.isInterceptResolutionHandled()) return;
      if (request.url().includes(ACCOUNT_LOGIN_PATH)) {
        const rawPostBody = await request.fetchPostData();
        if (rawPostBody) {
          try {
            const parsedBody = JSON.parse(rawPostBody);
            request.continue({ postData: JSON.stringify({ ...parsedBody, extended_login: true }) });
            return;
          } catch {}
        }
      }
      request.continue();
    });
  }

  async navigateToSignIn(): Promise<void> {
    await this.page.goto(ICLOUD_URL, { waitUntil: "networkidle2" });

    const signInButton = await this.page.waitForSelector(SIGN_IN_BUTTON_SELECTOR, {
      timeout: SIGN_IN_BUTTON_TIMEOUT_MS,
    });
    if (!signInButton) throw new Error("Could not find sign-in button on iCloud page");
    await signInButton.click();

    await sleep(AUTH_FRAME_WAIT_MS);
    this.captureDebugScreenshot("/tmp/icloud-debug-01-after-signin-click.png");
  }

  async enterAppleId(appleId: string): Promise<void> {
    await this.fillFieldWithPolling(
      APPLE_ID_POLL_ATTEMPTS,
      POLL_INTERVAL_MS,
      APPLE_ID_FIELD_SELECTOR,
      async (input: any) => {
        await input.click({ clickCount: 3 });
        await input.type(appleId, { delay: TYPE_DELAY_MS });
        await input.press("Enter");
      },
      "/tmp/icloud-debug-02-no-appleid-input.png",
      "Could not find Apple ID input field"
    );

    await sleep(POST_APPLE_ID_WAIT_MS);
    this.captureDebugScreenshot("/tmp/icloud-debug-03-after-appleid.png");
  }

  async enterPassword(password: string): Promise<void> {
    await this.fillPasswordWithTabindexPolling(password, "/tmp/icloud-debug-04-no-password-input.png");

    await sleep(POST_PASSWORD_WAIT_MS);
    this.captureDebugScreenshot("/tmp/icloud-debug-05-after-password.png");
  }

  async checkTwoFactor(): Promise<{ twoFactorRequired: boolean }> {
    for (let attempt = 0; attempt < TWO_FA_POLL_ATTEMPTS; attempt++) {
      const authFrame = await this.findAuthFrame();
      const target = authFrame ?? this.page;
      const digitInput = await target.$(TWO_FA_INPUT_SELECTOR);

      if (digitInput) {
        this.captureDebugScreenshot("/tmp/icloud-debug-07-2fa-screen.png");
        return { twoFactorRequired: true };
      }

      await sleep(1000);
    }

    this.captureDebugScreenshot("/tmp/icloud-debug-07-2fa-not-found.png");
    return { twoFactorRequired: false };
  }

  async submitTwoFactorCode(code: string): Promise<void> {
    const authFrame = await this.findAuthFrame();
    const target = authFrame ?? this.page;
    const digitInput = await target.$(TWO_FA_INPUT_SELECTOR);

    const freshAuthFrame = await this.findAuthFrame();
    const freshTarget = freshAuthFrame ?? this.page;
    const freshInput = (await freshTarget.$(TWO_FA_INPUT_SELECTOR)) ?? digitInput;

    await freshInput.click();
    await freshInput.type(code, { delay: TWO_FA_TYPE_DELAY_MS });
    await sleep(1000);
    await freshInput.press("Enter");

    await sleep(POST_2FA_WAIT_MS);
    this.captureDebugScreenshot("/tmp/icloud-debug-08-after-2fa.png");

    await this.clickTrustButtonIfPresent(freshAuthFrame);
    await sleep(POST_TRUST_WAIT_MS);
  }

  async waitForResult(): Promise<AuthResult> {
    for (let attempt = 0; attempt < TRUST_COOKIE_POLL_ATTEMPTS; attempt++) {
      await sleep(TRUST_COOKIE_POLL_INTERVAL_MS);

      const cookies = await this.page.cookies(
        "https://www.icloud.com",
        "https://idmsa.apple.com",
        "https://apple.com"
      );
      const trustCookie = cookies.find((c: any) => c.name === TRUST_COOKIE_NAME);

      if (trustCookie) {
        return {
          trustToken: trustCookie.value,
          cookies: formatCookiesArray(cookies.map((c: any) => `${c.name}=${c.value}`)),
        };
      }
    }

    await this.page.screenshot({ path: "/tmp/icloud-debug-timeout.png" });
    throw new Error("Timed out waiting for trust cookie — see /tmp/icloud-debug-timeout.png");
  }

  async close(): Promise<void> {
    await this.browser.close();
  }

  private async findAuthFrame(): Promise<any> {
    for (const frame of this.page.frames()) {
      const frameUrl = frame.url();
      if (AUTH_FRAME_URL_FRAGMENTS.some((fragment) => frameUrl.includes(fragment))) {
        return frame;
      }
    }
    return null;
  }

  private async fillFieldWithPolling(
    maxAttempts: number,
    intervalMs: number,
    selector: string,
    fillAction: (input: any) => Promise<void>,
    debugScreenshotPath: string,
    errorMessage: string
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const authFrame = await this.findAuthFrame();
      const target = authFrame ?? this.page;
      const input = await target.$(selector);

      if (input) {
        await fillAction(input);
        return;
      }

      await sleep(intervalMs);

      if (attempt === maxAttempts - 1) {
        await this.page.screenshot({ path: debugScreenshotPath });
        throw new Error(`${errorMessage} — see ${debugScreenshotPath}`);
      }
    }
  }

  private async fillPasswordWithTabindexPolling(password: string, debugScreenshotPath: string): Promise<void> {
    for (let attempt = 0; attempt < PASSWORD_POLL_ATTEMPTS; attempt++) {
      const authFrame = await this.findAuthFrame();
      const target = authFrame ?? this.page;
      const passwordInput = await target.$(PASSWORD_FIELD_SELECTOR);

      if (passwordInput) {
        const tabIndex = await passwordInput.evaluate((el: Element) => el.getAttribute("tabindex"));
        if (tabIndex !== "-1") {
          await passwordInput.click({ clickCount: 3 });
          await passwordInput.type(password, { delay: TYPE_DELAY_MS });
          await passwordInput.press("Enter");
          return;
        }
      }

      await sleep(POLL_INTERVAL_MS);

      if (attempt === PASSWORD_POLL_ATTEMPTS - 1) {
        await this.page.screenshot({ path: debugScreenshotPath });
        throw new Error(`Password field never became accessible — see ${debugScreenshotPath}`);
      }
    }
  }

  private async clickTrustButtonIfPresent(authFrame: any): Promise<void> {
    const target = authFrame ?? this.page;
    const trustButton = await target.$(TRUST_BUTTON_SELECTOR);

    if (trustButton) {
      await trustButton.click();
      return;
    }

    await target.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const trust = buttons.find((b) => b.textContent?.trim() === "Trust");
      if (trust) trust.click();
    });
  }

  private captureDebugScreenshot(path: string): void {
    if (!this.debugEnabled) return;
    this.page.screenshot({ path }).catch(() => {});
  }
}
