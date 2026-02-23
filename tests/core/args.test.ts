import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/core/args.js";

describe("parseArgs", () => {
  it("returns debug=false when no flags are provided", () => {
    const result = parseArgs([]);
    expect(result).toEqual({ debug: false });
  });

  it("sets debug=true when --debug flag is present", () => {
    const result = parseArgs(["--debug"]);
    expect(result.debug).toBe(true);
  });

  it("ignores unrecognised flags", () => {
    const result = parseArgs(["--unknown"]);
    expect(result).toEqual({ debug: false });
  });
});
