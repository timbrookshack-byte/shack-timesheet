import { esc } from "./summary";

export const BASE_CSS = `
:root{--ink:#171717;--ink-2:#3f3f46;--muted:#71717a;--line:#e4e4e7;--bg:#fafafa;--card:#fff;--brand:oklch(0.54 0.23 355);--brand-soft:oklch(0.96 0.03 355);--brand-ink:oklch(0.45 0.2 355);--ok:#15803d;--okbg:#dcfce7;--warn:#b91c1c;--radius:18px;--shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.06)}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:"Poppins",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
button,input,select{font:inherit;color:inherit}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:999px;padding:13px 24px;font-weight:600;cursor:pointer;background:var(--ink);color:#fff;text-decoration:none;font-size:15px;letter-spacing:.1px;transition:transform .12s,box-shadow .15s,background .15s,opacity .15s}
.btn:hover{box-shadow:0 6px 18px rgba(0,0,0,.14)}.btn:active{transform:scale(.97)}.btn:disabled{opacity:.4;cursor:default;box-shadow:none;transform:none}
.btn.brand{background:var(--brand)}.btn.brand:hover{box-shadow:0 8px 22px oklch(0.54 0.23 355 / .35)}
.btn.ghost{background:#fff;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line)}.btn.ghost:hover{box-shadow:inset 0 0 0 1.5px var(--ink)}
.btn.big{font-size:20px;padding:20px 38px}
.btn.sm{font-size:13px;padding:8px 16px}
.link{background:none;border:0;color:var(--muted);text-decoration:underline;text-underline-offset:3px;cursor:pointer;font-size:14px;padding:6px}.link:hover{color:var(--ink)}.link:disabled{opacity:.4;cursor:default}
input[type=text],input[type=tel],input[type=password],input[type=time],input[type=date],input[type=number],input[type=search],select{width:100%;padding:13px 16px;border:1.5px solid var(--line);border-radius:12px;background:#fff;font-size:16px;transition:border-color .15s,box-shadow .15s}
input:focus,select:focus{outline:none;border-color:var(--ink);box-shadow:0 0 0 4px rgba(23,23,23,.06)}
label{display:block;font-weight:600;font-size:14px;margin:16px 0 6px}
.err{color:var(--warn);font-weight:500;font-size:14px;margin-top:12px;min-height:1.2em}
.eyebrow{font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--brand)}
`;

