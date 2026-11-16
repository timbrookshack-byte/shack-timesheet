import type { Env } from "./env";
import { ADMIN_MAX_AGE, checkManagerCode, clearCookie, currentManager, hashCode, makeCookie, type Manager } from "./auth";
import { fmtMobile, normaliseMobile } from "./kiosk";
import { page } from "./pages";
import { esc, loadWeek, renderWeek, sendSummary, weekCsv, weekLabel } from "./summary";
import { addDays, bneDate, bneHHMM, bneToUtcMs, fmtDateAU, fmtDuration, fmtTime, isYmd, weekStart, workedMinutes } from "./time";

const ADMIN_CSS = `<style>
nav{background:#171717;color:#fff;padding:14px 28px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
nav b{margin-right:auto;font-size:13px;letter-spacing:.2em;text-transform:uppercase}nav b i{font-style:normal;color:var(--brand);margin:0 .5em}nav a,nav button{color:#a1a1aa;text-decoration:none;background:none;border:0;cursor:pointer;font-size:15px;padding:0}
nav a:hover,nav button:hover{color:#fff}
.wrap{max-width:1280px;margin:0 auto;padding:20px 24px 60px}
.box{background:#fff;border-radius:20px;padding:24px;box-shadow:var(--shadow);overflow-x:auto}
.bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px}
.bar h1{margin:0;font-size:22px;margin-right:auto}
.flash{background:#dcfce7;color:#15803d;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-weight:600}
.flash.bad{background:#fee2e2;color:#b91c1c}
table.list{border-collapse:collapse;width:100%}table.list th,table.list td{padding:8px;border-bottom:1px solid #eee;text-align:left;font-size:14px}
.muted{color:#666;font-size:13px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
</style>`;

function shell(me: Manager, title: string, content: string, flash?: { msg: string; bad?: boolean }): Response {
  return page(`${title} — Timesheets`, `<nav><b>The Furniture Shack<i>/</i>Timesheets</b><a href="/admin">Weekly hours</a><a href="/admin/workers">Workers</a><a href="/admin/access">${me.role === "manager" ? "My code" : "Access"}</a><span style="color:#71717a;font-size:13px">Signed in as <b style="color:#fff;letter-spacing:0;text-transform:none;font-size:13px;margin:0">${esc(me.name)}</b></span><form method="post" action="/admin/logout" style="margin:0;display:none" class="kiosk-only"><input type="hidden" name="to" value="kiosk"><button>← Back to kiosk</button></form><form method="post" action="/admin/logout" style="margin:0" id="logoutForm"><button>Log out</button></form></nav>
<script>(function(){if(document.cookie.indexOf("ts_device=kiosk")<0)return;document.querySelectorAll(".kiosk-only").forEach(function(e){e.style.display="";});var t;function arm(){clearTimeout(t);t=setTimeout(function(){var f=document.getElementById("logoutForm");var i=document.createElement("input");i.type="hidden";i.name="to";i.value="kiosk";f.appendChild(i);f.submit();},5*60*1000);}["click","keydown","input","scroll","touchstart"].forEach(function(e){document.addEventListener(e,arm,{passive:true});});arm();})();</script>
<div class="wrap">${flash ? `<div class="flash${flash.bad ? " bad" : ""}">${esc(flash.msg)}</div>` : ""}${content}</div>`, ADMIN_CSS);
}

const redirect = (to: string, cookie?: string) => new Response(null, { status: 303, headers: { Location: to, ...(cookie ? { "Set-Cookie": cookie } : {}) } });

function loginPage(managerName: string, error = ""): Response {
  return page("Manager login — Timesheets", `<div style="max-width:420px;margin:12vh auto;padding:0 16px"><div style="background:#fff;border-radius:28px;padding:36px;box-shadow:var(--shadow)"><div class="eyebrow">The Furniture Shack</div>
<h1 style="margin:0 0 6px;font-size:24px">Manager area</h1><p style="color:#666;margin:0">Contractor hours, edits and the weekly summary.</p>
<form method="post" action="/admin/login"><label for="code">Your manager code</label><input id="code" name="code" type="password" inputmode="numeric" autocomplete="off" required autofocus>
<div class="err">${esc(error)}</div><button class="btn" style="width:100%;margin-top:8px">Log in</button></form><p style="margin:20px 0 0;text-align:center;font-size:14px"><a href="/" style="color:var(--muted)">← Back to kiosk</a></p></div></div>`);
}

