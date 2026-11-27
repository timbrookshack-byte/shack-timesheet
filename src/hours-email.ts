import type { Env } from "./env";
import { json } from "./kiosk";
import { esc } from "./summary";
import { addDays, bneDate, DAY_NAMES, dayOfWeek, decimalHours, fmtDateAU, fmtDuration, fmtTime, weekStart, workedMinutes } from "./time";

// "Send me my hours" — a worker emails themselves this week's shifts from the
// kiosk's sign-out screen. Tolerates migration 0003 not having run yet
// (deploys are automatic; the migration is applied by hand).

const MAX_SENDS_PER_DAY = 3;

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

const isMissingSchema = (e: unknown) => /no such (column|table)/i.test(String((e as Error)?.message ?? e));

/** The worker's saved email, or null (also null if the email column doesn't exist yet). */
export async function workerEmail(env: Env, workerId: number): Promise<string | null> {
  try {
    const row = await env.DB.prepare("SELECT email FROM workers WHERE id = ?").bind(workerId).first<{ email: string | null }>();
    return row?.email ?? null;
  } catch (e) {
    if (isMissingSchema(e)) return null;
    throw e;
  }
}

/** Saves an email on the worker; returns false if the column isn't there yet. */
export async function saveWorkerEmail(env: Env, workerId: number, email: string | null): Promise<boolean> {
  try {
    await env.DB.prepare("UPDATE workers SET email = ? WHERE id = ?").bind(email, workerId).run();
    return true;
  } catch (e) {
    if (isMissingSchema(e)) return false;
    throw e;
  }
}

export function emailEnabled(env: Env): boolean {
  return !!env.RESEND_API_KEY;
}

type Row = { work_date: string; arrived_at: string; finished_at: string | null; break_minutes: number; adjusted: number };

