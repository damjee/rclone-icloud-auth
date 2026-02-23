import { runAuthFlow } from "../core/auth-flow.js";
import { BrowserDriver } from "./browser-driver.js";
import { promptUser, resumePrompt, closePrompt } from "./prompt.js";
import type { DebugCapture } from "../core/debug-capture.js";
import type { AuthAdapter, AuthResult } from "../core/orchestrator.js";

export class HeadlessAuthAdapter implements AuthAdapter {
  constructor(private readonly debugCapture: DebugCapture) {}

  async authenticate(): Promise<AuthResult> {
    const driver = new BrowserDriver(this.debugCapture);

    const result = await runAuthFlow(
      driver,
      async (prompts) => ({
        appleId: await promptUser(prompts.appleId),
        password: await promptUser(prompts.password),
      }),
      async (prompt) => {
        resumePrompt();
        return promptUser(prompt);
      },
      console.log
    );

    closePrompt();
    return result;
  }
}