export async function handleAdmin(req: Request, env: Env, url: URL): Promise<Response> {
  const p = url.pathname;
  const post = req.method === "POST";

  if (p === "/admin/login" && post) {
    const form = await req.formData();
    const res = await checkManagerCode(env, form.get("code"));
    if (!res.ok) return loginPage(env.MANAGER_NAME, res.error);
    return redirect("/admin", await makeCookie(env, "admin", ADMIN_MAX_AGE, String(res.who.id)));
  }
  if (p === "/admin/logout" && post) {
    const to = (await req.formData()).get("to") === "kiosk" ? "/" : "/admin";
    return redirect(to, clearCookie("admin"));
  }

  const me = await currentManager(req, env);
  if (!me) {
    return req.method === "GET" ? loginPage(env.MANAGER_NAME) : redirect("/admin", clearCookie("admin"));
  }

  const weekParam = url.searchParams.get("week");
  const week = weekStart(isYmd(weekParam) ? weekParam : bneDate());

  if (p === "/admin" || p === "/admin/") return weekPage(env, me, week, url.searchParams.get("msg"), url.searchParams.get("bad") === "1");

  if (p === "/admin/export.csv") {
    const d = await loadWeek(env, week);
    return new Response(weekCsv(d), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="contractor-hours-${week}.csv"` } });
  }

  if (p === "/admin/send-summary" && post) {
    const r = await sendSummary(env, week, "manual");
    return redirect(`/admin?week=${week}&msg=${encodeURIComponent(r.ok ? `Summary emailed (${r.detail}).` : `Email failed: ${r.detail}`)}${r.ok ? "" : "&bad=1"}`);
  }

  if (p === "/admin/shift") return post ? saveShift(env, me, await req.formData()) : shiftPage(env, me, url);

  if (p === "/admin/access") return post ? saveAccess(env, me, await req.formData()) : accessPage(env, me, url.searchParams.get("msg"), url.searchParams.get("bad") === "1");

  if (p === "/admin/workers") return workersPage(env, me, url.searchParams.get("msg"));
  const wm = /^\/admin\/workers\/(\d+)$/.exec(p);
  if (wm) return post ? saveWorker(env, me, Number(wm[1]), await req.formData()) : workerPage(env, me, Number(wm[1]));

  return new Response("Not found", { status: 404 });
}

async function weekPage(env: Env, me: Manager, week: string, msg: string | null, bad: boolean): Promise<Response> {
  const d = await loadWeek(env, week);
  const last = await env.DB.prepare("SELECT sent_at, ok, detail FROM summary_runs WHERE week_start = ? ORDER BY id DESC LIMIT 1").bind(week).first<{ sent_at: string; ok: number; detail: string }>();
  const thisWeek = weekStart(bneDate());
  const totalWorkers = d.companies.reduce((n, c) => n + c.workers.length, 0);
  const content = `<div class="bar"><h1>Week of ${weekLabel(d)}</h1>
<a class="btn sm ghost" href="/admin?week=${addDays(week, -7)}">← Previous</a>${week !== thisWeek ? `<a class="btn sm ghost" href="/admin">This week</a>` : ""}<a class="btn sm ghost" href="/admin?week=${addDays(week, 7)}">Next →</a>
<a class="btn sm" href="/admin/export.csv?week=${week}">Download CSV</a>
<form method="post" action="/admin/send-summary?week=${week}" style="margin:0" onsubmit="return confirm('Email this week\\'s summary to ${esc(env.SUMMARY_TO)}?')"><button class="btn sm brand">Email summary</button></form></div>
<p class="muted" style="margin:-6px 0 14px">Total <b>${(d.grandTotal / 60).toFixed(2)} hrs</b> · ${totalWorkers} workers · Click any day to correct it or add a missed shift (every change is logged with a reason). The summary emails automatically every Monday 5:00am to ${esc(env.SUMMARY_TO)}${last ? ` · last sent for this week ${fmtDateAU(bneDate(Date.parse(last.sent_at)))} ${fmtTime(last.sent_at)} — ${last.ok ? "OK" : `failed: ${esc(last.detail)}`}` : ""}.</p>
<div class="box">${renderWeek(d, (id, workerId, date) => (id ? `/admin/shift?id=${id}` : `/admin/shift?worker=${workerId}&date=${date}`))}</div>
<p class="muted" style="margin-top:14px">Missing someone? Workers with no shifts this week aren't listed — add a shift from <a href="/admin/workers">Workers</a>.</p>`;
  return shell(me, "Weekly hours", (week === thisWeek ? await todayPanel(env) : "") + content, msg ? { msg, bad } : undefined);
}

type ShiftRow = { id: number; worker_id: number; work_date: string; arrived_at: string; finished_at: string | null; break_minutes: number; arrived_clicked_at: string; finished_clicked_at: string | null };

async function shiftPage(env: Env, me: Manager, url: URL, error = ""): Promise<Response> {
  const id = Number(url.searchParams.get("id"));
  let shift: ShiftRow | null = null;
  let workerId = Number(url.searchParams.get("worker"));
  let date = url.searchParams.get("date") ?? "";
  if (id) {
    shift = await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first<ShiftRow>();
    if (!shift) return redirect("/admin");
    workerId = shift.worker_id;
    date = shift.work_date;
  }
  if (!isYmd(date)) date = bneDate();
  const worker = await env.DB.prepare("SELECT id, first_name, surname, company FROM workers WHERE id = ?").bind(workerId).first<{ id: number; first_name: string; surname: string; company: string }>();
  if (!worker) return redirect("/admin");

  const { results: history } = shift
    ? await env.DB.prepare("SELECT field, old_value, new_value, reason, source, created_at, changed_by FROM adjustments WHERE shift_id = ? ORDER BY id").bind(shift.id).all<{ field: string; old_value: string | null; new_value: string | null; reason: string; source: string; created_at: string; changed_by: string | null }>()
    : { results: [] };
  const t = (iso: string | null) => (iso ? bneHHMM(Date.parse(iso)) : "");
  const hv = (field: string, v: string | null) => (v === null || v === "" ? "—" : field.endsWith("_at") ? fmtTime(v) : v);

  const content = `<div class="bar"><h1>${shift ? "Edit" : "Add"} shift — ${esc(worker.first_name)} ${esc(worker.surname)}</h1><a class="btn sm ghost" href="/admin?week=${weekStart(date)}">← Back to week</a></div>
<div class="box" style="max-width:640px"><p class="muted" style="margin-top:0">${esc(worker.company)}${shift ? ` · button pressed: in ${fmtTime(shift.arrived_clicked_at)}${shift.finished_clicked_at ? `, out ${fmtTime(shift.finished_clicked_at)}` : ""}` : ""}</p>
<form method="post" action="/admin/shift">
<input type="hidden" name="id" value="${shift?.id ?? ""}"><input type="hidden" name="worker" value="${worker.id}">
<div class="grid2"><div><label>Date</label><input type="date" name="date" value="${date}" ${shift ? "readonly" : "required"}></div><div></div>
<div><label>Arrived</label><input type="time" name="arrived" value="${t(shift?.arrived_at ?? null)}" required></div>
<div><label>Finished <span class="muted">(blank = not signed out)</span></label><input type="time" name="finished" value="${t(shift?.finished_at ?? null)}"></div>
<div><label>Break (minutes)</label><input type="number" name="break" min="0" max="240" value="${shift?.break_minutes ?? 0}"></div><div></div></div>
<label>Reason for the change</label><input type="text" name="reason" required maxlength="200" placeholder="e.g. Forgot to sign out — confirmed with supervisor">
${shift ? `<label class="check" style="font-weight:500"><input type="checkbox" name="delete" value="1" style="width:20px;height:20px"> Delete this shift entirely (e.g. wrong person tapped)</label>` : ""}
<div class="err">${esc(error)}</div><button class="btn" style="margin-top:8px">Save</button></form>
${history.length ? `<h3 style="margin-top:26px">History</h3><table class="list"><tr><th>When</th><th>Change</th><th>Reason</th><th>By</th></tr>${history.map((a) => `<tr><td>${fmtDateAU(bneDate(Date.parse(a.created_at)))} ${fmtTime(a.created_at)}</td><td>${esc(a.field)}: ${esc(hv(a.field, a.old_value))} → ${esc(hv(a.field, a.new_value))}${a.source === "kiosk_override" ? " (kiosk override)" : ""}</td><td>${esc(a.reason)}</td><td>${esc(a.changed_by ?? "—")}</td></tr>`).join("")}</table>` : ""}
</div>`;
  return shell(me, "Shift", content);
}

async function saveShift(env: Env, me: Manager, form: FormData): Promise<Response> {
  const id = Number(form.get("id")) || null;
  const workerId = Number(form.get("worker"));
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200);
  const back = (msg: string) => shiftPage(env, me, new URL(`http://x/admin/shift?${id ? `id=${id}` : `worker=${workerId}&date=${form.get("date")}`}`), msg);
  if (reason.length < 3) return back("Please give a reason for the change.");
  const nowIso = new Date().toISOString();

  const existing = id ? await env.DB.prepare("SELECT * FROM shifts WHERE id = ?").bind(id).first<ShiftRow>() : null;
  if (id && !existing) return redirect("/admin");
  const date = existing ? existing.work_date : String(form.get("date") ?? "");
  if (!isYmd(date)) return back("Please choose a date.");
  const log = (shiftId: number, field: string, oldV: string | null, newV: string | null) =>
    env.DB.prepare("INSERT INTO adjustments (shift_id, worker_id, work_date, field, old_value, new_value, reason, source, created_at, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'admin_edit', ?, ?)").bind(shiftId, workerId, date, field, oldV, newV, reason, nowIso, me.name);

  if (existing && form.get("delete") === "1") {
    await env.DB.batch([env.DB.prepare("DELETE FROM shifts WHERE id = ?").bind(existing.id), log(existing.id, "deleted", `${fmtTime(existing.arrived_at)}–${fmtTime(existing.finished_at) || "?"}`, null)]);
    return redirect(`/admin?week=${weekStart(date)}&msg=${encodeURIComponent("Shift deleted.")}`);
  }

  const arrivedMs = bneToUtcMs(date, String(form.get("arrived") ?? ""));
  if (arrivedMs === null) return back("Please enter the arrival time.");
  const finRaw = String(form.get("finished") ?? "").trim();
  const finishedMs = finRaw ? bneToUtcMs(date, finRaw) : null;
  if (finRaw && finishedMs === null) return back("That finish time isn't valid.");
  if (finishedMs !== null && finishedMs <= arrivedMs) return back("Finish must be after arrival.");
  const brk = Math.max(0, Math.min(240, Math.round(Number(form.get("break")) || 0)));
  if (finishedMs !== null && brk > 0 && brk >= (finishedMs - arrivedMs) / 60_000) return back("The break can't be longer than the shift.");

  // The form only has minute precision: an untouched HH:MM keeps the original (to-the-second) timestamp.
  const sameMinute = (iso: string | null, ms: number | null) => iso !== null && ms !== null && bneHHMM(Date.parse(iso)) === bneHHMM(ms);
  const arrivedIso = existing && sameMinute(existing.arrived_at, arrivedMs) ? existing.arrived_at : new Date(arrivedMs).toISOString();
  const finishedIso = finishedMs === null ? null : existing && sameMinute(existing.finished_at, finishedMs) ? existing.finished_at : new Date(finishedMs).toISOString();

  if (!existing) {
    const dup = await env.DB.prepare("SELECT id FROM shifts WHERE worker_id = ? AND work_date = ?").bind(workerId, date).first<{ id: number }>();
    if (dup) return redirect(`/admin/shift?id=${dup.id}`);
    const row = await env.DB.prepare(
      "INSERT INTO shifts (worker_id, work_date, arrived_at, arrived_clicked_at, finished_at, finished_clicked_at, break_taken, break_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    ).bind(workerId, date, arrivedIso, nowIso, finishedIso, finishedIso ? nowIso : null, finishedIso ? (brk > 0 ? 1 : 0) : null, brk, nowIso).first<{ id: number }>();
    await log(row!.id, "created", null, `${fmtTime(arrivedIso)}–${fmtTime(finishedIso) || "?"}${brk ? `, ${brk}m break` : ""}`).run();
    return redirect(`/admin?week=${weekStart(date)}&msg=${encodeURIComponent("Shift added.")}`);
  }

  const stmts: D1PreparedStatement[] = [];
  if (arrivedIso !== existing.arrived_at) stmts.push(log(existing.id, "arrived_at", existing.arrived_at, arrivedIso));
  if (finishedIso !== existing.finished_at) stmts.push(log(existing.id, "finished_at", existing.finished_at, finishedIso));
  if (brk !== existing.break_minutes) stmts.push(log(existing.id, "break_minutes", String(existing.break_minutes), String(brk)));
  if (!stmts.length) return redirect(`/admin?week=${weekStart(date)}&msg=${encodeURIComponent("No changes.")}`);
  stmts.push(env.DB.prepare("UPDATE shifts SET arrived_at = ?, finished_at = ?, finished_clicked_at = COALESCE(finished_clicked_at, CASE WHEN ? IS NULL THEN NULL ELSE ? END), break_minutes = ?, break_taken = CASE WHEN ? > 0 THEN 1 ELSE COALESCE(break_taken, 0) END WHERE id = ?")
    .bind(arrivedIso, finishedIso, finishedIso, nowIso, brk, brk, existing.id));
  await env.DB.batch(stmts);
  return redirect(`/admin?week=${weekStart(date)}&msg=${encodeURIComponent("Shift updated.")}`);
}

async function workersPage(env: Env, me: Manager, msg: string | null): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT w.*, (SELECT MAX(work_date) FROM shifts s WHERE s.worker_id = w.id) AS last_seen
       FROM workers w ORDER BY w.active DESC, w.company COLLATE NOCASE, w.first_name COLLATE NOCASE`,
  ).all<{ id: number; first_name: string; surname: string; mobile: string; company: string; inducted_at: string; active: number; last_seen: string | null }>();
  const today = bneDate();
  const content = `<div class="bar"><h1>Workers</h1></div><div class="box"><table class="list"><tr><th>Name</th><th>Company</th><th>Mobile</th><th>Inducted</th><th>Last on site</th><th></th></tr>
${results.map((w) => `<tr style="${w.active ? "" : "opacity:.5"}"><td><b>${esc(w.first_name)} ${esc(w.surname)}</b>${w.active ? "" : " <span class='muted'>(hidden from kiosk)</span>"}</td><td>${esc(w.company)}</td><td>${esc(fmtMobile(w.mobile))}</td><td>${fmtDateAU(bneDate(Date.parse(w.inducted_at)))}</td><td>${w.last_seen ? fmtDateAU(w.last_seen) : "—"}</td>
<td style="white-space:nowrap"><a class="btn sm ghost" href="/admin/workers/${w.id}">Edit</a> <a class="btn sm ghost" href="/admin/shift?worker=${w.id}&date=${today}">Add shift</a></td></tr>`).join("") || `<tr><td colspan="6" class="muted">No workers yet — they register themselves at the kiosk.</td></tr>`}
</table></div>`;
  return shell(me, "Workers", content, msg ? { msg } : undefined);
}

async function workerPage(env: Env, me: Manager, id: number, error = ""): Promise<Response> {
  const w = await env.DB.prepare("SELECT * FROM workers WHERE id = ?").bind(id).first<{ id: number; first_name: string; surname: string; mobile: string; company: string; active: number; inducted_at: string }>();
  if (!w) return redirect("/admin/workers");
  const content = `<div class="bar"><h1>${esc(w.first_name)} ${esc(w.surname)}</h1><a class="btn sm ghost" href="/admin/workers">← Workers</a></div>
<div class="box" style="max-width:640px"><p class="muted" style="margin-top:0">Registered &amp; confirmed induction ${fmtDateAU(bneDate(Date.parse(w.inducted_at)))} ${fmtTime(w.inducted_at)}.</p>
<form method="post"><div class="grid2"><div><label>First name</label><input type="text" name="first_name" value="${esc(w.first_name)}" required></div><div><label>Surname</label><input type="text" name="surname" value="${esc(w.surname)}" required></div>
<div><label>Mobile</label><input type="tel" name="mobile" value="${esc(fmtMobile(w.mobile))}" required></div><div><label>Contract company</label><input type="text" name="company" value="${esc(w.company)}" required></div></div>
<label class="check" style="font-weight:500"><input type="checkbox" name="active" value="1" ${w.active ? "checked" : ""} style="width:20px;height:20px"> Show on the kiosk (untick for people who no longer work here — their hours are kept)</label>
<div class="err">${esc(error)}</div><button class="btn" style="margin-top:8px">Save</button></form></div>`;
  return shell(me, "Worker", content);
}

async function saveWorker(env: Env, me: Manager, id: number, form: FormData): Promise<Response> {
  const f = (k: string) => String(form.get(k) ?? "").trim().replace(/\s+/g, " ");
  const mobile = normaliseMobile(f("mobile"));
  if (!f("first_name") || !f("surname") || !f("company")) return workerPage(env, me, id, "Name and company are required.");
  if (!mobile) return workerPage(env, me, id, "Please enter a valid Australian mobile.");
  const clash = await env.DB.prepare("SELECT id FROM workers WHERE mobile = ? AND id != ?").bind(mobile, id).first();
  if (clash) return workerPage(env, me, id, "Another worker already has that mobile number.");
  await env.DB.prepare("UPDATE workers SET first_name = ?, surname = ?, mobile = ?, company = ?, active = ? WHERE id = ?")
    .bind(f("first_name").slice(0, 40), f("surname").slice(0, 40), mobile, f("company").slice(0, 80), form.get("active") === "1" ? 1 : 0, id).run();
  return redirect(`/admin/workers?msg=${encodeURIComponent("Saved.")}`);
}

/** "Who's here right now" — shown above the current week. */
async function todayPanel(env: Env): Promise<string> {
  const today = bneDate();
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.arrived_at, s.finished_at, s.break_minutes, w.first_name, w.surname, w.company
       FROM shifts s JOIN workers w ON w.id = s.worker_id
      WHERE s.work_date = ? ORDER BY s.finished_at IS NOT NULL, s.arrived_at`,
  ).bind(today).all<{ id: number; arrived_at: string; finished_at: string | null; break_minutes: number; first_name: string; surname: string; company: string }>();
  const on = results.filter((r) => !r.finished_at);
  const done = results.filter((r) => r.finished_at);
  const now = Date.now();
  const chip = (r: (typeof results)[number]) => {
    const live = !r.finished_at;
    const mins = live ? Math.max(0, Math.round((now - Date.parse(r.arrived_at)) / 60_000)) : workedMinutes(r.arrived_at, r.finished_at, r.break_minutes) ?? 0;
    return `<a href="/admin/shift?id=${r.id}" style="display:flex;gap:12px;align-items:center;background:${live ? "#f0fdf4" : "var(--bg)"};border-radius:14px;padding:12px 14px;text-decoration:none;color:inherit;min-width:240px;flex:1 1 240px;max-width:340px">
<span style="width:10px;height:10px;border-radius:50%;flex:none;background:${live ? "#22c55e" : "#a1a1aa"}"></span>
<span style="flex:1"><b style="font-size:15px">${esc(r.first_name)} ${esc(r.surname)}</b><br><span class="muted">${esc(r.company)}</span></span>
<span style="text-align:right;font-size:13px">${fmtTime(r.arrived_at)} – ${live ? "now" : fmtTime(r.finished_at)}<br><b>${fmtDuration(mins)}</b>${live ? ' <span class="muted">so far</span>' : ""}</span></a>`;
  };
  return `<div class="box" style="margin-bottom:20px"><div class="bar" style="margin-bottom:12px"><h1 style="font-size:20px">Today — ${fmtDateAU(today)}</h1>
<span class="muted"><b style="color:#15803d">${on.length} on site now</b> · ${done.length} finished</span></div>
${results.length ? `<div style="display:flex;flex-wrap:wrap;gap:10px">${[...on, ...done].map(chip).join("")}</div>` : `<p class="muted" style="margin:0">No one has signed in yet today.</p>`}</div>`;
}

