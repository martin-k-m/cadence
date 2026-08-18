# cadence

*What the app actually computes: how often a thing happens.*

[![CI](https://github.com/martin-k-m/cadence/actions/workflows/ci.yml/badge.svg)](https://github.com/martin-k-m/cadence/actions/workflows/ci.yml)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![live](https://img.shields.io/badge/live-martin--k--m.github.io-brightgreen.svg)](https://martin-k-m.github.io/cadence/)
[![tests](https://img.shields.io/badge/tests-42%20passing-brightgreen.svg)](src/lib)
[![builder](https://img.shields.io/badge/builder-two--way-b45309.svg)](#what-it-does)
[![export](https://img.shields.io/badge/export-Actions%20%C2%B7%20Kubernetes%20%C2%B7%20systemd-b45309.svg)](#what-it-does)
[![warns](https://img.shields.io/badge/warns-OR%20rule%20%C2%B7%20DST%20%C2%B7%20overlap-b45309.svg)](#the-traps-it-warns-about)

Paste a cron expression, read it back in plain English, and see exactly when it
will fire — in the timezone the schedule actually runs in, daylight saving
included.

Runs entirely in the browser.

## What it does

- **A sentence, not a table.** `*/15 9-17 * * 1-5` reads as
  "Every 15 minutes during 09:00 to 17:00, Monday to Friday."
- **The next 24 fire times**, grouped by day, with a live countdown and an
  optional UTC column.
- **A field-by-field breakdown**, plus cadence figures: fire times per active
  day, the typical gap between runs, and how many days a year the schedule is
  active at all.
- **Warnings for the traps**, described below.
- **The last run as well as the next**, so "did it fire?" is answered too.
- **Overlap detection.** Tell it how long the job takes and it compares that
  against the *shortest* gap between runs — a five-minute schedule running an
  eight-minute job piles up, and cron will not warn you.
- **Export to GitHub Actions and Kubernetes**, which differ in an instructive
  way: Kubernetes CronJob has a `timeZone` field and keeps your schedule intact,
  while GitHub Actions is UTC-only. Rather than emit a shifted expression that
  silently breaks at each daylight saving change, cadence keeps the original and
  says so.
- **A two-way builder.** Compose a schedule from controls and it writes the
  expression; type an expression and the controls follow it — unless it says more
  than they can represent, in which case they detach and say so rather than
  showing an approximation you might then edit.
- **systemd timer export**, which surfaces a genuine semantic difference: cron
  fires when *either* day field matches, systemd `OnCalendar` only when *both*
  do. Where that applies, the note says the translation is not equivalent.
- **Permalinks** — the expression and timezone live in the URL fragment.
- **Common schedules** behind `⌘K` / `Ctrl-K`.
- **Precise errors** — `0 25 * * *` reports "hour must be between 0 and 23, got
  25" and highlights the offending field, and a six-field Quartz expression is
  named as such instead of failing vaguely.

## The traps it warns about

**The day fields are OR-ed, not AND-ed.** `0 0 13 * FRI` does not mean "Friday
the 13th". Vixie cron fires when *either* day field matches, so this runs on
every 13th **and** every Friday — 64 days a year rather than one or two.
cadence says so, and the run list shows it.

**Times between 02:00 and 03:00 are not safe.** On the day clocks go forward
that hour does not exist; on the day they go back it happens twice.
cadence resolves each fire time through a real instant and skips the day where
the wall-clock time is missing, rather than silently firing an hour early.

**Days after the 28th do not exist every month.** `0 0 31 * *` skips February
entirely, and four other months besides.

## How the next runs are computed

Days are walked in **local wall-clock terms** and only converted to instants at
the end, which is how cron itself behaves: `0 3 * * *` means 03:00 local,
whatever that happens to be in UTC on a given day. The conversion is verified by
formatting the resulting instant back into the target zone — if the wall clock
does not survive the round trip, that time does not exist locally and is skipped.

The tests in [`cron.test.ts`](src/lib/cron/cron.test.ts) pin this down: wall
clock held steady across a DST change, the missing 02:30 on the spring-forward
day, and `0 0 29 2 *` correctly landing on 2028 and 2032.

## Layout

```
src/
  lib/cron/
    parse.ts     five-field parser, names, steps, macros, the OR rule
    schedule.ts  next fire times in a timezone, cadence, relative times
    describe.ts  the English sentence, field summaries, warnings
    presets.ts   common schedules
    export.ts    GitHub Actions, Kubernetes and systemd snippets
    builder.ts   the schedule shapes the controls can express, both ways
  lib/zones.ts   Intl-based timezone conversion
  components/    expression field, run list, breakdown, palette
```

## Deploy

**Live: <https://martin-k-m.github.io/cadence/>**

Static, client-only and free of environment variables. Every push to `main`
rebuilds and republishes it through the Pages workflow; `next.config.ts` switches
to `output: "export"` with a `/cadence` base path only when `GITHUB_PAGES` is set,
so local development is unaffected.

To host it on Vercel instead:

```bash
npx vercel login
npx vercel link --repo martin-k-m/cadence
npx vercel --prod
```

Or import it through the dashboard:
<https://vercel.com/import/git?s=https://github.com/martin-k-m/cadence>

## Development

```bash
npm install
npm run dev
```

```bash
npm test
npm run typecheck
npm run build
```

## Known limits

- Standard five-field cron only. Quartz extensions (`L`, `W`, `#`, seconds) are
  detected and explained rather than parsed.
- The scan horizon is nine years, which is enough to find the next 29 February
  from any starting point.
- Schedules are previewed, not run. This tells you what your cron daemon *should*
  do; it does not execute anything.

## Licence

MIT.
