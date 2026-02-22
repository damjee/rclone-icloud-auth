import { execSync } from "child_process";

const RCLONE_TEST_COMMAND = "rclone lsd iclouddrive:";

export function testRcloneConnection(): void {
  try {
    const output = execSync(RCLONE_TEST_COMMAND, { encoding: "utf8" });
    console.log("✓ Connection test passed:\n" + output);
  } catch {
    console.log("✗ Connection test failed — check rclone.conf manually.");
  }
}