// ── Access: personal codes for owners / managers ───────────────────────────

type ManagerRow = { id: number; name: string; role: "owner" | "manager"; active: number; created_at: string; last_login_at: string | null };

/** Owners manage access. Alex's master code can too, but only until the first owner exists (to bootstrap). */
async function canManageAccess(env: Env, me: Manager): Promise<boolean> {
  if (me.role === "owner") return true;
  if (me.role !== "master") return false;
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM managers WHERE role = 'owner' AND active = 1").first<{ n: number }>();
  return (row?.n ?? 0) === 0;
}

const CODE_RULE = "6–12 digits";

async function validateNewCode(env: Env, code: string, confirm: string, exceptId = 0): Promise<string | null> {
  if (!/^\d{6,12}$/.test(code)) return `Codes must be ${CODE_RULE}.`;
  if (code !== confirm) return "The two codes don't match.";
  if (/^(\d)\1+$/.test(code) || "0123456789012".includes(code) || "9876543210987".includes(code)) return "That code is too easy to guess — avoid repeated or sequential digits.";
  if (env.MANAGER_CODE && code === env.MANAGER_CODE.trim()) return "That code is already in use.";
  const clash = await env.DB.prepare("SELECT id FROM managers WHERE code_hash = ? AND id != ?").bind(await hashCode(env, code), exceptId).first();
  if (clash) return "That code is already in use — choose another.";
  return null;
}

