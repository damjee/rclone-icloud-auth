import { parseArgs } from "./core/args.js";
import { parseIcloudRemotes } from "./core/config.js";
import { runRemoteSelectionFlow } from "./core/remote-selection.js";
import { orchestrate } from "./core/orchestrator.js";
import { Messages } from "./core/messages.js";
import { BrowserAuthAdapter } from "./adapters/launcher.js";
import { BrowserDriverBuilder } from "./adapters/browser-driver-builder.js";
import {
  readRcloneConfigContent,
  writeRcloneConfigContent,
  readPreferences,
  writePreferences,
} from "./adapters/filesystem.js";
import { promptSelectRemote } from "./adapters/prompt.js";
import { testRcloneConnection } from "./adapters/process.js";

const args = parseArgs(process.argv.slice(2));
const builder = new BrowserDriverBuilder();
if (args.debug) builder.withDebug();
const adapter = new BrowserAuthAdapter(builder.build());

const existingConfigContent = readRcloneConfigContent();
const icloudRemotes = existingConfigContent ? parseIcloudRemotes(existingConfigContent) : [];

const preferences = readPreferences();
const savedDefault = preferences.defaultRemote && icloudRemotes.includes(preferences.defaultRemote)
  ? preferences.defaultRemote
  : undefined;

const { remoteName } = await runRemoteSelectionFlow(
  icloudRemotes,
  savedDefault,
  promptSelectRemote,
  console.log
).catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});

writePreferences({ ...preferences, defaultRemote: remoteName });

const { rcloneCommand, updatedConfigContent } = await orchestrate(adapter, {
  existingConfigContent,
  remoteName,
});

if (updatedConfigContent !== null) {
  writeRcloneConfigContent(updatedConfigContent);
  console.log(Messages.RCLONE_CONF_UPDATED);
  testRcloneConnection();
} else {
  console.log(Messages.RCLONE_COMMAND_INSTRUCTIONS);
  console.log(rcloneCommand);
}
