import { describe, it, expect } from "vitest";
import { runHeadlessAuthFlow } from "../../src/core/headless-flow.js";
import type { BrowserFlowDriver } from "../../src/core/headless-flow.js";
import type { AuthResult } from "../../src/core/orchestrator.js";

const FAKE_AUTH_RESULT: AuthResult = {
  trustToken: "fake-trust-token",
  cookies: "SESSION=abc; X-APPLE-WEBAUTH-HSA-TRUST=fake-trust-token",
};

const FAKE_CREDENTIALS = { appleId: "test@example.com", password: "password123" };
const FAKE_2FA_CODE = "123456";

class FakeBrowserFlowDriver implements BrowserFlowDriver {
  readonly stepsCalledInOrder: string[] = [];
  twoFactorCodeReceived: string | null = null;

  constructor(
    private readonly twoFactorRequired: boolean = false,
    private readonly authResult: AuthResult = FAKE_AUTH_RESULT,
    private readonly failOn: keyof BrowserFlowDriver | null = null
  ) {}

  private recordAndMaybeThrow(stepName: keyof BrowserFlowDriver): void {
    this.stepsCalledInOrder.push(stepName);
    if (this.failOn === stepName) {
      throw new Error(`Driver failed on ${stepName}`);
    }
  }

  async navigateToSignInPage(): Promise<void> {
    this.recordAndMaybeThrow("navigateToSignInPage");
  }

  async fillAppleIdField(appleId: string): Promise<void> {
    this.recordAndMaybeThrow("fillAppleIdField");
  }

  async waitForPasswordFieldAndFill(password: string): Promise<void> {
    this.recordAndMaybeThrow("waitForPasswordFieldAndFill");
  }

  async isTwoFactorRequired(): Promise<boolean> {
    this.recordAndMaybeThrow("isTwoFactorRequired");
    return this.twoFactorRequired;
  }

  async fillTwoFactorCode(code: string): Promise<void> {
    this.recordAndMaybeThrow("fillTwoFactorCode");
    this.twoFactorCodeReceived = code;
  }

  async clickTrustButtonIfPresent(): Promise<void> {
    this.recordAndMaybeThrow("clickTrustButtonIfPresent");
  }

  async collectAuthResult(): Promise<AuthResult> {
    this.recordAndMaybeThrow("collectAuthResult");
    return this.authResult;
  }
}

describe("runHeadlessAuthFlow", () => {
  it("returns the AuthResult from the driver when 2FA is not required", async () => {
    const driver = new FakeBrowserFlowDriver(false);

    const result = await runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(result).toEqual(FAKE_AUTH_RESULT);
  });

  it("calls driver steps in the correct order when 2FA is not required", async () => {
    const driver = new FakeBrowserFlowDriver(false);

    await runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.stepsCalledInOrder).toEqual([
      "navigateToSignInPage",
      "fillAppleIdField",
      "waitForPasswordFieldAndFill",
      "isTwoFactorRequired",
      "clickTrustButtonIfPresent",
      "collectAuthResult",
    ]);
  });

  it("does not call fillTwoFactorCode when 2FA is not required", async () => {
    const driver = new FakeBrowserFlowDriver(false);

    await runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.stepsCalledInOrder).not.toContain("fillTwoFactorCode");
  });

  it("does not call the promptTwoFactorCode callback when 2FA is not required", async () => {
    const driver = new FakeBrowserFlowDriver(false);
    let promptCalled = false;

    await runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => {
      promptCalled = true;
      return FAKE_2FA_CODE;
    });

    expect(promptCalled).toBe(false);
  });

  it("calls fillTwoFactorCode with the code from the prompt when 2FA is required", async () => {
    const driver = new FakeBrowserFlowDriver(true);

    await runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.twoFactorCodeReceived).toBe(FAKE_2FA_CODE);
  });

  it("calls driver steps in the correct order when 2FA is required", async () => {
    const driver = new FakeBrowserFlowDriver(true);

    await runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.stepsCalledInOrder).toEqual([
      "navigateToSignInPage",
      "fillAppleIdField",
      "waitForPasswordFieldAndFill",
      "isTwoFactorRequired",
      "fillTwoFactorCode",
      "clickTrustButtonIfPresent",
      "collectAuthResult",
    ]);
  });

  it("propagates errors thrown by fillAppleIdField", async () => {
    const driver = new FakeBrowserFlowDriver(false, FAKE_AUTH_RESULT, "fillAppleIdField");

    await expect(
      runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => FAKE_2FA_CODE)
    ).rejects.toThrow("Driver failed on fillAppleIdField");
  });

  it("propagates errors thrown by waitForPasswordFieldAndFill", async () => {
    const driver = new FakeBrowserFlowDriver(false, FAKE_AUTH_RESULT, "waitForPasswordFieldAndFill");

    await expect(
      runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => FAKE_2FA_CODE)
    ).rejects.toThrow("Driver failed on waitForPasswordFieldAndFill");
  });

  it("propagates errors thrown by collectAuthResult", async () => {
    const driver = new FakeBrowserFlowDriver(false, FAKE_AUTH_RESULT, "collectAuthResult");

    await expect(
      runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => FAKE_2FA_CODE)
    ).rejects.toThrow("Driver failed on collectAuthResult");
  });

  it("passes the Apple ID from credentials to the driver", async () => {
    let receivedAppleId: string | null = null;
    const driver = new FakeBrowserFlowDriver(false);
    driver.fillAppleIdField = async (appleId: string) => {
      receivedAppleId = appleId;
    };

    await runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(receivedAppleId).toBe(FAKE_CREDENTIALS.appleId);
  });

  it("passes the password from credentials to the driver", async () => {
    let receivedPassword: string | null = null;
    const driver = new FakeBrowserFlowDriver(false);
    driver.waitForPasswordFieldAndFill = async (password: string) => {
      receivedPassword = password;
    };

    await runHeadlessAuthFlow(driver, FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(receivedPassword).toBe(FAKE_CREDENTIALS.password);
  });
});
