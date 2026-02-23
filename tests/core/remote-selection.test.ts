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

  it("auto-selects the only remote without prompting when one remote exists", async () => {
    const promptSelect = vi.fn(async () => "should-not-be-called");

    const result = await runRemoteSelectionFlow(["iclouddrive"], undefined, promptSelect, noOp);

    expect(result.remoteName).toBe("iclouddrive");
    expect(promptSelect).not.toHaveBeenCalled();
  });

  it("logs the auto-selected remote name when one remote exists", async () => {
    const log = vi.fn();

    await runRemoteSelectionFlow(["iclouddrive"], undefined, async () => "any", log);

    expect(log).toHaveBeenCalledWith(Messages.AUTO_SELECTED_REMOTE("iclouddrive"));
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

  it("does not log when multiple remotes exist and promptSelect is used", async () => {
    const log = vi.fn();
    const remotes = ["iclouddrive", "work-icloud"];

    await runRemoteSelectionFlow(remotes, undefined, async () => "iclouddrive", log);

    expect(log).not.toHaveBeenCalled();
  });
});
