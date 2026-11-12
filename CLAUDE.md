# Shack Timesheet — CLAUDE.md

Contractor sign-in/sign-out kiosk for The Furniture Shack warehouse. It runs on one
laptop in Chrome. Management uses it to check the hours contract companies bill
against the hours workers were actually on site. It is a separate system from the trade portal
and Shack360: it has its own database and shares no code with them.
See `README.md` for features, deploy steps and file layout.

## Stack

- Cloudflare Worker (`src/index.ts`) + **D1** (`DB` binding). No framework, no
  build step: server-rendered HTML strings and vanilla inline JS (`src/pages.ts`).
- Resend for the weekly email (same account as the trade portal).
- Cron `0 19 * * SUN` UTC = **Monday 5:00am Brisbane**, which emails the previous Mon–Sun
  to `SUMMARY_TO`. Sends are recorded in `summary_runs`, so a cron retry never double-sends.

## Rules

- **Times the workers can't edit.** Arrival and finish are taken from the server
  clock. The only ways to change them are (a) a kiosk "Override with manager",
  which needs `MANAGER_CODE`, or (b) a manager edit in `/admin`. Both require a reason and BOTH
  write an `adjustments` row. Never add a path that changes shift times
  without logging an adjustment.
- The kiosk only works on the device that has the signed `ts_kiosk` cookie (set at
  `/device` with the manager code). Keep the kiosk API behind that check.
- The manager-code check goes through `checkManagerCode` (it enforces the lockout):
  5 wrong codes in 15 min locks entry for 15 min.
- **Timezone: Australia/Brisbane (UTC+10, no DST)**. Use the helpers in `src/time.ts`.
  `work_date` is the Brisbane date, and timestamps are stored as ISO UTC.
- Hours worked = finish − arrival − break. Shifts with no sign-out are excluded
  from totals and flagged.
- Australian formats: DD/MM/YYYY, 0412 345 678 mobiles (stored normalised `04XXXXXXXX`).
- The kiosk is shown on a laptop, so keep tap targets big and copy friendly. The CSS for
  the email table is inline because the same renderer (`renderWeek`) feeds both the email and `/admin`.
- Migrations in `migrations/` are append-only. Never edit an applied one.

## Commands

- `npm run dev` — local (`cp .dev.vars.example .dev.vars`, `npm run db:migrate:local` first;
  add `--test-scheduled` to fire the cron via `/__scheduled`).
- `npm run typecheck` · `npm run deploy` · `npm run db:migrate` (remote D1).
- Secrets: `MANAGER_CODE`, `SESSION_SECRET`, `RESEND_API_KEY` (`wrangler secret put`).
