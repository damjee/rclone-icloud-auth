import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

const RCLONE_CONF_PATH = `${os.homedir()}/.config/rclone/rclone.conf`;
const RCLONE_CONF_FILE_MODE = 0o600;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PREFERENCES_PATH = path.join(REPO_ROOT, "temp", "preferences.json");

export interface Preferences {
  defaultRemote?: string;
}

export function readRcloneConfigContent(): string | null {
  if (!fs.existsSync(RCLONE_CONF_PATH)) return null;
  return fs.readFileSync(RCLONE_CONF_PATH, "utf8");
}

export function writeRcloneConfigContent(content: string): void {
  fs.writeFileSync(RCLONE_CONF_PATH, content, { mode: RCLONE_CONF_FILE_MODE });
}

export function readPreferences(): Preferences {
  if (!fs.existsSync(PREFERENCES_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(PREFERENCES_PATH, "utf8")) as Preferences;
  } catch {
    return {};
  }
}

export function writePreferences(prefs: Preferences): void {
  fs.mkdirSync(path.dirname(PREFERENCES_PATH), { recursive: true });
  fs.writeFileSync(PREFERENCES_PATH, JSON.stringify(prefs, null, 2));
}
