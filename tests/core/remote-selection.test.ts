import { describe, it, expect, vi } from "vitest";
import { runRemoteSelectionFlow } from "../../src/core/remote-selection.js";
import { Messages } from "../../src/core/messages.js";

const noOp = () => {};

describe("runRemoteSelectionFlow", () => {
  it("throws when no iCloud remotes are found", async () => {
    await expect(
      runRemoteSelectionFlow([], undefined, async () => "any", noOp)
    ).rejects.toThrow(Messages.NO_ICLOUD_REMOTES);
  });

  it("always calls promptSelect even when only one remote exists", async () => {
    const promptSelect = vi.fn(async () => "iclouddrive");

    const result = await runRemoteSelectionFlow(["iclouddrive"], undefined, promptSelect, noOp);

    expect(promptSelect).toHaveBeenCalledWith(["iclouddrive"], undefined);
    expect(result.remoteName).toBe("iclouddrive");
  });

  it("calls promptSelect when multiple remotes exist", async () => {
    const remotes = ["iclouddrive", "work-icloud"];
    const promptSelect = vi.fn(async () => "work-icloud");

    const result = await runRemoteSelectionFlow(remotes, undefined, promptSelect, noOp);

    expect(promptSelect).toHaveBeenCalledWith(remotes, undefined);
    expect(result.remoteName).toBe("work-icloud");
  });

  it("passes the saved default to promptSelect", async () => {
    const remotes = ["iclouddrive", "work-icloud"];
    const promptSelect = vi.fn(async () => "iclouddrive");

    await runRemoteSelectionFlow(remotes, "iclouddrive", promptSelect, noOp);

    expect(promptSelect).toHaveBeenCalledWith(remotes, "iclouddrive");
  });

  it("passes saved default to promptSelect even when only one remote exists", async () => {
    const promptSelect = vi.fn(async () => "iclouddrive");

    await runRemoteSelectionFlow(["iclouddrive"], "iclouddrive", promptSelect, noOp);

    expect(promptSelect).toHaveBeenCalledWith(["iclouddrive"], "iclouddrive");
  });

  it("returns the remote name chosen by promptSelect", async () => {
    const result = await runRemoteSelectionFlow(
      ["iclouddrive", "work-icloud"],
      undefined,
      async () => "work-icloud",
      noOp
    );

    expect(result.remoteName).toBe("work-icloud");
  });
});

