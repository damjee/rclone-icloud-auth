import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/core/args.js";

describe("parseArgs", () => {
  it("returns headless=false and debug=false when no flags are provided", () => {
    const result = parseArgs([]);
    expect(result).toEqual({ headless: false, debug: false });
  });

  it("sets headless=true when --headless flag is present", () => {
    const result = parseArgs(["--headless"]);
    expect(result.headless).toBe(true);
    expect(result.debug).toBe(false);
  });

  it("sets debug=true when --debug flag is present", () => {
    const result = parseArgs(["--debug"]);
    expect(result.headless).toBe(false);
    expect(result.debug).toBe(true);
  });

  it("sets both flags when --headless and --debug are both present", () => {
    const result = parseArgs(["--headless", "--debug"]);
    expect(result).toEqual({ headless: true, debug: true });
  });

  it("ignores unrecognised flags", () => {
    const result = parseArgs(["--unknown", "--headless"]);
    expect(result).toEqual({ headless: true, debug: false });
  });

  it("is order-independent for flags", () => {
    const resultA = parseArgs(["--debug", "--headless"]);
    const resultB = parseArgs(["--headless", "--debug"]);
    expect(resultA).toEqual(resultB);
  });
});
