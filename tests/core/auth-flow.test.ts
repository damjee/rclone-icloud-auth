import { describe, it, expect } from "vitest";
import { runAuthFlow } from "../../src/core/auth-flow.js";
import { Messages } from "../../src/core/messages.js";
import type { AuthFlowDriver } from "../../src/core/auth-flow.js";
import type { AuthResult } from "../../src/core/orchestrator.js";

const FAKE_AUTH_RESULT: AuthResult = {
  trustToken: "fake-trust-token",
  cookies: "SESSION=abc; X-APPLE-WEBAUTH-HSA-TRUST=fake-trust-token",
};

const FAKE_CREDENTIALS = { appleId: "test@example.com", password: "password123" };
const FAKE_2FA_CODE = "123456";

type FailableMethod = "launch" | "navigateToSignIn" | "enterAppleId" | "enterPassword" |
  "checkTwoFactor" | "submitTwoFactorCode" | "waitForResult" | "close";

class FakeAuthFlowDriver implements AuthFlowDriver {
  appleIdReceived: string | null = null;
  passwordReceived: string | null = null;
  twoFactorCodeReceived: string | null = null;
  submitTwoFactorCodeCalled = false;
  closeCalled = false;

  constructor(
    private readonly twoFactorRequired: boolean = false,
    private readonly authResult: AuthResult = FAKE_AUTH_RESULT,
    private readonly failOn: FailableMethod | null = null
  ) {}

  async launch(): Promise<void> {
    if (this.failOn === "launch") throw new Error("Driver failed on launch");
  }

  async navigateToSignIn(): Promise<void> {
    if (this.failOn === "navigateToSignIn") throw new Error("Driver failed on navigateToSignIn");
  }

  async enterAppleId(appleId: string): Promise<void> {
    this.appleIdReceived = appleId;
    if (this.failOn === "enterAppleId") throw new Error("Driver failed on enterAppleId");
  }

  async enterPassword(password: string): Promise<void> {
    this.passwordReceived = password;
    if (this.failOn === "enterPassword") throw new Error("Driver failed on enterPassword");
  }

  async checkTwoFactor(): Promise<{ twoFactorRequired: boolean }> {
    if (this.failOn === "checkTwoFactor") throw new Error("Driver failed on checkTwoFactor");
    return { twoFactorRequired: this.twoFactorRequired };
  }

  async submitTwoFactorCode(code: string): Promise<void> {
    this.submitTwoFactorCodeCalled = true;
    this.twoFactorCodeReceived = code;
    if (this.failOn === "submitTwoFactorCode") throw new Error("Driver failed on submitTwoFactorCode");
  }

  async waitForResult(): Promise<AuthResult> {
    if (this.failOn === "waitForResult") throw new Error("Driver failed on waitForResult");
    return this.authResult;
  }

  async close(): Promise<void> {
    this.closeCalled = true;
    if (this.failOn === "close") throw new Error("Driver failed on close");
  }
}

