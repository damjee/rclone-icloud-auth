import { describe, it, expect } from "vitest";
import { runHeadlessAuthFlow } from "../../src/core/headless-flow.js";
import type { AuthFlowDriver } from "../../src/core/headless-flow.js";
import type { AuthResult } from "../../src/core/orchestrator.js";

const FAKE_AUTH_RESULT: AuthResult = {
  trustToken: "fake-trust-token",
  cookies: "SESSION=abc; X-APPLE-WEBAUTH-HSA-TRUST=fake-trust-token",
};

const FAKE_CREDENTIALS = { appleId: "test@example.com", password: "password123" };
const FAKE_2FA_CODE = "123456";

type FailableMethod = "beginAuth" | "completeTwoFactorAuth" | "collectResult";

class FakeAuthFlowDriver implements AuthFlowDriver {
  appleIdReceived: string | null = null;
  passwordReceived: string | null = null;
  twoFactorCodeReceived: string | null = null;
  collectResultCalled = false;
  completeTwoFactorAuthCalled = false;

  constructor(
    private readonly twoFactorRequired: boolean = false,
    private readonly authResult: AuthResult = FAKE_AUTH_RESULT,
    private readonly failOn: FailableMethod | null = null
  ) {}

  async beginAuth(appleId: string, password: string): Promise<{ twoFactorRequired: boolean }> {
    this.appleIdReceived = appleId;
    this.passwordReceived = password;
    if (this.failOn === "beginAuth") throw new Error("Driver failed on beginAuth");
    return { twoFactorRequired: this.twoFactorRequired };
  }

  async completeTwoFactorAuth(code: string): Promise<AuthResult> {
    this.completeTwoFactorAuthCalled = true;
    this.twoFactorCodeReceived = code;
    if (this.failOn === "completeTwoFactorAuth") throw new Error("Driver failed on completeTwoFactorAuth");
    return this.authResult;
  }

  async collectResult(): Promise<AuthResult> {
    this.collectResultCalled = true;
    if (this.failOn === "collectResult") throw new Error("Driver failed on collectResult");
    return this.authResult;
  }
}

describe("runHeadlessAuthFlow", () => {
  it("returns AuthResult from collectResult when 2FA is not required", async () => {
    const driver = new FakeAuthFlowDriver(false);

    const result = await runHeadlessAuthFlow(
      driver,
      async () => FAKE_CREDENTIALS,
      async () => FAKE_2FA_CODE
    );

    expect(result).toEqual(FAKE_AUTH_RESULT);
  });

  it("does not call promptTwoFactorCode when 2FA is not required", async () => {
    const driver = new FakeAuthFlowDriver(false);
    let promptCalled = false;

    await runHeadlessAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => {
      promptCalled = true;
      return FAKE_2FA_CODE;
    });

    expect(promptCalled).toBe(false);
  });

  it("does not call completeTwoFactorAuth when 2FA is not required", async () => {
    const driver = new FakeAuthFlowDriver(false);

    await runHeadlessAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.completeTwoFactorAuthCalled).toBe(false);
  });

  it("passes appleId and password from promptCredentials to beginAuth", async () => {
    const driver = new FakeAuthFlowDriver(false);

    await runHeadlessAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.appleIdReceived).toBe(FAKE_CREDENTIALS.appleId);
    expect(driver.passwordReceived).toBe(FAKE_CREDENTIALS.password);
  });

  it("calls completeTwoFactorAuth with the code from promptTwoFactorCode when 2FA is required", async () => {
    const driver = new FakeAuthFlowDriver(true);

    await runHeadlessAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.twoFactorCodeReceived).toBe(FAKE_2FA_CODE);
  });

  it("returns AuthResult from completeTwoFactorAuth when 2FA is required", async () => {
    const driver = new FakeAuthFlowDriver(true);

    const result = await runHeadlessAuthFlow(
      driver,
      async () => FAKE_CREDENTIALS,
      async () => FAKE_2FA_CODE
    );

    expect(result).toEqual(FAKE_AUTH_RESULT);
  });

  it("does not call collectResult when 2FA is required", async () => {
    const driver = new FakeAuthFlowDriver(true);

    await runHeadlessAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE);

    expect(driver.collectResultCalled).toBe(false);
  });

  it("propagates errors thrown by beginAuth", async () => {
    const driver = new FakeAuthFlowDriver(false, FAKE_AUTH_RESULT, "beginAuth");

    await expect(
      runHeadlessAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE)
    ).rejects.toThrow("Driver failed on beginAuth");
  });

  it("propagates errors thrown by completeTwoFactorAuth", async () => {
    const driver = new FakeAuthFlowDriver(true, FAKE_AUTH_RESULT, "completeTwoFactorAuth");

    await expect(
      runHeadlessAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE)
    ).rejects.toThrow("Driver failed on completeTwoFactorAuth");
  });

  it("propagates errors thrown by collectResult", async () => {
    const driver = new FakeAuthFlowDriver(false, FAKE_AUTH_RESULT, "collectResult");

    await expect(
      runHeadlessAuthFlow(driver, async () => FAKE_CREDENTIALS, async () => FAKE_2FA_CODE)
    ).rejects.toThrow("Driver failed on collectResult");
  });
});
