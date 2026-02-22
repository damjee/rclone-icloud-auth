import puppeteer from "puppeteer";
import { parseCookieHeader, extractTrustToken, formatCookiesArray } from "../core/cookies.js";
import type { AuthAdapter, AuthResult } from "../core/orchestrator.js";

const ICLOUD_URL = "https://www.icloud.com";
const ACCOUNT_LOGIN_PATH = "/accountLogin";
const SIGN_IN_BUTTON_SELECTOR = ".sign-in-button";
const TRUST_COOKIE_NAME = "X-APPLE-WEBAUTH-HSA-TRUST";

export class GuiBrowserAdapter implements AuthAdapter {
  async authenticate(): Promise<AuthResult> {
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      timeout: 0,
    });

    const page = (await browser.pages())[0] ?? (await browser.newPage());

    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      if (request.isInterceptResolutionHandled()) return;
      if (request.url().includes(ACCOUNT_LOGIN_PATH)) {
        const rawPostBody = await request.fetchPostData();
        if (!rawPostBody) {
          request.continue();
          return;
        }
        const parsedBody = JSON.parse(rawPostBody);
        request.continue({
          postData: JSON.stringify({ ...parsedBody, extended_login: true }),
        });
        return;
      }
      request.continue();
    });

    await page.bringToFront();
    console.log("Navigating to iCloud...");
    await page.goto(ICLOUD_URL);
    console.log("Please log in via the browser window");

    const signInButton = await page.waitForSelector(SIGN_IN_BUTTON_SELECTOR);
    if (!signInButton) throw new Error("Could not find sign-in button on iCloud page");
    await signInButton.click();

    console.log("Waiting for trust cookie...");
    let trustToken: string | undefined;
    let cookiesHeader: string | undefined;

    await page.waitForRequest(
      (request) => {
        const rawCookieHeader = request.headers()["cookie"];
        if (!rawCookieHeader) return false;

        const cookies = parseCookieHeader(rawCookieHeader);
        trustToken = extractTrustToken(cookies);
        if (!trustToken) return false;

        cookiesHeader = formatCookiesArray(cookies);
        return true;
      },
      { timeout: 0 }
    );

    await browser.close();

    return {
      trustToken: trustToken!,
      cookies: cookiesHeader!,
    };
  }
}
