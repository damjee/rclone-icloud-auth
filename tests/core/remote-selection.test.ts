import { describe, it, expect, vi } from "vitest";
import { runRemoteSelectionFlow, resolveDefaultRemote } from "../../src/core/remote-selection.js";
import { Messages } from "../../src/core/messages.js";

describe("runRemoteSelectionFlow", () => {
  it("throws when no iCloud remotes are found", async () => {
    await expect(
      runRemoteSelectionFlow([], undefined, async () => "any")
    ).rejects.toThrow(Messages.NO_ICLOUD_REMOTES);
  });

  it("always calls promptSelect even when only one remote exists", async () => {
    const promptSelect = vi.fn(async () => "iclouddrive");

    const result = await runRemoteSelectionFlow(["iclouddrive"], undefined, promptSelect);

    expect(promptSelect).toHaveBeenCalledWith(["iclouddrive"], undefined);
    expect(result.remoteName).toBe("iclouddrive");
  });

  it("calls promptSelect when multiple remotes exist", async () => {
    const remotes = ["iclouddrive", "work-icloud"];
    const promptSelect = vi.fn(async () => "work-icloud");

    const result = await runRemoteSelectionFlow(remotes, undefined, promptSelect);

    expect(promptSelect).toHaveBeenCalledWith(remotes, undefined);
    expect(result.remoteName).toBe("work-icloud");
  });

  it("passes the saved default to promptSelect", async () => {
    const remotes = ["iclouddrive", "work-icloud"];
    const promptSelect = vi.fn(async () => "iclouddrive");

    await runRemoteSelectionFlow(remotes, "iclouddrive", promptSelect);

    expect(promptSelect).toHaveBeenCalledWith(remotes, "iclouddrive");
  });

  it("passes saved default to promptSelect even when only one remote exists", async () => {
    const promptSelect = vi.fn(async () => "iclouddrive");

    await runRemoteSelectionFlow(["iclouddrive"], "iclouddrive", promptSelect);

    expect(promptSelect).toHaveBeenCalledWith(["iclouddrive"], "iclouddrive");
  });

  it("returns the remote name chosen by promptSelect", async () => {
    const result = await runRemoteSelectionFlow(
      ["iclouddrive", "work-icloud"],
      undefined,
      async () => "work-icloud"
    );

    expect(result.remoteName).toBe("work-icloud");
  });
});

describe("resolveDefaultRemote", () => {
  it("returns the saved default when it exists in the remotes list", () => {
    const result = resolveDefaultRemote(["iclouddrive", "work-icloud"], { defaultRemote: "iclouddrive" });
    expect(result).toBe("iclouddrive");
  });

  it("returns undefined when the saved default is not in the remotes list", () => {
    const result = resolveDefaultRemote(["iclouddrive"], { defaultRemote: "old-remote" });
    expect(result).toBeUndefined();
  });

  it("returns undefined when preferences has no defaultRemote", () => {
    const result = resolveDefaultRemote(["iclouddrive"], {});
    expect(result).toBeUndefined();
  });

  it("returns undefined when remotes list is empty", () => {
    const result = resolveDefaultRemote([], { defaultRemote: "iclouddrive" });
    expect(result).toBeUndefined();
  });
});

