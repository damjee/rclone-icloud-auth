import { Messages } from "./messages.js";

export interface RemoteSelectionResult {
  remoteName: string;
}

export async function runRemoteSelectionFlow(
  remotes: string[],
  savedDefault: string | undefined,
  promptSelect: (remotes: string[], defaultRemote?: string) => Promise<string>,
  log: (message: string) => void = () => {}
): Promise<RemoteSelectionResult> {
  if (remotes.length === 0) throw new Error(Messages.NO_ICLOUD_REMOTES);

  if (remotes.length === 1) {
    log(Messages.AUTO_SELECTED_REMOTE(remotes[0]));
    return { remoteName: remotes[0] };
  }

  const remoteName = await promptSelect(remotes, savedDefault);
  return { remoteName };
}