function hoursHtml(first: string, company: string, start: string, today: string, rows: Row[]): { html: string; total: number } {
  const TD = "padding:8px 10px;border-bottom:1px solid #e5e5e5;font-size:14px;white-space:nowrap";
  const TH = "padding:8px 10px;border-bottom:2px solid #171717;font-size:12px;text-align:left;text-transform:uppercase;letter-spacing:.04em;color:#555";
  let total = 0;
  const body = rows.map((r) => {
    const worked = workedMinutes(r.arrived_at, r.finished_at, r.break_minutes);
    if (worked !== null) total += worked;
    return `<tr><td style="${TD}"><b>${DAY_NAMES[dayOfWeek(r.work_date)]}</b> ${fmtDateAU(r.work_date)}</td><td style="${TD}">${fmtTime(r.arrived_at)}</td>
<td style="${TD}">${r.finished_at ? fmtTime(r.finished_at) : '<span style="color:#b91c1c">not signed out</span>'}</td><td style="${TD}">${r.break_minutes ? `${r.break_minutes} min` : "none"}</td>
<td style="${TD};text-align:right"><b>${worked !== null ? fmtDuration(worked) : "—"}</b>${r.adjusted ? '<br><span style="color:#a21caf;font-size:12px">adjusted by manager</span>' : ""}</td></tr>`;
  }).join("");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#171717;max-width:640px">
<p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#c8187a;font-weight:700;margin:0 0 6px">The Furniture Shack</p>
<h2 style="margin:0 0 6px">Hi ${esc(first)}, here are your hours</h2>
<p style="margin:0 0 16px;color:#444">Week of ${fmtDateAU(start)} – ${fmtDateAU(today)}, as recorded at our site sign-in.</p>
<table style="border-collapse:collapse;width:100%"><tr><th style="${TH}">Day</th><th style="${TH}">In</th><th style="${TH}">Out</th><th style="${TH}">Break</th><th style="${TH};text-align:right">Hours</th></tr>${body}
<tr><td colspan="4" style="padding:12px 10px;font-weight:700">Total this week</td><td style="padding:12px 10px;text-align:right;font-weight:700;font-size:16px">${fmtDuration(total)}<br><span style="font-weight:400;color:#555;font-size:13px">${decimalHours(total)} hrs</span></td></tr></table>
<p style="margin:18px 0 0;color:#555;font-size:13px">Hours = sign-out − sign-in − break. Use these when you fill in your timesheet for ${esc(company)}. If anything looks wrong, please let the manager know.</p>
<p style="margin:16px 0 0;color:#999;font-size:11px">Sent at your request from The Furniture Shack site sign-in kiosk.</p></div>`;
  return { html, total };
}

/** POST /api/my-hours { worker_id, email } — from the kiosk's sign-out screen. */
export async function sendMyHours(env: Env, body: Record<string, unknown>): Promise<Response> {
  if (!emailEnabled(env)) return json({ error: "Email isn't set up yet — please ask the manager." }, 503);
  const id = body.worker_id;
  if (typeof id !== "number" || !Number.isInteger(id)) return json({ error: "Bad request" }, 400);
  const email = normaliseEmail(body.email);
  if (!email) return json({ error: "Please enter a valid email address." }, 400);

  const worker = await env.DB.prepare("SELECT id, first_name, company FROM workers WHERE id = ? AND active = 1").bind(id).first<{ id: number; first_name: string; company: string }>();
  if (!worker) return json({ error: "We couldn't find you — please refresh and try again." }, 404);

  const today = bneDate();
  // Only right after signing out today, so the kiosk can't be used to email anyone's hours at any time.
  const done = await env.DB.prepare("SELECT 1 FROM shifts WHERE worker_id = ? AND work_date = ? AND finished_at IS NOT NULL").bind(id, today).first();
  if (!done) return json({ error: "You can send your hours after you've signed out for the day." }, 409);

  const dayStartIso = new Date(Date.now() - 24 * 3600_000).toISOString();
  try {
    const sent = await env.DB.prepare("SELECT COUNT(*) AS n FROM hours_emails WHERE worker_id = ? AND sent_at > ?").bind(id, dayStartIso).first<{ n: number }>();
    if ((sent?.n ?? 0) >= MAX_SENDS_PER_DAY) return json({ error: "You've already sent your hours a few times today — please check your inbox (and junk folder)." }, 429);
  } catch (e) {
    if (isMissingSchema(e)) return json({ error: "This feature is still being set up — please ask the manager." }, 503);
    throw e;
  }

  const start = weekStart(today);
  const { results } = await env.DB.prepare(
    `SELECT s.work_date, s.arrived_at, s.finished_at, s.break_minutes,
            EXISTS (SELECT 1 FROM adjustments a WHERE a.shift_id = s.id) AS adjusted
       FROM shifts s WHERE s.worker_id = ? AND s.work_date BETWEEN ? AND ? ORDER BY s.work_date`,
  ).bind(id, start, addDays(start, 6)).all<Row>();
  const { html, total } = hoursHtml(worker.first_name, worker.company, start, today, results);

  const res = await fetch(`${env.RESEND_BASE_URL || "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject: `Your hours this week — ${decimalHours(total)} hrs (The Furniture Shack)`, html }),
  });
  const ok = res.ok;
  const detail = ok ? null : `Resend ${res.status}: ${(await res.text()).slice(0, 200)}`;
  await env.DB.prepare("INSERT INTO hours_emails (worker_id, email, week_start, sent_at, ok, detail) VALUES (?, ?, ?, ?, ?, ?)").bind(id, email, start, new Date().toISOString(), ok ? 1 : 0, detail).run();
  if (!ok) {
    console.error("my-hours email:", detail);
    return json({ error: "Sorry, the email couldn't be sent just now. Please try again or let the manager know." }, 502);
  }
  await saveWorkerEmail(env, id, email); // remember (or update) it for next time
  return json({ ok: true, message: `Sent to ${email} — check your inbox.` });
}
