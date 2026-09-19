# AGENTS.md

Guidance for AI coding agents (and humans) working on this repo.

## What this is

A Telegram bot (Telegraf 4 + Prisma 5 + SQLite, Node 18, TypeScript) for
Pokémon Go players in Singapore. It polls third-party map/API feeds and
notifies subscribed users about raids at their gyms, perfect (100% IV)
spawns near their saved locations, and upcoming events. Single process,
no HTTP server; everything is driven by node-cron schedules in `src/index.ts`.

## Commands

```bash
npm ci                 # install (lockfile is authoritative)
npm run dev            # tsx watch src/index.ts — needs API_TOKEN in .env
npm run build          # prisma generate + tsc -> dist/ (CommonJS)
npm start              # node dist/index.js
npx tsc --noEmit -p .  # type-check only; run this before every commit
npm run smoke          # offline smoke test, no bot token needed (see below)
npm run migrate:dev    # create + apply a migration after editing schema.prisma
npm run studio         # browse dev.db
```

There is no unit-test suite and no linter. `npx tsc --noEmit -p .` is the
gate. `tsconfig` sets `noUnusedLocals` and `noUnusedParameters`: an unused
import or variable fails the build.

`npm run smoke` (`src/scripts/smokeTest.ts`) stubs `bot.telegram.callApi`
and runs every scheduled job against `prisma/dev.db` (gitignored). It hits
the live upstream feeds, so it needs network. Copy your real DB to
`prisma/dev.db` for realistic data.

## Layout

```
src/index.ts            wires everything: session, logging, command
                        registration, cron schedules, graceful stop
src/lib/bot.ts          the Telegraf instance; throws if API_TOKEN unset
src/config.ts           env + tuning constants (search radii, alert minutes)
src/constants.ts        upstream URLs, raid-tier config, links, images
src/types.ts            shapes of upstream feed data + internal message types
src/commands/*.ts       one file per user-facing feature; each exports a
                        function that registers handlers on `bot`
src/utils/*.ts          feed fetching, gym/pokemon matching, notification
                        sending, message formatting, notify windows
src/scripts/*.ts        one-off maintenance scripts (run with tsx)
prisma/schema.prisma    SQLite schema; migrations in prisma/migrations
docs/DEPLOY.md          production deploy runbook
```

## How a command is wired

1. Write `src/commands/<name>.ts` exporting a function that registers
   handlers on `bot` (see `nameGym.ts` for a small wizard, `helper.ts` for
   plain commands).
2. Call that function in `src/index.ts` after `helper()`.
3. Add it to `rawBotCommands` in `src/utils/botCommands.ts` if it should
   appear in Telegram's command menu, and to the `/raids` or `/perfect`
   submenu text in `src/commands/helper.ts`. The menu is synced to Telegram
   on every launch and on `/start`; `npm run updateCommands` is not needed.
4. Register command names in both camelCase and lowercase
   (`bot.command(["renameGym", "renamegym"], …)`) — Telegram lowercases
   commands from the menu but users type camelCase from the help text.

Multi-step flows use Telegraf `Scenes.WizardScene` + a `Stage` created in
the command file. `bot.use(session())` in `index.ts` must run before any
`Stage` middleware. Inline-keyboard choices are wrapped two per row with the
`wrap` callback pattern copied across files. Every wizard step must handle
`/cancel` and a fallback `.use()` that re-prompts.

Reject use outside private chats (`ctx.chat?.type !== "private"`) at the
start of any wizard.

## Data model notes

- `Gym.geoKey` is `lat|lng` rounded to 4 dp (`geoKeyFromLatLng` in
  `gymAdder.ts`) and is the identity used to match upstream raids to
  subscriptions. Never match on `gymString`.
- `Gym.gymString` is nullable: the provider often sends an empty name.
  Users can set it via `/renameGym`, but that is only a stand-in. The
  provider's name is the source of truth: when a raid payload carries a
  non-empty `gym_name`, display that and let `updateGyms` overwrite
  `gymString` with it. Only fall back to `gymString`, then `geoKey`, then
  `id` when the provider sends none.
- `updateGyms` upserts every gym seen in a raid feed, updating
  `lastRaidAt`; `removeStaleGyms` deletes gyms with no raid in
  `GYM_CONFIG.STALE_GYM_DAYS` and no subscribers.
- Raid levels: shadow raids arrive as level 11/13/15 (=1★/3★/5★ shadow),
  mega as 6. `RAID_CONFIG` in `constants.ts` holds the offsets; use the
  helpers in `messageFormatter.ts` rather than re-deriving.
- `NotifyWindow` rows implement `/quietHours`; evaluation lives in
  `utils/notifyWindows.ts` and is always in `Asia/Singapore`.

## Telegram message conventions

- Notifications are sent with `parse_mode: "HTML"`. Anything user- or
  provider-supplied that lands in an HTML message must go through
  `toEscapeHTMLMsg` (`utils/messageHandler.ts`).
- Prefer a native location pin (`ctx.replyWithLocation(lat, long)`) over
  printing coordinates: coordinates in a button label can't be copied or
  opened in a map, and long labels get truncated.
- Inline button labels: keep them short; don't add prefixes like
  "(unnamed)".
- Keep the `/help`, `/raids` and `/perfect` texts in `helper.ts` in sync
  with any command you add or rename.

## Time and scheduling

- The bot is Singapore-only. Cron expressions in `index.ts` assume the
  server clock is SGT; the Wednesday raid-boss scraper passes
  `timezone: "Asia/Singapore"` explicitly. Follow that when adding jobs
  whose timing matters.
- Raid checks run every 10 min 05:00–20:00, every minute 17:44–17:59 on
  Wednesdays (raid hour), perfect checks every 5 min, events hourly at
  :45, stale-gym cleanup 04:00 daily. All startup paths also run once
  immediately.
- Wrap every cron callback body in try/catch and log; an unhandled
  rejection would take the process down.

## Environment

`src/config.ts` reads `.env` via dotenv. Required: `API_TOKEN`
(BotFather token — note the variable is `API_TOKEN`, not `BOT_TOKEN`
despite the error text in `lib/bot.ts`), `OWNER_ID`. Optional:
`LOG_GROUP_ID` (all incoming messages are mirrored here in production),
`DATABASE_URL` (defaults to `file:dev.db`).

Production has **no `.env` file**: env vars are injected externally. Don't
add scripts or docs that assume `.env` exists on the server; anything
needed at deploy time should happen inside the running bot (as the
command-menu sync does) or accept env from the shell.

## Deployment

Production runs `dist/index.js` under PM2 (`docs/DEPLOY.md`, `readme.md`).
The owner can trigger `git pull && npm run build && pm2 reload all` from
Telegram via `/pull`. The server may be air-gapped from this machine;
changes are sometimes shipped as `git bundle` files of `origin/master..master`.

Schema changes: add a migration with `npm run migrate:dev` and commit it;
prod applies with `npx prisma migrate deploy` (or `db push` per readme).

## Style

- Prettier config in `.prettierrc` (double quotes, trailing commas,
  70-col). Match the surrounding file rather than reformatting it.
- Comment sparingly, explaining *why* (e.g. a Telegram quirk), matching
  the existing density.
- Commit messages: conventional prefix (`feat:`, `fix:`, `chore:`) and a
  body that explains the user-visible problem, not just the code change.
- Commit only what was asked; don't push unless asked.
