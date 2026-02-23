import type { AuthResult } from "./orchestrator.js";
import { Messages } from "./messages.js";

export interface AuthFlowDriver {
  launch(): Promise<void>;
  navigateToSignIn(): Promise<void>;
  enterAppleId(appleId: string): Promise<void>;
  enterPassword(password: string): Promise<void>;
  checkTwoFactor(): Promise<{ twoFactorRequired: boolean }>;
  submitTwoFactorCode(code: string): Promise<void>;
  waitForResult(): Promise<AuthResult>;
  close(): Promise<void>;
}

const EMPTY_APPLE_ID_ERROR = "Apple ID must not be empty";
const EMPTY_PASSWORD_ERROR = "Password must not be empty";
const EMPTY_TWO_FACTOR_CODE_ERROR = "Two-factor code must not be empty";

export async function runAuthFlow(
  driver: AuthFlowDriver,
  promptCredentials: (prompts: { appleId: string; password: string }) => Promise<{ appleId: string; password: string }>,
  promptTwoFactorCode: (prompt: string) => Promise<string>,
  log: (message: string) => void = () => {}
): Promise<AuthResult> {
  log(Messages.BANNER);

  const { appleId, password } = await promptCredentials({
    appleId: Messages.PROMPT_APPLE_ID,
    password: Messages.PROMPT_PASSWORD,
  });

  if (!appleId) throw new Error(EMPTY_APPLE_ID_ERROR);
  if (!password) throw new Error(EMPTY_PASSWORD_ERROR);

  log(Messages.LAUNCHING_BROWSER);
  await driver.launch();

  log(Messages.NAVIGATING_TO_ICLOUD);
  await driver.navigateToSignIn();

  log(Messages.ENTERING_APPLE_ID);
  await driver.enterAppleId(appleId);

  log(Messages.ENTERING_PASSWORD);
  await driver.enterPassword(password);

  log(Messages.CHECKING_FOR_TWO_FACTOR);
  const { twoFactorRequired } = await driver.checkTwoFactor();

  if (twoFactorRequired) {
    log(Messages.TWO_FACTOR_REQUIRED);
    const code = await promptTwoFactorCode(Messages.PROMPT_2FA_CODE);
    if (!code) throw new Error(EMPTY_TWO_FACTOR_CODE_ERROR);

    log(Messages.SUBMITTING_TWO_FACTOR);
    await driver.submitTwoFactorCode(code);
  }

  log(Messages.WAITING_FOR_AUTH);
  const result = await driver.waitForResult();
  await driver.close();
  return result;
}
