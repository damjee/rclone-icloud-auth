export function buildRcloneCommand(cookies: string, trustToken: string): string {
  return `rclone config update iclouddrive cookies='${cookies}' trust_token='${trustToken}'`;
}

export function updateRcloneConfigContent(
  content: string,
  cookies: string,
  trustToken: string
): string {
  if (!content.includes("[iclouddrive]")) return content;

  let result = replaceOrAppendKey(content, "cookies", cookies);
  result = replaceOrAppendKey(result, "trust_token", trustToken);
  return result;
}

function replaceOrAppendKey(content: string, key: string, value: string): string {
  const keyRegex = new RegExp(`^${key}\\s*=.*$`, "m");
  if (keyRegex.test(content)) {
    return content.replace(keyRegex, `${key} = ${value}`);
  }
  return content.replace(/(\[iclouddrive\][^\n]*\n)/, `$1${key} = ${value}\n`);
}
