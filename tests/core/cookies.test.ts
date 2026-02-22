import { describe, it, expect } from "vitest";
import {
  parseCookieHeader,
  extractTrustToken,
  formatCookiesArray,
} from "../../src/core/cookies.js";

describe("parseCookieHeader", () => {
  it("returns an array of name=value strings for a valid header", () => {
    const header = "foo=bar; baz=qux; hello=world";
    const result = parseCookieHeader(header);
    expect(result).toEqual(["foo=bar", "baz=qux", "hello=world"]);
  });

  it("returns an empty array when header is an empty string", () => {
    const result = parseCookieHeader("");
    expect(result).toEqual([]);
  });

  it("trims whitespace from each cookie entry", () => {
    const header = "  foo=bar  ;  baz=qux  ";
    const result = parseCookieHeader(header);
    expect(result).toEqual(["foo=bar", "baz=qux"]);
  });

  it("preserves cookie values that contain equals signs", () => {
    const header = "token=abc=def==";
    const result = parseCookieHeader(header);
    expect(result).toEqual(["token=abc=def=="]);
  });
});

describe("extractTrustToken", () => {
  it("returns the token value when the trust cookie is present", () => {
    const cookies = [
      "SESSION=abc123",
      "X-APPLE-WEBAUTH-HSA-TRUST=mytrusttoken",
      "other=value",
    ];
    const result = extractTrustToken(cookies);
    expect(result).toBe("mytrusttoken");
  });

  it("returns undefined when the trust cookie is absent", () => {
    const cookies = ["SESSION=abc123", "other=value"];
    const result = extractTrustToken(cookies);
    expect(result).toBeUndefined();
  });

  it("returns undefined when cookies array is empty", () => {
    const result = extractTrustToken([]);
    expect(result).toBeUndefined();
  });

  it("handles a trust cookie with an equals sign in the value", () => {
    const cookies = ["X-APPLE-WEBAUTH-HSA-TRUST=base64+val=="];
    const result = extractTrustToken(cookies);
    expect(result).toBe("base64+val==");
  });
});

describe("formatCookiesArray", () => {
  it("joins an array of name=value strings into a single cookie header", () => {
    const cookies = ["foo=bar", "baz=qux"];
    const result = formatCookiesArray(cookies);
    expect(result).toBe("foo=bar; baz=qux");
  });

  it("returns an empty string for an empty array", () => {
    const result = formatCookiesArray([]);
    expect(result).toBe("");
  });

  it("returns the single entry unchanged when array has one element", () => {
    const result = formatCookiesArray(["foo=bar"]);
    expect(result).toBe("foo=bar");
  });
});
