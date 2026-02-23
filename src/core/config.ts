export function buildRcloneCommand(cookies: string, trustToken: string, remoteName: string): string {
  return `rclone config update ${remoteName} cookies='${cookies}' trust_token='${trustToken}'`;
}

export function updateRcloneConfigContent(
  content: string,
  cookies: string,
  trustToken: string,
  remoteName: string
): string {
  if (!content.includes(`[${remoteName}]`)) return content;

  let result = replaceOrAppendKey(content, "cookies", cookies, remoteName);
  result = replaceOrAppendKey(result, "trust_token", trustToken, remoteName);
  return result;
}

function replaceOrAppendKey(content: string, key: string, value: string, remoteName: string): string {
  const keyRegex = new RegExp(`^${key}\\s*=.*$`, "m");
  if (keyRegex.test(content)) {
    return content.replace(keyRegex, `${key} = ${value}`);
  }
  return content.replace(new RegExp(`(\\[${remoteName}\\][^\\n]*\\n)`), `$1${key} = ${value}\n`);
}

export function parseIcloudRemotes(content: string): string[] {
  const remotes: string[] = [];
  const sections = content.split(/(?=^\[)/m);
  for (const section of sections) {
    const nameMatch = section.match(/^\[([^\]]+)\]/);
    if (!nameMatch) continue;
    if (/^\s*type\s*=\s*iclouddrive\s*$/m.test(section)) {
      remotes.push(nameMatch[1]);
    }
  }
  return remotes;
}

export function validateIcloudRemote(content: string, remoteName: string): boolean {
  return parseIcloudRemotes(content).includes(remoteName);
}
