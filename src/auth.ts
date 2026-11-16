import type { Env } from "./env";

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  let s = "";
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time string equality (compares HMACs so lengths don't leak). */
async function safeEqual(secret: string, a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([hmac(secret, a), hmac(secret, b)]);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.min(x.length, y.length); i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export type CookieKind = "kiosk" | "admin";
const COOKIE_NAME: Record<CookieKind, string> = { kiosk: "ts_kiosk", admin: "ts_admin" };
// Chrome caps cookie lifetime at 400 days; the kiosk cookie is refreshed on every page load.
export const KIOSK_MAX_AGE = 400 * 24 * 3600;
export const ADMIN_MAX_AGE = 12 * 3600;

export async function makeCookie(env: Env, kind: CookieKind, maxAge: number, sub = "0"): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const payload = `${kind}.${exp}.${sub}`;
  const value = `${payload}.${await hmac(env.SESSION_SECRET, payload)}`;
  return `${COOKIE_NAME[kind]}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(kind: CookieKind): string {
  return `${COOKIE_NAME[kind]}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/** Returns the signed subject ("0" = the MANAGER_CODE holder, else a managers.id) or null. */
export async function readSignedCookie(req: Request, env: Env, kind: CookieKind): Promise<string | null> {
  const raw = readCookie(req, COOKIE_NAME[kind]);
  if (!raw) return null;
  const parts = raw.split(".");
  // Cookies issued before personal codes were added have no subject: treat as "0" (Alex).
  const [k, exp, sub, sig] = parts.length === 3 ? [parts[0], parts[1], null, parts[2]] : parts;
  if (k !== kind || !exp || !sig) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  const payload = sub === null ? `${k}.${exp}` : `${k}.${exp}.${sub}`;
  if (!(await safeEqual(env.SESSION_SECRET, sig, await hmac(env.SESSION_SECRET, payload)))) return null;
  return sub ?? "0";
}

export async function hasCookie(req: Request, env: Env, kind: CookieKind): Promise<boolean> {
  return (await readSignedCookie(req, env, kind)) !== null;
}

export type Manager = { id: number; name: string; role: "owner" | "manager" | "master" };

/** HMAC of a personal code — what's stored in managers.code_hash. */
export function hashCode(env: Env, code: string): Promise<string> {
  return hmac(env.SESSION_SECRET, `code:${code.trim()}`);
}

/** The signed-in manager for an admin cookie, re-checked against the database so removing access is instant. */
export async function currentManager(req: Request, env: Env): Promise<Manager | null> {
  const sub = await readSignedCookie(req, env, "admin");
  if (sub === null) return null;
  if (sub === "0") return { id: 0, name: env.MANAGER_NAME, role: "master" };
  const row = await env.DB.prepare("SELECT id, name, role FROM managers WHERE id = ? AND active = 1").bind(Number(sub)).first<Manager>();
  return row ?? null;
}

const LOCK_WINDOW_MIN = 15;
const LOCK_AFTER_FAILS = 5;

export type CodeResult = { ok: true; who: Manager } | { ok: false; error: string; status: number };

/**
 * Check a manager code — Alex's MANAGER_CODE secret or anyone's personal code —
 * with a lockout after repeated wrong codes. Returns who the code belongs to.
 */
export async function checkManagerCode(env: Env, code: unknown): Promise<CodeResult> {
  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000).toISOString();
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM code_attempts WHERE ok = 0 AND at > ?").bind(since).first<{ n: number }>();
  if ((row?.n ?? 0) >= LOCK_AFTER_FAILS) {
    return { ok: false, status: 429, error: `Too many wrong manager codes. Try again in ${LOCK_WINDOW_MIN} minutes.` };
  }
  let who: Manager | null = null;
  if (typeof code === "string" && code.trim().length > 0) {
    if (env.MANAGER_CODE && (await safeEqual(env.SESSION_SECRET, code.trim(), env.MANAGER_CODE))) {
      who = { id: 0, name: env.MANAGER_NAME, role: "master" };
    } else {
      who = await env.DB.prepare("SELECT id, name, role FROM managers WHERE code_hash = ? AND active = 1").bind(await hashCode(env, code)).first<Manager>();
    }
  }
  const nowIso = new Date().toISOString();
  await env.DB.prepare("INSERT INTO code_attempts (at, ok) VALUES (?, ?)").bind(nowIso, who ? 1 : 0).run();
  if (!who) return { ok: false, status: 401, error: `That manager code isn't right.` };
  if (who.id) await env.DB.prepare("UPDATE managers SET last_login_at = ? WHERE id = ?").bind(nowIso, who.id).run();
  return { ok: true, who };
}

/** Non-secret UI marker so the manager pages can tell they're open on the kiosk laptop
 * (shows "Back to kiosk" + 5-minute idle logout there only). Not used for access control. */
export function deviceMarkerCookie(): string {
  return `ts_device=kiosk; Path=/; Max-Age=${KIOSK_MAX_AGE}; Secure; SameSite=Lax`;
}