export function page(title: string, body: string, extraHead = ""): Response {
  const html = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>${BASE_CSS}</style>${extraHead}</head><body>${body}</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export function devicePage(error = ""): Response {
  return page("Set up sign-in kiosk", `
<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(900px 400px at 80% -10%,oklch(0.54 0.23 355 / .35),transparent 60%),#171717">
  <div style="background:#fff;border-radius:28px;padding:36px;width:min(460px,100%);box-shadow:0 30px 80px rgba(0,0,0,.35)">
    <div class="eyebrow">The Furniture Shack</div>
    <h1 style="margin:8px 0 8px;font-size:26px;letter-spacing:-.02em">Set up this laptop as the sign-in kiosk</h1>
    <p style="color:var(--muted);margin:0 0 8px;font-size:15px">Only the manager can do this. Once set up, this Chrome browser stays signed in as the kiosk — workers can't sign in from their phones or anywhere else.</p>
    <form method="post" action="/device">
      <label for="code">Manager code</label>
      <input id="code" name="code" type="password" inputmode="numeric" autocomplete="off" required autofocus>
      <div class="err">${esc(error)}</div>
      <button class="btn brand" style="width:100%;margin-top:6px;padding:15px">Set up kiosk</button>
    </form>
    <p style="margin:20px 0 0;font-size:14px;text-align:center"><a href="/admin" style="color:var(--muted)">Manager area →</a></p>
  </div>
</div>`);
}

export function kioskPage(managerName: string): Response {
  const head = `<style>
.hero{background:radial-gradient(1200px 400px at 85% -10%,oklch(0.54 0.23 355 / .35),transparent 60%),#171717;color:#fff;padding:28px 40px 84px}
.hero-in{max-width:1240px;margin:0 auto}
.topline{display:flex;justify-content:space-between;align-items:center;gap:16px}
.wordmark{font-weight:700;font-size:15px;letter-spacing:.22em;text-transform:uppercase}
.wordmark i{font-style:normal;color:var(--brand);margin:0 .5em}
.wordmark span{color:#a1a1aa;font-weight:500}
.hero-main{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-top:40px;flex-wrap:wrap}
.hero h1{margin:0;font-size:46px;font-weight:700;line-height:1.08;letter-spacing:-.02em}
.hero h1 em{font-style:normal;color:var(--brand)}
.hero .sub{margin:10px 0 0;color:#a1a1aa;font-size:18px}
.clock{text-align:right}.clock b{display:block;font-size:64px;font-weight:600;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.clock span{color:#a1a1aa;font-size:15px}
.stats{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap}
.stat{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:6px 14px;font-size:13px;color:#e4e4e7}
.dot{width:8px;height:8px;border-radius:50%;background:#71717a;flex:none}.dot.on{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.2)}.dot.done{background:#a1a1aa}
main{max-width:1240px;margin:-48px auto 0;padding:0 40px 60px;position:relative}
.toolbar{background:#fff;border-radius:22px;box-shadow:var(--shadow);padding:12px;display:flex;gap:12px;align-items:center;margin-bottom:28px}
.searchwrap{flex:1;position:relative}
.searchwrap svg{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:var(--muted)}
.searchwrap input{border:0;background:var(--bg);padding:16px 16px 16px 48px;font-size:17px;border-radius:14px}
.searchwrap input:focus{box-shadow:0 0 0 2px var(--ink)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.card{background:#fff;border:0;border-radius:var(--radius);padding:18px;text-align:left;cursor:pointer;box-shadow:var(--shadow);display:flex;gap:14px;align-items:center;transition:transform .15s,box-shadow .15s;position:relative;overflow:hidden}
.card:hover{transform:translateY(-2px);box-shadow:0 2px 4px rgba(0,0,0,.04),0 14px 32px rgba(0,0,0,.1)}.card:active{transform:scale(.98)}
.card.on::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--brand)}
.av{width:52px;height:52px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:17px;background:#f4f4f5;color:var(--ink-2)}
.card.on .av{background:var(--brand-soft);color:var(--brand-ink)}.card.done .av{background:#171717;color:#fff}
.av.xl{width:84px;height:84px;font-size:28px;margin:0 auto 16px;background:var(--brand-soft);color:var(--brand-ink)}
.card .nm{font-size:18px;font-weight:600;line-height:1.25}.card .co{color:var(--muted);font-size:13px;margin-top:1px}
.st{display:flex;align-items:center;gap:7px;margin-top:8px;font-size:13px;font-weight:500;color:var(--muted)}
.card.on .st{color:var(--ok)}
.empty{color:var(--muted);padding:56px 0;text-align:center;font-size:17px}
.overlay{position:fixed;inset:0;background:rgba(10,10,10,.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:16px;z-index:10}
.overlay.open{display:flex;animation:fade .18s ease-out}
.panel{background:#fff;border-radius:28px;padding:40px;width:min(580px,100%);max-height:94vh;overflow:auto;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.3);animation:pop .22s cubic-bezier(.2,.9,.3,1.2)}
@keyframes fade{from{opacity:0}}@keyframes pop{from{opacity:0;transform:translateY(12px) scale(.97)}}
.panel h2{font-size:30px;font-weight:700;letter-spacing:-.02em;margin:0 0 6px}.panel p{font-size:17px;color:var(--ink-2);margin:8px 0}
.panel .row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:22px}
.panel form{text-align:left}
.q{margin-top:26px!important;font-weight:600;color:var(--ink)!important}
.choice{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px}
.choice .btn{min-width:92px}.choice .btn.sel{background:var(--brand);color:#fff;box-shadow:none}
.tick{width:96px;height:96px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;box-shadow:0 0 0 10px var(--brand-soft);animation:pop .35s cubic-bezier(.2,.9,.3,1.4)}
.tick svg{stroke-dasharray:30;stroke-dashoffset:30;animation:draw .4s .15s ease-out forwards}@keyframes draw{to{stroke-dashoffset:0}}
.msg{font-size:20px!important;color:var(--ink)!important;line-height:1.45}
.note{background:#fff7ed;color:#9a3412!important;border-radius:14px;padding:12px 14px;font-size:14px!important;margin-top:16px!important}
.summary{background:var(--bg);border-radius:14px;padding:12px 14px;font-size:15px!important}
.check{display:flex;gap:12px;align-items:flex-start;font-weight:500;font-size:15px;margin-top:18px;background:var(--brand-soft);border-radius:14px;padding:16px;cursor:pointer}
.check input{width:22px;height:22px;flex:none;margin:1px 0 0;accent-color:var(--brand)}
.big-time{font-size:56px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin:4px 0}
@media (max-width:900px){.hero{padding:22px 20px 76px}.hero h1{font-size:34px}.clock b{font-size:44px}main{padding:0 20px 40px}}
</style>`;

  const body = `
<section class="hero"><div class="hero-in">
  <div class="topline"><div class="wordmark">The Furniture Shack<i>/</i><span>Site sign-in</span></div></div>
  <div class="hero-main">
    <div><h1 id="hello">Welcome.</h1><p class="sub">Tap your name to sign in or out.</p>
      <div class="stats"><span class="stat"><span class="dot on"></span><span id="sOn">0 on site</span></span><span class="stat"><span class="dot done"></span><span id="sDone">0 finished today</span></span></div></div>
    <div class="clock"><b id="clock">--:--</b><span id="date"></span></div>
  </div>
</div></section>
<main>
  <div class="toolbar">
    <div class="searchwrap"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="Search your name…" autocomplete="off"></div>
    <button class="btn brand big" id="newBtn" style="font-size:16px;padding:16px 26px">+ I'm new here</button>
  </div>
  <div class="grid" id="grid"></div>
  <div class="empty" id="empty" hidden></div>
</main>
<div class="overlay" id="ov"><div class="panel" id="panel"></div></div>
<script>
var MANAGER = ${JSON.stringify(managerName)};
var workers = [];
var state = {};
var closeTimer = null;

function $(id){ return document.getElementById(id); }
function h(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function nowParts(){
  var d = new Date(Date.now() + 10*3600*1000);
  var hh = d.getUTCHours(), mm = d.getUTCMinutes();
  return { hh: hh, mm: mm, hhmm: (hh<10?"0":"")+hh+":"+(mm<10?"0":"")+mm, nice: ((hh%12)||12)+":"+(mm<10?"0":"")+mm+(hh>=12?"pm":"am") };
}
function tickClock(){
  var p = nowParts();
  $("clock").textContent = p.nice;
  $("date").textContent = new Date().toLocaleDateString("en-AU", { timeZone: "Australia/Brisbane", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  var g = p.hh < 12 ? "Good morning" : p.hh < 17 ? "Good afternoon" : "Good evening";
  $("hello").innerHTML = g + "<em>.</em>";
}

function api(path, body){
  return fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
    .then(function(r){ return r.json().catch(function(){ return { error: "Something went wrong — please try again." }; }).then(function(j){ if (r.status === 401 && !j.error) j.error = "Not authorised"; return j; }); })
    .catch(function(){ return { error: "Can't reach the server — check the internet connection and try again." }; });
}

function load(){
  return api("/api/workers").then(function(j){
    if (j.error) { $("empty").hidden = false; $("empty").textContent = j.error; return; }
    workers = j.workers; render();
  });
}

function initials(w){ return h((w.first_name.charAt(0) + w.surname.charAt(0)).toUpperCase()); }
function render(){
  var on = workers.filter(function(w){ return w.status === "on_site"; }).length, done = workers.filter(function(w){ return w.status === "finished"; }).length;
  $("sOn").textContent = on + " on site"; $("sDone").textContent = done + " finished today";
  var q = $("q").value.trim().toLowerCase();
  var list = workers.filter(function(w){ return !q || (w.first_name + " " + w.surname + " " + w.company).toLowerCase().indexOf(q) >= 0; });
  $("grid").innerHTML = list.map(function(w){
    var cls = w.status === "on_site" ? "on" : w.status === "finished" ? "done" : "";
    var st = w.status === "on_site" ? '<span class="dot on"></span>On site since ' + h(w.arrived)
      : w.status === "finished" ? '<span class="dot done"></span>Finished ' + h(w.finished)
      : '<span class="dot"></span>Not signed in';
    return '<button class="card ' + cls + '" data-id="' + w.id + '"><div class="av">' + initials(w) + '</div><div><div class="nm">' + h(w.first_name) + ' ' + h(w.surname) + '</div><div class="co">' + h(w.company) + '</div><div class="st">' + st + '</div></div></button>';
  }).join("");
  var empty = $("empty");
  empty.hidden = list.length > 0;
  empty.innerHTML = workers.length === 0 ? "No one is registered yet. Tap <b>I'm new here</b> to get started." : "No match for that name. New here? Tap <b>I'm new here</b>.";
}

function open(html){ clearTimeout(closeTimer); $("panel").innerHTML = html; $("ov").classList.add("open"); var f = $("panel").querySelector("[autofocus]"); if (f) f.focus(); }
function close(){ clearTimeout(closeTimer); $("ov").classList.remove("open"); state = {}; $("q").value = ""; load(); }
function err(msg){ var e = $("panel").querySelector(".err"); if (e) e.textContent = msg || ""; }
function busy(on){ $("panel").querySelectorAll("button").forEach(function(b){ b.disabled = on; }); }

function openWorker(w){
  state = { w: w };
  if (w.status === "not_arrived") return showArrive();
  if (w.status === "on_site") return showBreak();
  open('<div class="av xl">' + initials(w) + '</div><h2>Hi ' + h(w.first_name) + '!</h2><p>You signed out today at <b>' + h(w.finished) + '</b>.</p><p>See you next time! If something isn\\'t right, please let ' + h(MANAGER) + ' know.</p><div class="row"><button class="btn" data-act="close">OK</button></div>');
}

function showArrive(){
  var w = state.w;
  open('<div class="av xl">' + initials(w) + '</div><h2>Hi ' + h(w.first_name) + '!</h2><p>Signing you in at</p><div class="big-time" id="arrTime">' + nowParts().nice + '</div>'
    + '<div class="row"><button class="btn brand big" data-act="arrive" autofocus>I\\'ve arrived</button></div>'
    + '<div class="err"></div>'
    + '<div class="row"><button class="link" data-act="close">Not you? Go back</button><button class="link" data-act="ovArrive">Override with manager</button></div>');
}

function showBreak(){
  var w = state.w;
  open('<div class="av xl">' + initials(w) + '</div><h2>Finishing up, ' + h(w.first_name) + '?</h2><p>You arrived at <b>' + h(w.arrived) + '</b>.</p>'
    + '<p class="q">Did you have a break today?</p>'
    + '<div class="choice"><button class="btn big ' + (state.breakTaken === true ? "sel" : "ghost") + '" data-act="breakYes">Yes</button><button class="btn big ' + (state.breakTaken === false ? "sel" : "ghost") + '" data-act="breakNo">No</button></div>'
    + (state.breakTaken === true ? '<p style="margin-top:18px">How long was your break?</p><div class="choice">' + [15,30,45,60,90].map(function(m){ return '<button class="btn ' + (state.breakMins === m ? "sel" : "ghost") + '" data-act="mins" data-m="' + m + '">' + m + ' min</button>'; }).join("") + '</div>' : '')
    + '<div class="err"></div>'
    + '<div class="row"><button class="btn big" data-act="finish"' + (ready() ? "" : " disabled") + '>Finish for the day</button></div>'
    + '<div class="row"><button class="link" data-act="close">Not you? Go back</button><button class="link" data-act="ovFinish"' + (ready() ? "" : " disabled") + '>Override with manager</button></div>');
}
function ready(){ return state.breakTaken === false || (state.breakTaken === true && !!state.breakMins); }

function showOverride(kind){
  state.ov = kind;
  var w = state.w;
  open('<h2>Manager override</h2><p>' + h(w.first_name) + ' ' + h(w.surname) + ' — ' + (kind === "arrive" ? "arrival" : "finish") + ' time today.</p>'
    + '<form id="ovForm"><label for="ovTime">' + (kind === "arrive" ? "Arrival" : "Finish") + ' time</label><input id="ovTime" type="time" required value="' + nowParts().hhmm + '">'
    + '<label for="ovReason">Reason</label><input id="ovReason" type="text" required maxlength="200" placeholder="e.g. Arrived 6:45, forgot to sign in">'
    + '<label for="ovCode">Manager code (' + h(MANAGER) + ')</label><input id="ovCode" type="password" inputmode="numeric" autocomplete="off" required>'
    + '<div class="err"></div><div class="row"><button type="button" class="btn ghost" data-act="back">Cancel</button><button class="btn brand">Save time</button></div></form>');
  $("ovTime").focus();
  $("ovForm").addEventListener("submit", function(e){
    e.preventDefault();
    submit(kind, { time: $("ovTime").value, reason: $("ovReason").value, code: $("ovCode").value });
  });
}

function submit(kind, override){
  busy(true); err("");
  var body = { worker_id: state.w.id };
  if (kind === "finish") { body.break_taken = state.breakTaken; body.break_minutes = state.breakMins || 0; }
  if (override) body.override = override;
  api("/api/" + kind, body).then(function(j){
    busy(false);
    if (j.error) return err(j.error);
    success(j);
  });
}

function success(j){
  open('<div class="tick"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h2>' + h(j.title) + '</h2><p class="msg">' + h(j.message) + '</p>'
    + (j.summary ? '<p class="summary">' + h(j.summary) + '</p>' : '')
    + (j.note ? '<p class="note">' + h(j.note) + '</p>' : '')
    + '<div class="row"><button class="btn" data-act="close" autofocus>Done</button></div>');
  closeTimer = setTimeout(close, j.note ? 15000 : 8000);
}

function showRegister(){
  state = {};
  open('<h2>Welcome! Let\\'s get you set up</h2><p>This only takes a moment, and you\\'ll only need to do it once.</p>'
    + '<form id="regForm" autocomplete="off">'
    + '<div style="display:flex;gap:12px"><div style="flex:1"><label for="fn">First name</label><input id="fn" type="text" required maxlength="40" autocapitalize="words"></div>'
    + '<div style="flex:1"><label for="sn">Surname</label><input id="sn" type="text" required maxlength="40" autocapitalize="words"></div></div>'
    + '<label for="mob">Mobile number</label><input id="mob" type="tel" required placeholder="0412 345 678" maxlength="20">'
    + '<label for="co">Contract company</label><input id="co" type="text" required maxlength="80" list="companies" placeholder="Who do you work for?">'
    + '<datalist id="companies">' + companies().map(function(c){ return '<option value="' + h(c) + '">'; }).join("") + '</datalist>'
    + '<label class="check"><input id="ind" type="checkbox" required><span>I have been inducted and I am aware of the workplace rules and regulations.</span></label>'
    + '<div class="err"></div><div class="row"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn brand">Register &amp; sign in</button></div></form>');
  $("fn").focus();
  $("regForm").addEventListener("submit", function(e){
    e.preventDefault();
    if (!$("ind").checked) return err("Please tick to confirm you've been inducted.");
    busy(true); err("");
    api("/api/workers", { first_name: $("fn").value, surname: $("sn").value, mobile: $("mob").value, company: $("co").value, inducted: $("ind").checked }).then(function(j){
      busy(false);
      if (j.error) return err(j.error);
      workers.push(j.worker);
      state = { w: j.worker };
      showArrive();
    });
  });
}
function companies(){ var seen = {}; return workers.map(function(w){ return w.company; }).filter(function(c){ var k = c.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }).sort(); }

document.addEventListener("click", function(e){
  var card = e.target.closest(".card");
  if (card) { var w = workers.filter(function(x){ return x.id === Number(card.dataset.id); })[0]; if (w) openWorker(w); return; }
  var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
  var act = b.dataset.act;
  if (act === "close") close();
  else if (act === "arrive") submit("arrive");
  else if (act === "ovArrive") showOverride("arrive");
  else if (act === "breakYes") { state.breakTaken = true; showBreak(); }
  else if (act === "breakNo") { state.breakTaken = false; state.breakMins = 0; showBreak(); }
  else if (act === "mins") { state.breakMins = Number(b.dataset.m); showBreak(); }
  else if (act === "finish") submit("finish");
  else if (act === "ovFinish") showOverride("finish");
  else if (act === "back") { if (state.ov === "arrive") showArrive(); else showBreak(); }
});
$("ov").addEventListener("click", function(e){ if (e.target === $("ov")) close(); });
$("q").addEventListener("input", render);
$("newBtn").addEventListener("click", showRegister);

tickClock(); setInterval(function(){ tickClock(); var t = $("arrTime"); if (t) t.textContent = nowParts().nice; }, 1000);
load(); setInterval(function(){ if (!$("ov").classList.contains("open")) load(); }, 60000);
</script>`;
  return page("Site sign-in — The Furniture Shack", body, head);
}
