import { parseArgs } from "./core/args.js";
import { orchestrate } from "./core/orchestrator.js";
import { BrowserAuthAdapter } from "./adapters/launcher.js";
import { BrowserDriverBuilder } from "./adapters/browser-driver-builder.js";
import { readRcloneConfigContent, writeRcloneConfigContent } from "./adapters/filesystem.js";
import { testRcloneConnection } from "./adapters/process.js";

const args = parseArgs(process.argv.slice(2));
const builder = new BrowserDriverBuilder();
if (args.debug) builder.withDebug();
const adapter = new BrowserAuthAdapter(builder.build());

const existingConfigContent = readRcloneConfigContent();

const { rcloneCommand, updatedConfigContent } = await orchestrate(adapter, {
  existingConfigContent,
});

if (updatedConfigContent !== null) {
  writeRcloneConfigContent(updatedConfigContent);
  console.log("\n✓ rclone.conf updated successfully.\n");
  testRcloneConnection();
} else {
  console.log("\nRun the following command to authenticate:");
  console.log(rcloneCommand);
}
