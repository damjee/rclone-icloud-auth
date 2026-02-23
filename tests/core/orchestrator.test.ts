import { describe, it, expect } from "vitest";
import { orchestrate } from "../../src/core/orchestrator.js";
import type { AuthAdapter, AuthResult } from "../../src/core/orchestrator.js";

class FakeAuthAdapter implements AuthAdapter {
  private result: AuthResult;

  constructor(result: AuthResult) {
    this.result = result;
  }

  async authenticate(): Promise<AuthResult> {
    return this.result;
  }
}

class FailingAuthAdapter implements AuthAdapter {
  async authenticate(): Promise<AuthResult> {
    throw new Error("Authentication failed");
  }
}

describe("orchestrate", () => {
  it("returns the rclone command string when no rclone config content is provided", async () => {
    const adapter = new FakeAuthAdapter({
      trustToken: "mytoken",
      cookies: "SESSION=abc; X-APPLE-WEBAUTH-HSA-TRUST=mytoken",
    });

    const result = await orchestrate(adapter, { existingConfigContent: null, remoteName: "iclouddrive" });

    expect(result.rcloneCommand).toContain("trust_token='mytoken'");
    expect(result.rcloneCommand).toContain(
      "cookies='SESSION=abc; X-APPLE-WEBAUTH-HSA-TRUST=mytoken'"
    );
    expect(result.updatedConfigContent).toBeNull();
  });

  it("returns patched config content when existing config content is provided", async () => {
    const adapter = new FakeAuthAdapter({
      trustToken: "newtoken",
      cookies: "SESSION=new; X-APPLE-WEBAUTH-HSA-TRUST=newtoken",
    });
    const existingConfigContent = `[iclouddrive]
type = iclouddrive
cookies = old_cookies
trust_token = old_token
`;

    const result = await orchestrate(adapter, { existingConfigContent, remoteName: "iclouddrive" });

    expect(result.updatedConfigContent).toContain("cookies = SESSION=new; X-APPLE-WEBAUTH-HSA-TRUST=newtoken");
    expect(result.updatedConfigContent).toContain("trust_token = newtoken");
    expect(result.updatedConfigContent).not.toContain("old_cookies");
    expect(result.updatedConfigContent).not.toContain("old_token");
  });

  it("still returns the rclone command when existing config content is provided", async () => {
    const adapter = new FakeAuthAdapter({
      trustToken: "tok",
      cookies: "SESSION=x",
    });

    const result = await orchestrate(adapter, {
      existingConfigContent: "[iclouddrive]\ntype = iclouddrive\n",
      remoteName: "iclouddrive",
    });

    expect(result.rcloneCommand).toContain("trust_token='tok'");
  });

  it("propagates errors thrown by the AuthAdapter", async () => {
    const adapter = new FailingAuthAdapter();

    await expect(
      orchestrate(adapter, { existingConfigContent: null, remoteName: "iclouddrive" })
    ).rejects.toThrow("Authentication failed");
  });

  it("uses the provided remote name in the rclone command", async () => {
    const adapter = new FakeAuthAdapter({ trustToken: "tok", cookies: "SESSION=x" });

    const result = await orchestrate(adapter, {
      existingConfigContent: null,
      remoteName: "myicloud",
    });

    expect(result.rcloneCommand).toContain("rclone config update myicloud");
  });
});
