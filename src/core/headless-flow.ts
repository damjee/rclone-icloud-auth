import type { AuthResult } from "./orchestrator.js";

export interface AuthFlowDriver {
  beginAuth(appleId: string, password: string): Promise<{ twoFactorRequired: boolean }>;
  completeTwoFactorAuth(code: string): Promise<AuthResult>;
  collectResult(): Promise<AuthResult>;
}

const EMPTY_APPLE_ID_ERROR = "Apple ID must not be empty";
const EMPTY_PASSWORD_ERROR = "Password must not be empty";
const EMPTY_TWO_FACTOR_CODE_ERROR = "Two-factor code must not be empty";

export async function runHeadlessAuthFlow(
  driver: AuthFlowDriver,
  promptCredentials: () => Promise<{ appleId: string; password: string }>,
  promptTwoFactorCode: () => Promise<string>
): Promise<AuthResult> {
  const { appleId, password } = await promptCredentials();

  if (!appleId) throw new Error(EMPTY_APPLE_ID_ERROR);
  if (!password) throw new Error(EMPTY_PASSWORD_ERROR);

  const { twoFactorRequired } = await driver.beginAuth(appleId, password);

  if (twoFactorRequired) {
    const code = await promptTwoFactorCode();
    if (!code) throw new Error(EMPTY_TWO_FACTOR_CODE_ERROR);
    return driver.completeTwoFactorAuth(code);
  }

  return driver.collectResult();
}
