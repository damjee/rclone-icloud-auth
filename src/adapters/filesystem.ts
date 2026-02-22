import * as fs from "fs";
import * as os from "os";

const RCLONE_CONF_PATH = `${os.homedir()}/.config/rclone/rclone.conf`;
const RCLONE_CONF_FILE_MODE = 0o600;

export function readRcloneConfigContent(): string | null {
  if (!fs.existsSync(RCLONE_CONF_PATH)) return null;
  return fs.readFileSync(RCLONE_CONF_PATH, "utf8");
}

export function writeRcloneConfigContent(content: string): void {
  fs.writeFileSync(RCLONE_CONF_PATH, content, { mode: RCLONE_CONF_FILE_MODE });
}
