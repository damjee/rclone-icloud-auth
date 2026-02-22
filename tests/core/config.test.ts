import { describe, it, expect } from "vitest";
import {
  buildRcloneCommand,
  updateRcloneConfigContent,
} from "../../src/core/config.js";

describe("buildRcloneCommand", () => {
  it("returns a correctly formatted rclone config update command", () => {
    const result = buildRcloneCommand("foo=bar; baz=qux", "mytrusttoken");
    expect(result).toBe(
      "rclone config update iclouddrive cookies='foo=bar; baz=qux' trust_token='mytrusttoken'"
    );
  });

  it("includes cookies and trust_token in the command", () => {
    const result = buildRcloneCommand("SESSION=abc", "token123");
    expect(result).toContain("cookies='SESSION=abc'");
    expect(result).toContain("trust_token='token123'");
  });
});

describe("updateRcloneConfigContent", () => {
  const baseConfig = `[iclouddrive]
type = iclouddrive
cookies = old_cookie_value
trust_token = old_trust_token
`;

  it("replaces an existing cookies line", () => {
    const result = updateRcloneConfigContent(
      baseConfig,
      "new_cookies",
      "old_trust_token"
    );
    expect(result).toContain("cookies = new_cookies");
    expect(result).not.toContain("cookies = old_cookie_value");
  });

  it("replaces an existing trust_token line", () => {
    const result = updateRcloneConfigContent(
      baseConfig,
      "old_cookies",
      "new_trust_token"
    );
    expect(result).toContain("trust_token = new_trust_token");
    expect(result).not.toContain("trust_token = old_trust_token");
  });

  it("appends cookies line when it is absent from the iclouddrive section", () => {
    const configWithoutCookies = `[iclouddrive]
type = iclouddrive
trust_token = existing_token
`;
    const result = updateRcloneConfigContent(
      configWithoutCookies,
      "new_cookies",
      "existing_token"
    );
    expect(result).toContain("cookies = new_cookies");
  });

  it("appends trust_token line when it is absent from the iclouddrive section", () => {
    const configWithoutTrust = `[iclouddrive]
type = iclouddrive
cookies = existing_cookies
`;
    const result = updateRcloneConfigContent(
      configWithoutTrust,
      "existing_cookies",
      "new_trust_token"
    );
    expect(result).toContain("trust_token = new_trust_token");
  });

  it("preserves unrelated sections unchanged", () => {
    const configWithOtherSection = `[other]
type = s3
key = value

[iclouddrive]
type = iclouddrive
cookies = old
trust_token = old_token
`;
    const result = updateRcloneConfigContent(
      configWithOtherSection,
      "new_cookies",
      "new_token"
    );
    expect(result).toContain("[other]");
    expect(result).toContain("type = s3");
    expect(result).toContain("key = value");
  });

  it("returns content unchanged when iclouddrive section does not exist", () => {
    const configWithoutSection = "[other]\ntype = s3\n";
    const result = updateRcloneConfigContent(
      configWithoutSection,
      "cookies",
      "token"
    );
    expect(result).toBe(configWithoutSection);
  });
});