describe("runAuthFlow", () => {
  it("returns AuthResult from waitForResult when 2FA is not required", async () => {
    const driver = new FakeAuthFlowDriver(false);

    const result = await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(result).toEqual(FAKE_AUTH_RESULT);
  });

  it("passes appleId from promptCredentials to enterAppleId", async () => {
    const driver = new FakeAuthFlowDriver(false);

    await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.appleIdReceived).toBe(FAKE_CREDENTIALS.appleId);
  });

  it("passes password from promptCredentials to enterPassword", async () => {
    const driver = new FakeAuthFlowDriver(false);

    await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.passwordReceived).toBe(FAKE_CREDENTIALS.password);
  });

  it("calls close after waitForResult", async () => {
    const driver = new FakeAuthFlowDriver(false);

    await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.closeCalled).toBe(true);
  });

  it("does not call promptTwoFactorCode when 2FA is not required", async () => {
    const driver = new FakeAuthFlowDriver(false);
    let promptCalled = false;

    await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => {
      promptCalled = true;
      return FAKE_2FA_CODE;
    });

    expect(promptCalled).toBe(false);
  });

  it("does not call submitTwoFactorCode when 2FA is not required", async () => {
    const driver = new FakeAuthFlowDriver(false);

    await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.submitTwoFactorCodeCalled).toBe(false);
  });

  it("calls submitTwoFactorCode with code from promptTwoFactorCode when 2FA is required", async () => {
    const driver = new FakeAuthFlowDriver(true);

    await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.twoFactorCodeReceived).toBe(FAKE_2FA_CODE);
  });

  it("returns AuthResult from waitForResult when 2FA is required", async () => {
    const driver = new FakeAuthFlowDriver(true);

    const result = await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(result).toEqual(FAKE_AUTH_RESULT);
  });

  it("logs each step in order", async () => {
    const driver = new FakeAuthFlowDriver(false);
    const logged: string[] = [];

    await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE, (msg) => logged.push(msg));

    expect(logged).toEqual([
      Messages.LAUNCHING_BROWSER,
      Messages.NAVIGATING_TO_ICLOUD,
      Messages.ENTERING_APPLE_ID,
      Messages.ENTERING_PASSWORD,
      Messages.CHECKING_FOR_TWO_FACTOR,
      Messages.WAITING_FOR_AUTH,
    ]);
  });

  it("logs TWO_FACTOR_REQUIRED and SUBMITTING_TWO_FACTOR when 2FA is required", async () => {
    const driver = new FakeAuthFlowDriver(true);
    const logged: string[] = [];

    await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE, (msg) => logged.push(msg));

    expect(logged).toContain(Messages.TWO_FACTOR_REQUIRED);
    expect(logged).toContain(Messages.SUBMITTING_TWO_FACTOR);
  });

  it("does not log TWO_FACTOR_REQUIRED when 2FA is not required", async () => {
    const driver = new FakeAuthFlowDriver(false);
    const logged: string[] = [];

    await runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE, (msg) => logged.push(msg));

    expect(logged).not.toContain(Messages.TWO_FACTOR_REQUIRED);
  });

  it("throws when promptCredentials returns an empty appleId", async () => {
    const driver = new FakeAuthFlowDriver(false);

    await expect(
      runAuthFlow(driver, async () => ({ appleId: "", password: "password123" }), async () => FAKE_2FA_CODE)
    ).rejects.toThrow();
  });

  it("throws when promptCredentials returns an empty password", async () => {
    const driver = new FakeAuthFlowDriver(false);

    await expect(
      runAuthFlow(driver, async () => ({ appleId: "test@example.com", password: "" }), async () => FAKE_2FA_CODE)
    ).rejects.toThrow();
  });

  it("throws when promptTwoFactorCode returns an empty code and 2FA is required", async () => {
    const driver = new FakeAuthFlowDriver(true);

    await expect(
      runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => "")
    ).rejects.toThrow();
  });

  it("does not throw for empty 2FA code when 2FA is not required", async () => {
    const driver = new FakeAuthFlowDriver(false);

    await expect(
      runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => "")
    ).resolves.toEqual(FAKE_AUTH_RESULT);
  });

  it("propagates errors thrown by enterAppleId", async () => {
    const driver = new FakeAuthFlowDriver(false, FAKE_AUTH_RESULT, "enterAppleId");

    await expect(
      runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE)
    ).rejects.toThrow("Driver failed on enterAppleId");
  });

  it("propagates errors thrown by submitTwoFactorCode", async () => {
    const driver = new FakeAuthFlowDriver(true, FAKE_AUTH_RESULT, "submitTwoFactorCode");

    await expect(
      runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE)
    ).rejects.toThrow("Driver failed on submitTwoFactorCode");
  });

  it("propagates errors thrown by waitForResult", async () => {
    const driver = new FakeAuthFlowDriver(false, FAKE_AUTH_RESULT, "waitForResult");

    await expect(
      runAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE)
    ).rejects.toThrow("Driver failed on waitForResult");
  });
});

