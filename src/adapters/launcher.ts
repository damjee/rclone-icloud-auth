import { runHeadlessAuthFlow } from "../core/headless-flow.js";
import { BrowserDriver } from "./browser-driver.js";
import { promptUser, resumePrompt, closePrompt } from "./prompt.js";
import type { AuthAdapter, AuthResult } from "../core/orchestrator.js";

export class HeadlessAuthAdapter implements AuthAdapter {
  constructor(private readonly debugEnabled: boolean) {}

  async authenticate(): Promise<AuthResult> {
    console.log("=== rclone iCloud Authenticator ===\n");

    const driver = new BrowserDriver(this.debugEnabled);

    const result = await runHeadlessAuthFlow(
      driver,
      async () => ({
        appleId: await promptUser("Apple ID email: "),
        password: await promptUser("Password (will be visible): "),
      }),
      async () => {
        resumePrompt();
        return promptUser("\n2FA code (from your iPhone): ");
      }
    );

    closePrompt();
    return result;
  }
}
