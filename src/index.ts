import { parseArgs } from "./core/args.js";
import { parseIcloudRemotes } from "./core/config.js";
import { runRemoteSelectionFlow, resolveDefaultRemote } from "./core/remote-selection.js";
import { orchestrate } from "./core/orchestrator.js";
import { buildAuthAdapter } from "./adapters/browser-driver-builder.js";
import { readRcloneConfigContent, readPreferences, writePreferences } from "./adapters/filesystem.js";
import { promptSelectRemote } from "./adapters/prompt.js";
import { reportAuthResult } from "./adapters/reporter.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const adapter = buildAuthAdapter(args.debug);

  const existingConfigContent = readRcloneConfigContent();
  const icloudRemotes = existingConfigContent ? parseIcloudRemotes(existingConfigContent) : [];

  const preferences = readPreferences();
  const savedDefault = resolveDefaultRemote(icloudRemotes, preferences);

  const { remoteName } = await runRemoteSelectionFlow(icloudRemotes, savedDefault, promptSelectRemote);
  writePreferences({ ...preferences, defaultRemote: remoteName });

  const result = await orchestrate(adapter, { existingConfigContent, remoteName });
  reportAuthResult(result);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});

