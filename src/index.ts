import { parseArgs } from "./core/args.js";
import { parseIcloudRemotes } from "./core/config.js";
import { orchestrate } from "./core/orchestrator.js";
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

if (icloudRemotes.length === 0) {
  console.error("No iCloud remotes found in rclone.conf. Please add one first with `rclone config`.");
  process.exit(1);
}

const preferences = readPreferences();
const savedDefault = preferences.defaultRemote && icloudRemotes.includes(preferences.defaultRemote)
  ? preferences.defaultRemote
  : undefined;

let remoteName: string;
if (icloudRemotes.length === 1) {
  remoteName = icloudRemotes[0];
  console.log(`\nUsing iCloud remote: ${remoteName}`);
} else {
  remoteName = await promptSelectRemote(icloudRemotes, savedDefault);
}

writePreferences({ ...preferences, defaultRemote: remoteName });

const { rcloneCommand, updatedConfigContent } = await orchestrate(adapter, {
  existingConfigContent,
  remoteName,
});

if (updatedConfigContent !== null) {
  writeRcloneConfigContent(updatedConfigContent);
  console.log("\n✓ rclone.conf updated successfully.\n");
  testRcloneConnection();
} else {
  console.log("\nRun the following command to authenticate:");
  console.log(rcloneCommand);
}
