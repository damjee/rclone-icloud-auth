import { runAuthFlow } from "../core/auth-flow.js";
import { promptUser, resumePrompt, closePrompt } from "./prompt.js";
import type { AuthFlowDriver } from "../core/auth-flow.js";
import type { AuthAdapter, AuthResult } from "../core/orchestrator.js";

export class BrowserAuthAdapter implements AuthAdapter {
  constructor(private readonly driver: AuthFlowDriver) {}

  async authenticate(): Promise<AuthResult> {
    const result = await runAuthFlow(
      this.driver,
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
