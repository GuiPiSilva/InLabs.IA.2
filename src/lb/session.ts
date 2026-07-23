const KEY = "inlabs.accessKey";
const ADMIN = "inlabs.adminToken";

export function getAccessKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}
export function setAccessKey(key: string) { localStorage.setItem(KEY, key); }
export function clearAccessKey() { localStorage.removeItem(KEY); }

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN);
}
export function setAdminToken(t: string) { localStorage.setItem(ADMIN, t); }
export function clearAdminToken() { localStorage.removeItem(ADMIN); }

// Local shape check — server does the real validation.
export function validateKey(key: string): boolean {
  return key.trim().length >= 4;
}