const back = (msg: string, bad = false) => redirect(`/admin/access?msg=${encodeURIComponent(msg)}${bad ? "&bad=1" : ""}`);

const codeInputs = (prefix = "") =>
  `<div class="grid2"><div><label>${prefix ? prefix + "code" : "Code"} <span class="muted">(${CODE_RULE})</span></label><input type="password" name="code" inputmode="numeric" pattern="\\d{6,12}" autocomplete="new-password" required></div>
<div><label>Type it again</label><input type="password" name="confirm" inputmode="numeric" pattern="\\d{6,12}" autocomplete="new-password" required></div></div>`;

async function accessPage(env: Env, me: Manager, msg: string | null, bad: boolean): Promise<Response> {
  const manage = await canManageAccess(env, me);
  const { results } = await env.DB.prepare("SELECT id, name, role, active, created_at, last_login_at FROM managers ORDER BY active DESC, role = 'owner' DESC, name COLLATE NOCASE").all<ManagerRow>();
  const when = (iso: string | null) => (iso ? `${fmtDateAU(bneDate(Date.parse(iso)))} ${fmtTime(iso)}` : "never");
  const roleLabel = (r: string) => (r === "owner" ? "Owner" : "Manager");

  const mine = me.id
    ? `<div class="box" style="max-width:640px;margin-bottom:20px"><h2 style="margin:0 0 4px;font-size:18px">Change my code</h2><p class="muted" style="margin:0">Your code works for the manager area, kiosk overrides and setting up the kiosk laptop.</p>
<form method="post"><input type="hidden" name="action" value="mycode"><label>Current code</label><input type="password" name="current" inputmode="numeric" autocomplete="current-password" required>${codeInputs("New ")}<button class="btn" style="margin-top:14px">Update my code</button></form></div>`
    : "";

  if (!manage) {
    return shell(me, "Access", `<div class="bar"><h1>${me.id ? "My code" : "Access"}</h1></div>${mine || `<div class="box"><p style="margin:0">Only owners can manage access codes. Ask Tim or Shaun.</p></div>`}`, msg ? { msg, bad } : undefined);
  }

  const rows = results.map((m) => `<tr style="${m.active ? "" : "opacity:.5"}"><td><b>${esc(m.name)}</b>${m.id === me.id ? ' <span class="muted">(you)</span>' : ""}</td><td>${roleLabel(m.role)}</td><td>${m.active ? '<span style="color:#15803d;font-weight:600">Active</span>' : "Switched off"}</td><td>${when(m.last_login_at)}</td>
<td style="white-space:nowrap">${m.id === me.id ? "" : `<form method="post" style="display:inline"><input type="hidden" name="action" value="toggle"><input type="hidden" name="id" value="${m.id}"><button class="btn sm ghost">${m.active ? "Switch off" : "Switch on"}</button></form>
<details style="display:inline-block;vertical-align:top;margin-left:6px"><summary class="btn sm ghost" style="list-style:none">Reset code</summary><form method="post" style="margin-top:8px;min-width:280px"><input type="hidden" name="action" value="reset"><input type="hidden" name="id" value="${m.id}">${codeInputs("New ")}<button class="btn sm" style="margin-top:10px">Save new code</button></form></details>`}</td></tr>`).join("");

  const content = `<div class="bar"><h1>Access</h1></div>
${me.role === "master" ? `<div class="flash" style="background:#fff7ed;color:#9a3412">Set up the owners' personal codes here. Once an owner exists, only owners can manage access — ${esc(env.MANAGER_NAME)}'s code keeps working for everything else.</div>` : ""}
<div class="box" style="margin-bottom:20px"><table class="list"><tr><th>Name</th><th>Role</th><th>Status</th><th>Last used</th><th></th></tr>
<tr><td><b>${esc(env.MANAGER_NAME)}</b>${me.id === 0 ? ' <span class="muted">(you)</span>' : ""}</td><td>Manager</td><td><span style="color:#15803d;font-weight:600">Active</span></td><td class="muted">original code — changed in Cloudflare</td><td></td></tr>
${rows}</table>
<p class="muted" style="margin:12px 0 0"><b>Owners</b> can do everything, including managing these codes. <b>Managers</b> can see and correct hours, approve kiosk overrides and change their own code. Switching someone off takes effect immediately, even if they're signed in.</p></div>
<div class="box" style="max-width:640px;margin-bottom:20px"><h2 style="margin:0 0 4px;font-size:18px">Add a person</h2><p class="muted" style="margin:0">Choose their first code and tell them in person — they can change it under <i>Access</i> once signed in.</p>
<form method="post"><input type="hidden" name="action" value="add"><div class="grid2"><div><label>Name</label><input type="text" name="name" required maxlength="40" placeholder="e.g. Shaun"></div>
<div><label>Role</label><select name="role"><option value="owner">Owner</option><option value="manager">Manager</option></select></div></div>${codeInputs()}<button class="btn brand" style="margin-top:14px">Add person</button></form></div>
${mine}`;
  return shell(me, "Access", content, msg ? { msg, bad } : undefined);
}

