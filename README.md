# Rocket League Team Hub

A team management site for tryouts, rosters, events, and performance tracking.

## What it does

- **Tryout signups.** Anyone can request an account with their in-game name, platform,
  and Rocket League Tracker link. Nothing is visible to them until an admin approves it.
- **Admin approval.** Admins review pending signups, approve or reject them, and assign
  approved players to a team.
- **Events.** Admins schedule tryouts, scrims, matches, practices, or meetings. Players
  RSVP (Going / Maybe / Declined). Everyone gets an email when an event is created, and
  another reminder a few hours before it starts.
- **Performance tracking.** Admins log goals, assists, saves, shots, score, MVP, and
  win/loss per player per event — either by hand, or by pasting a ballchasing.com replay
  link (see below) to auto-fill stats for every matched player. Every player has a
  profile with career totals and full history; there's also a personal "My Performance"
  page.
- **Roster.** Players grouped by team, with links to Rocket League Tracker profiles.
- **Tryout team balancing.** Players self-report their current rank at signup (or update
  it later on their profile); admins can also set/override a raw skill number per player.
  The admin panel's "Balance tryout teams" tool then snake-drafts a selected pool of
  players into N teams as evenly matched as possible, and creates the teams in one click.

Messaging is email-only for now (see [`docs/messaging-notes.md`](./docs/messaging-notes.md)
for why, and how to add Telegram later if you want it).

## Tech stack

Next.js 14 (App Router) + TypeScript, Tailwind CSS, Prisma + PostgreSQL, NextAuth
(credentials login), nodemailer for email, node-cron (via `instrumentation.ts`) for the
reminder scheduler. No separate backend — it's one deployable Node service.

## Local development

Prerequisites: Node 20+, a PostgreSQL database.

```bash
cp .env.example .env
# edit .env: set DATABASE_URL to your local Postgres, and ADMIN_* for the first admin

npm install
npx prisma migrate dev   # create tables from prisma/migrations
npm run db:seed          # create the first admin user from ADMIN_* env vars
npm run dev
```

Open http://localhost:3000, sign in with your `ADMIN_USERNAME` / `ADMIN_PASSWORD`, and
you're the first admin. Anyone else who signs up via `/signup` will show up under
**Admin → Pending approvals** for you to approve and assign to a team.

## Email

Reminders and notifications go out over SMTP via `nodemailer`. Set `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in your environment — any
provider works (Gmail app password, SendGrid, Mailgun, Resend's SMTP endpoint, etc).
If `SMTP_HOST` isn't set, the app just logs emails to the console instead of sending
them, so local development works without any email setup.

`REMINDER_LEAD_HOURS` (default `3`) controls how far ahead of an event the reminder
goes out. The scheduler runs inside the app itself via `instrumentation.ts` (checks
every 15 minutes) — no external cron needed. Set `DISABLE_REMINDER_CRON=true` to turn
it off.

## Importing match stats from ballchasing.com

There's no reliable, free way to look up a player's current rank/MMR by username — so
tryout balancing relies on players self-reporting their rank (or an admin setting a raw
number, e.g. from eyeballing their RL Tracker page). Match *performance* stats are a
different story: after a match, upload the replay to
[ballchasing.com](https://ballchasing.com) (free, works with any replay file), then paste
the resulting replay link into that event's page in the admin panel. The app fetches the
parsed replay via ballchasing's API and creates a Performance row for every player whose
in-game name matches an app username or display name — anyone it can't match is listed so
you can log them by hand.

To enable it, set `BALLCHASING_API_KEY`:
1. Log in to https://ballchasing.com/upload with Steam (free).
2. Get your API token from https://ballchasing.com/doc/api (shown at the top once logged in).
3. Set it as `BALLCHASING_API_KEY` in your environment (or Railway variables).

Free-tier rate limits are generous for occasional imports (1000 replay fetches/hour) —
plenty for pulling stats after scrims and tryouts.

## Deploying on Railway

This repo is already wired up to deploy as a Railway project (`rocket-league-team-hub`)
with a Postgres database and a `web` service tracking this branch. To set one up from
scratch, or to understand what's already there:

1. Create a Railway project, deploy the **Postgres** template into it, and add a
   service pointing at this repo/branch.
2. Set the service's `DATABASE_URL` to `${{Postgres.DATABASE_URL}}` (a Railway
   variable reference — resolves automatically since both services are in the same
   project).
3. Set `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`), `NEXTAUTH_URL`
   (your Railway domain), `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`, and the
   `SMTP_*` / `EMAIL_FROM` vars once you have an email provider.
4. Build command: `npm run build` (default). Start command: `npm run start:release` —
   this runs `prisma migrate deploy` (applies the schema) and the admin-seed script
   before starting the server, so both happen automatically on every deploy. If the
   admin user already exists, the seed script resets its password to `ADMIN_PASSWORD`
   (when that variable is set), so to change the admin password, change the Railway
   variable. A password changed inside the app for that account is overwritten on
   the next deploy.
5. Generate a public domain for the service and set `NEXTAUTH_URL` to it (must be set
   before the first real login attempt, since NextAuth uses it for callback URLs).

## Project structure

- `prisma/schema.prisma` — data model (users, teams, events, RSVPs, performance).
- `src/app` — pages and API routes (Next.js App Router).
- `src/lib` — Prisma client, auth config, email, reminder scheduler.
- `src/middleware.ts` — route protection (must be signed in; `/admin/*` requires the
  ADMIN role).
