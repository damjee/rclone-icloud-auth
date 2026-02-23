import { describe, it, expect } from "vitest";
import {
  buildRcloneCommand,
  updateRcloneConfigContent,
  parseIcloudRemotes,
  validateIcloudRemote,
} from "../../src/core/config.js";

describe("buildRcloneCommand", () => {
  it("returns a correctly formatted rclone config update command", () => {
    const result = buildRcloneCommand("foo=bar; baz=qux", "mytrusttoken", "iclouddrive");
    expect(result).toBe(
      "rclone config update iclouddrive cookies='foo=bar; baz=qux' trust_token='mytrusttoken'"
    );
  });

  it("includes cookies and trust_token in the command", () => {
    const result = buildRcloneCommand("SESSION=abc", "token123", "iclouddrive");
    expect(result).toContain("cookies='SESSION=abc'");
    expect(result).toContain("trust_token='token123'");
  });

  it("uses the provided remote name in the command", () => {
    const result = buildRcloneCommand("SESSION=abc", "token123", "myicloud");
    expect(result).toBe("rclone config update myicloud cookies='SESSION=abc' trust_token='token123'");
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
      "old_trust_token",
      "iclouddrive"
    );
    expect(result).toContain("cookies = new_cookies");
    expect(result).not.toContain("cookies = old_cookie_value");
  });

  it("replaces an existing trust_token line", () => {
    const result = updateRcloneConfigContent(
      baseConfig,
      "old_cookies",
      "new_trust_token",
      "iclouddrive"
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
      "existing_token",
      "iclouddrive"
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
      "new_trust_token",
      "iclouddrive"
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
      "new_token",
      "iclouddrive"
    );
    expect(result).toContain("[other]");
    expect(result).toContain("type = s3");
    expect(result).toContain("key = value");
  });

  it("returns content unchanged when the specified section does not exist", () => {
    const configWithoutSection = "[other]\ntype = s3\n";
    const result = updateRcloneConfigContent(
      configWithoutSection,
      "cookies",
      "token",
      "iclouddrive"
    );
    expect(result).toBe(configWithoutSection);
  });

  it("updates the correct section when remote name differs from iclouddrive", () => {
    const config = `[myicloud]
type = iclouddrive
cookies = old
trust_token = old_token
`;
    const result = updateRcloneConfigContent(config, "new_cookies", "new_token", "myicloud");
    expect(result).toContain("cookies = new_cookies");
    expect(result).toContain("trust_token = new_token");
  });
});

describe("parseIcloudRemotes", () => {
  it("returns an empty array when the config has no iCloud remotes", () => {
    const config = "[other]\ntype = s3\n";
    expect(parseIcloudRemotes(config)).toEqual([]);
  });

  it("returns the name of a single iCloud remote", () => {
    const config = "[iclouddrive]\ntype = iclouddrive\n";
    expect(parseIcloudRemotes(config)).toEqual(["iclouddrive"]);
  });

  it("returns names of all iCloud remotes when multiple exist", () => {
    const config = `[iclouddrive]
type = iclouddrive

[work-icloud]
type = iclouddrive

[other]
type = s3
`;
    expect(parseIcloudRemotes(config)).toEqual(["iclouddrive", "work-icloud"]);
  });

  it("does not include non-iCloud remotes", () => {
    const config = `[s3bucket]
type = s3

[iclouddrive]
type = iclouddrive
`;
    const result = parseIcloudRemotes(config);
    expect(result).toContain("iclouddrive");
    expect(result).not.toContain("s3bucket");
  });

  it("returns an empty array for empty config content", () => {
    expect(parseIcloudRemotes("")).toEqual([]);
  });
});

describe("validateIcloudRemote", () => {
  it("returns true for a remote with type = iclouddrive", () => {
    const config = "[iclouddrive]\ntype = iclouddrive\ncookies = abc\n";
    expect(validateIcloudRemote(config, "iclouddrive")).toBe(true);
  });

  it("returns false when the remote does not exist", () => {
    const config = "[other]\ntype = s3\n";
    expect(validateIcloudRemote(config, "iclouddrive")).toBe(false);
  });

  it("returns false when the remote exists but is not type iclouddrive", () => {
    const config = "[myremote]\ntype = s3\n";
    expect(validateIcloudRemote(config, "myremote")).toBe(false);
  });
});