async function saveAccess(env: Env, me: Manager, form: FormData): Promise<Response> {
  const action = String(form.get("action") ?? "");
  const code = String(form.get("code") ?? "").trim();
  const confirm = String(form.get("confirm") ?? "").trim();

  if (action === "mycode") {
    if (!me.id) return back(`${env.MANAGER_NAME}'s original code is changed in Cloudflare (wrangler secret put MANAGER_CODE).`, true);
    const current = await env.DB.prepare("SELECT id FROM managers WHERE id = ? AND code_hash = ?").bind(me.id, await hashCode(env, String(form.get("current") ?? ""))).first();
    if (!current) return back("Your current code isn't right.", true);
    const err = await validateNewCode(env, code, confirm, me.id);
    if (err) return back(err, true);
    await env.DB.prepare("UPDATE managers SET code_hash = ? WHERE id = ?").bind(await hashCode(env, code), me.id).run();
    return back("Your code has been changed.");
  }

  if (!(await canManageAccess(env, me))) return back("Only owners can manage access.", true);

  if (action === "add") {
    const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    const role = form.get("role") === "manager" ? "manager" : "owner";
    if (!name) return back("Please enter a name.", true);
    const err = await validateNewCode(env, code, confirm);
    if (err) return back(err, true);
    await env.DB.prepare("INSERT INTO managers (name, role, code_hash, active, created_at) VALUES (?, ?, ?, 1, ?)").bind(name, role, await hashCode(env, code), new Date().toISOString()).run();
    return back(`${name} added as ${role === "owner" ? "an owner" : "a manager"}. Tell them their code in person.`);
  }

  const id = Number(form.get("id"));
  const target = await env.DB.prepare("SELECT id, name, active FROM managers WHERE id = ?").bind(id).first<{ id: number; name: string; active: number }>();
  if (!target) return back("Person not found.", true);
  if (target.id === me.id) return back("You can't change your own access here.", true);

  if (action === "toggle") {
    await env.DB.prepare("UPDATE managers SET active = ? WHERE id = ?").bind(target.active ? 0 : 1, id).run();
    return back(`${target.name} ${target.active ? "switched off — their code stops working immediately" : "switched back on"}.`);
  }
  if (action === "reset") {
    const err = await validateNewCode(env, code, confirm, id);
    if (err) return back(err, true);
    await env.DB.prepare("UPDATE managers SET code_hash = ? WHERE id = ?").bind(await hashCode(env, code), id).run();
    return back(`New code saved for ${target.name}. Tell them in person.`);
  }
  return back("Unknown action.", true);
}
