import { Messages } from "./messages.js";
import type { Preferences } from "../adapters/filesystem.js";

export interface RemoteSelectionResult {
  remoteName: string;
}

export function resolveDefaultRemote(remotes: string[], preferences: Preferences): string | undefined {
  return preferences.defaultRemote && remotes.includes(preferences.defaultRemote)
    ? preferences.defaultRemote
    : undefined;
}

export async function runRemoteSelectionFlow(
  remotes: string[],
  savedDefault: string | undefined,
  promptSelect: (remotes: string[], defaultRemote?: string) => Promise<string>
): Promise<RemoteSelectionResult> {
  if (remotes.length === 0) throw new Error(Messages.NO_ICLOUD_REMOTES);

  const remoteName = await promptSelect(remotes, savedDefault);
  return { remoteName };
}
