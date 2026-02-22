import { parseArgs } from "./core/args.js";
import { orchestrate } from "./core/orchestrator.js";
import { GuiBrowserAdapter } from "./adapters/browser-gui.js";
import { HeadlessBrowserAdapter } from "./adapters/browser-headless.js";
import { readRcloneConfigContent, writeRcloneConfigContent } from "./adapters/filesystem.js";
import { testRcloneConnection } from "./adapters/process.js";

const args = parseArgs(process.argv.slice(2));
const adapter = args.headless
  ? new HeadlessBrowserAdapter(args.debug)
  : new GuiBrowserAdapter();

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
