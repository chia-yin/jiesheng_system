import type { SessionUser } from "@/types/auth";

const SESSION_COOKIE = "js_session";

function encodeSession(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString("base64url");
}

export function decodeSession(token: string): SessionUser | null {
  try {
    const json = Buffer.from(token, "base64url").toString("utf-8");
    return JSON.parse(json) as SessionUser;
  } catch {
    return null;
  }
}

export function getSessionFromToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  return decodeSession(token);
}

export { SESSION_COOKIE, encodeSession };
