const TRUST_COOKIE_NAME = "X-APPLE-WEBAUTH-HSA-TRUST";

export function parseCookieHeader(header: string): string[] {
  if (!header) return [];
  return header.split(";").map((c) => c.trim()).filter(Boolean);
}

export function extractTrustToken(cookies: string[]): string | undefined {
  const prefix = `${TRUST_COOKIE_NAME}=`;
  const entry = cookies.find((c) => c.startsWith(prefix));
  return entry?.slice(prefix.length);
}

export function formatCookiesArray(cookies: string[]): string {
  return cookies.join("; ");
}
