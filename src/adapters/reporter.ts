import { Messages } from "../core/messages.js";
import { writeRcloneConfigContent } from "./filesystem.js";
import { testRcloneConnection } from "./process.js";
import type { OrchestrateResult } from "../core/orchestrator.js";

export function reportAuthResult(result: OrchestrateResult): void {
  if (result.updatedConfigContent !== null) {
    writeRcloneConfigContent(result.updatedConfigContent);
    console.log(Messages.RCLONE_CONF_UPDATED);
    testRcloneConnection();
  } else {
    console.log(Messages.RCLONE_COMMAND_INSTRUCTIONS);
    console.log(result.rcloneCommand);
  }
}
