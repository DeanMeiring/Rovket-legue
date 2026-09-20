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
  win/loss per player per event. Every player has a profile with career totals and full
  history; there's also a personal "My Performance" page.
- **Roster.** Players grouped by team, with links to Rocket League Tracker profiles.

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
npm run db:push     # create tables from prisma/schema.prisma
npm run db:seed     # create the first admin user from ADMIN_* env vars
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

## Deploying on Railway

1. Create a Railway project, add a **PostgreSQL** plugin, and a service pointing at
   this repo/branch.
2. Set the service's `DATABASE_URL` to the Postgres plugin's connection string
   (Railway does this automatically if they're in the same project).
3. Set `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`), `NEXTAUTH_URL`
   (your Railway domain), `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`, and the
   `SMTP_*` / `EMAIL_FROM` vars.
4. Build command: `npm run build`. Start command: `npm run start`.
5. After the first deploy, run `npm run db:push` and `npm run db:seed` once (Railway's
   one-off command runner, or `railway run`) to create the schema and the first admin.

## Project structure

- `prisma/schema.prisma` — data model (users, teams, events, RSVPs, performance).
- `src/app` — pages and API routes (Next.js App Router).
- `src/lib` — Prisma client, auth config, email, reminder scheduler.
- `src/middleware.ts` — route protection (must be signed in; `/admin/*` requires the
  ADMIN role).
