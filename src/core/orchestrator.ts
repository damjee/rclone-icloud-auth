import { buildRcloneCommand, updateRcloneConfigContent } from "./config.js";

export interface AuthResult {
  trustToken: string;
  cookies: string;
}

export interface AuthAdapter {
  authenticate(): Promise<AuthResult>;
}

interface OrchestrateOptions {
  existingConfigContent: string | null;
}

interface OrchestrateResult {
  rcloneCommand: string;
  updatedConfigContent: string | null;
}

export async function orchestrate(
  adapter: AuthAdapter,
  options: OrchestrateOptions
): Promise<OrchestrateResult> {
  const { trustToken, cookies } = await adapter.authenticate();
  const rcloneCommand = buildRcloneCommand(cookies, trustToken);
  const updatedConfigContent =
    options.existingConfigContent !== null
      ? updateRcloneConfigContent(options.existingConfigContent, cookies, trustToken)
      : null;
  return { rcloneCommand, updatedConfigContent };
}
