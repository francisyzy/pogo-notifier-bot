# AGENTS.md

Guidance for AI coding agents (and humans) working on this repo.

Pokemon Go Notifier Butler: a Telegram bot for players in Singapore that
notifies users of raids at their gyms, 100% IV ("perfect") spawns and
Legendary/Mythical spawns near their saved locations, and upcoming events
(via ScrapedDuck). Telegraf 4 + Prisma 5 + SQLite, Node 18, TypeScript.
Single process, no HTTP server; everything is driven by node-cron
schedules and intervals in `src/index.ts`.

## Commands

```bash
npm ci                 # install (lockfile is authoritative)
npm run dev            # tsx watch src/index.ts — needs API_TOKEN in .env
npm run build          # prisma generate + tsc -> dist/ (CommonJS)
npm start              # node dist/index.js
npx tsc --noEmit -p .  # type-check only; run before every commit
npm run smoke          # offline smoke test, no bot token needed (see below)
npm run migrate:dev    # create + apply a migration after editing schema.prisma
npm run studio         # browse the SQLite DB
npm run seed           # load prisma/gym_data.json into the DB (fresh installs)
npm run exportGyms     # refresh prisma/gym_data.json from the DB
```

There is no unit-test suite and no linter. `npx tsc --noEmit -p .` is the
gate. `tsconfig` sets `noUnusedLocals`, `noUnusedParameters` and
`noImplicitReturns`: an unused import or variable fails the build.
`prisma/seed.ts` is outside `src/` and not covered; check it with
`npx tsc --noEmit --strict --esModuleInterop --skipLibCheck prisma/seed.ts`.

`npm run smoke` (`src/scripts/smokeTest.ts`) stubs `bot.telegram.callApi`
and runs every scheduled job against `prisma/dev.db` (gitignored). It hits
the live upstream feeds, so it needs network. Copy your real DB to
`prisma/dev.db` for realistic data.

### Build is CommonJS even though `tsconfig.json` says ESNext

`tsconfig.json` (`module: "ESNext"`) is for the IDE and type-checking.
`tsconfig.build.json` extends it with `module: "CommonJS"` and is what
`npm run build` uses. **Do not add `"type": "module"` to `package.json`**:
the build output is CommonJS and ESM mode breaks with
`ReferenceError: exports is not defined`. The entry point is
`dist/index.js`, not `dist/src/index.js`.

A `@/*` → `src/*` path alias exists in `tsconfig.json` but nothing uses
it; keep using relative imports.

## Layout

```
src/index.ts            wires everything: session, logging, command
                        registration, cron schedules, graceful stop
src/lib/bot.ts          the single Telegraf instance; throws if API_TOKEN unset
src/config.ts           env + tuning constants (search radii, alert minutes)
src/constants.ts        upstream URLs, raid-tier config, cron strings, links
src/types.ts            shapes of upstream feed data + internal message types
src/commands/*.ts       one file per user-facing feature; each exports a
                        function that registers handlers on `bot`
src/utils/*.ts          feed fetching, gym/pokemon matching, notification
                        sending, message formatting, notify windows
src/scripts/*.ts        maintenance scripts (run with tsx)
prisma/schema.prisma    SQLite schema; migrations in prisma/migrations
prisma/seed.ts          seeds gyms from prisma/gym_data.json (~2775 gyms)
docs/DEPLOY.md          production deploy runbook (incl. air-gapped hosts)
```

Import `bot` from `src/lib/bot.ts`; never create a second Telegraf
instance.

## Commands: `src/commands/`

| File | Commands |
|---|---|
| `helper.ts` | `/start`, `/help`, `/stats` (owner sees usage totals), `/stopNotifyingMeToday`, `/undoStopNotifyingMeToday`, `/perfect`, `/raids`, `/events`, `/pull` (owner only: git pull + build + pm2 reload) |
| `subscribeGym.ts` | `/gymLocation`, `/gymName` |
| `manageSubscribeGym.ts` | `/manageGyms`, `/myGyms` |
| `nameGym.ts` | `/renameGym` (+ "Name this gym" button after subscribing) |
| `subscribeLocation.ts` | `/addLocation` |
| `manageSubscribeLocation.ts` | `/managePerfect` (change radius / remove), `/myLocations` (list + map cards) |
| `manageRaidLevel.ts` | `/manageRaidLevel` |
| `manageRaidAlertMinutes.ts` | `/manageRaidAlertMinutes` |
| `manageNotifyWindows.ts` | `/quietHours` |
| `location.ts` | `/sendLocation` (ad-hoc nearby raids / perfects) |
| `checkRaid.ts` | `/checkRaid`, `/checkRaid_<gymId>` |
| `checkBoss.ts` | `/currentBoss` |
| `checkPerfect.ts` | `/checkPerfect` |
| `catch-all.ts` | `/cancel`, unknown commands |

### Adding a command

1. Write `src/commands/<name>.ts` exporting a function that registers
   handlers on `bot` (see `nameGym.ts` for a small wizard, `helper.ts` for
   plain commands).
2. Call that function in `src/index.ts` after `helper()`.
3. Add it to `rawBotCommands` in `src/utils/botCommands.ts` if it should
   appear in Telegram's command menu, and to the `/raids` or `/perfect`
   submenu text and `/help` in `src/commands/helper.ts`. The menu is
   synced to Telegram on every launch and on `/start`, so
   `npm run updateCommands` is no longer needed (the script remains for
   local use; it needs `API_TOKEN` in the shell).
4. Register command names in both camelCase and lowercase
   (`bot.command(["renameGym", "renamegym"], …)`): Telegram lowercases
   commands from the menu but users type camelCase from the help text.

Multi-step flows use Telegraf `Scenes.WizardScene` + a `Stage` created in
the command file. `bot.use(session())` in `index.ts` must run before any
`Stage` middleware. Inline-keyboard choices are wrapped two per row with the
`wrap` callback pattern copied across files. Every wizard step must handle
`/cancel` and have a fallback `.use()` that re-prompts. Reject use outside
private chats (`ctx.chat?.type !== "private"`) at the start of any wizard.

## Utilities: `src/utils/`

- `getMaper.ts`: fetches raids/pokemon from SGPokeMap and events/bosses
  from ScrapedDuck. URLs in `src/constants.ts`; `BACKUP_URLS` holds a
  fallback for raid bosses (events have none). `getRaidFeed` returns
  `{ raids, weathers }` from one `raids.php` call; `getRaids` is a
  wrapper that drops `weathers`. Fetch once and pass `weathers` down.
- `gymChecker.ts`: matches active raids to subscribed gyms by geoKey;
  `gymCheckerAdHoc` for ad-hoc gym lists. Owns `resolveGymName`. Both
  take the feed's `weathers` as an optional last argument and fill
  `raidMessage.lat/long/cellId/weatherId` (weather is `undefined`
  without it).
- `s2.ts`: `latLngToS2CellId(lat, lng, level = 10)`, a dependency-free
  port of Google S2's lat/lng → cell id (BigInt, decimal string as the
  feed uses). Only ever needed at level 10 (weather cells).
- `weather.ts`: `GAME_WEATHER` (in-game weather ids 1–7 → name/emoji),
  `weatherIdFromName` (ScrapedDuck `boostedWeather[].name` → id),
  `buildWeatherCells`/`weatherAt` (feed `weathers` → weather at a
  point, via the raid's `cell_id` or a locally computed cell when the
  feed sends `cell_id: null`).
- `gymAdder.ts`: `geoKeyFromLatLng`; `updateGyms` upserts every gym seen
  in a raid feed (sets `lastRaidAt`); `removeStaleGyms`.
- `notifier.ts`: `notifyAndUpdateUsers` main raid loop; schedules reminder
  `setTimeout`s, `clearAllRaidReminders` clears them on shutdown.
- `perfectNotifier.ts`: `notifyPerfect`, `notifyLegendary`.
- `perfectChecker.ts`: matches spawns to `LocationSubscribe` rows using
  each row's `radiusMeters`; `perfectCheckerAdHoc` for `/sendLocation`.
- `geo.ts`: `distanceMeters` (haversine), `formatDistance` ("250 m" /
  "1.5 km"), radius presets/limits, `mapsLink`.
- `lastActivity.ts`: `trackLastActivity` middleware (see Data model).
- `lastLocation.ts`: `rememberLastLocation` (fire-and-forget, called from
  every `on("location")` handler), `sortByDistance`/`distanceSuffix` and
  `subscribedGymsByDistance` for nearest-first gym/location lists.
- `eventNotifier.ts`: `notifyEvent`.
- `notifyWindows.ts`: `/quietHours` evaluation, always in `Asia/Singapore`.
- `messageFormatter.ts`: HTML message building; `raidMessageFormatter`,
  `bossCount`, shadow/mega tier helpers, `bossCpLine`/`bossCpRange`/
  `isBossBoosted` (the one 100% IV CP range that applies given the
  weather at the gym, tagged `⚡ boosted (🌧 rainy)` when boosted; never
  both ranges). `perfectMessageFormatter` tags a spawn whose own
  `weather` (WeatherBoostedCondition, 0 = none) is a `GAME_WEATHER` id.
- `messageHandler.ts`: `toEscapeHTMLMsg` (HTML) and `toEscapeMsg`
  (MarkdownV2).
- `botCommands.ts`: source of truth for the Telegram command menu.
- `legacy_converter.ts`: `convertBackToArray` for the comma-separated
  `User.raidLevelNotify` string.
- `raidBossScraper.ts`, `cache.ts`: Wednesday raid-boss scrape and the
  on-disk cache under `.cache/`.

## Data model (`prisma/schema.prisma`)

- **User**: `telegramId` PK, `raidLevelNotify` (comma-separated string,
  e.g. `"1, 3, 5"`; convert with `convertBackToArray`), `raidAlertMinutes`,
  `stopNotifyingMeToday`, stats counters. `lastActivity` is bumped by the
  `trackLastActivity` middleware (`src/utils/lastActivity.ts`, registered
  in `index.ts` right after `session()`, throttled to one write per user
  per minute). `lastLat`/`lastLong`/`lastLocationAt` are the last pin the
  user sent (any location message; set by `rememberLastLocation` in
  `src/utils/lastLocation.ts`) and drive the nearest-first ordering and
  ` · 350 m` suffixes in `/myGyms`, `/manageGyms`, `/renameGym`,
  `/checkRaid`, `/myLocations` and `/managePerfect`; all three are NULL
  until the user sends a location, and lists then keep insertion order
  with no distance. Quiet hours live in `NotifyWindow`.
- **Gym**: `id` UUID, `geoKey` (`lat|lng` rounded to 4 dp, unique,
  nullable for pre-backfill rows), `gymString` (nullable), `lat`/`long`,
  `lastRaidAt`.
- **GymSubscribe**: composite PK `[userTelegramId, gymId]`.
- **GymEvent**: composite PK `[eventTime, gymSubscribeGymId,
  gymSubscribeUserTelegramId]`; dedup for raid notifications.
- **LocationSubscribe**: `locationId` UUID, `lat`/`long`, `radiusMeters`
  (user-chosen, 50–5000 m, default 100). Matching is great-circle
  distance via `distanceMeters` in `src/utils/geo.ts`, not a lat/long box.
- **LocationEvent**: composite PK `[locationSubscribeLocationId,
  eventTime]`; dedup for spawn notifications.
- **NotifyWindow**: per-user (optionally per-gym, per-kind) ALLOW/BLOCK
  windows for `/quietHours`.

### Rules

- Match raids to gyms on `geoKey` (`geoKeyFromLatLng`), never on name.
  Use `resolveGeoKey` in `gymChecker.ts` to tolerate rows whose `geoKey`
  is still NULL.
- **Gym names: the provider is the source of truth.** `Gym.gymString` is
  only a user-supplied stand-in (`/renameGym`) for gyms whose raid payload
  has an empty `gym_name`. Display order is provider name → `gymString` →
  `geoKey` → `id`. A non-empty provider name overwrites `gymString` in
  `updateGyms`; a blank one never does. Anything that renders a gym must
  handle `gymString` being null.
- **Dedup pattern**: `GymEvent`/`LocationEvent` rows are created with an
  `eventTime` in the PK. `P2002` from `prisma.*.create` means "already
  notified" and is the normal path, not an error.
- `removeStaleGyms` deletes gyms with no raid in
  `GYM_CONFIG.STALE_GYM_DAYS` (or `lastRaidAt` NULL) and no subscribers;
  anything that creates a `Gym` row should set `lastRaidAt`.
- Raid levels from upstream: shadow raids are 11/13/15 (= 1★/3★/5★
  shadow), mega is 6. Use `RAID_CONFIG` and the helpers in
  `messageFormatter.ts` rather than re-deriving.

### Prisma

- Version `^5.17.0`. Use `./node_modules/.bin/prisma` rather than
  `npx prisma` on servers: `npx` may resolve a newer version whose query
  engine isn't cached (matters on air-gapped hosts; see `docs/DEPLOY.md`
  for pre-caching the engine binary).
- SQLite at `file:dev.db`, resolved relative to `prisma/schema.prisma`, so
  the runtime DB is `prisma/dev.db`. No `DATABASE_URL` needed.
- Schema change: edit `schema.prisma`, `npm run migrate:dev --name <x>`,
  commit the migration, `npm run build` (regenerates the client). Prod
  applies with `npx prisma migrate deploy`; `db push` also works for a
  DB that has never been migrated.
- `src/scripts/backfillGeoKey.ts` fills `geoKey` on pre-geoKey rows; fresh
  installs don't need it (`npm run seed` sets it).

## Telegram message conventions

- Notifications are sent with `parse_mode: "HTML"`. Anything user- or
  provider-supplied that lands in an HTML message must go through
  `toEscapeHTMLMsg`.
- Prefer a native location pin (`ctx.replyWithLocation(lat, long)`) over
  printing coordinates: coordinates in a button label can't be copied or
  opened in a map.
- Inline button labels: keep them short; long labels get truncated, so no
  prefixes like "(unnamed)".
- Keep `/help`, `/raids` and `/perfect` in `helper.ts` in sync with any
  command you add or rename.

## Time and scheduling

The bot is Singapore-only. Cron strings in `index.ts` assume the server
clock is SGT; the Wednesday scraper passes `timezone: "Asia/Singapore"`
explicitly. Do the same for any new job whose timing matters.

| Job | Schedule | Notes |
|---|---|---|
| `notifyAndUpdateUsers` (raids) | `*/10 5-20 * * *` | every 10 min, 05:00–20:59 |
| `notifyAndUpdateUsers` (raid hour) | `44-59 17 * * 3` | every minute Wed 17:44–17:59 |
| `notifyPerfect` | `setInterval` 5 min | |
| `notifyLegendary` | `setInterval` 5.5 min | |
| `notifyEvent` | `45 0-23 * * *` | hourly at :45 |
| `removeStaleGyms` | `0 4 * * *` | daily 04:00 |
| Wednesday boss scrape | `13 6 * * 3`, `14 7 * * 3` SGT | `WEDNESDAY_SCRAPE_CRON` in `constants.ts`; rotation is 06:00 |

All of these also run once at startup. Wrap every cron/interval body in
try/catch (or `.catch`) and log; an unhandled rejection takes the process
down. SIGINT/SIGTERM handlers stop the scraper and clear raid reminders.

When testing locally, note that raid checks don't fire at night; call the
function directly or use `npm run smoke`.

## Environment & config

`src/config.ts` reads `.env` via dotenv. Required: `API_TOKEN` (BotFather
token; the variable is `API_TOKEN` even though `lib/bot.ts` says
`BOT_TOKEN` in its error), `OWNER_ID`. Optional: `LOG_GROUP_ID` (in
production, every non-owner incoming message is mirrored there),
`DATABASE_URL`, `PORT`, `URL`.

Hardcoded tunables in `config.ts`: `eventBuffer`, `raidAlertMinutes`,
`gymRange: 0.003`, `perfectAdHocRange: 0.003`. **These radii are lat/long
deltas in degrees, not metres** (~111 m per 0.001°). Perfect-spawn
subscriptions don't use them: each `LocationSubscribe` has its own
`radiusMeters`.

Production has **no `.env` file**: env vars are injected externally. Don't
add scripts or docs that assume `.env` exists on the server; anything
needed at deploy time should happen inside the running bot (as the
command-menu sync does) or accept env from the shell.

## Deployment

Production runs `dist/index.js` under PM2 (`docs/DEPLOY.md`, `readme.md`).
The owner can trigger `git pull && npm run build && pm2 reload all` from
Telegram via `/pull`. The server may be air-gapped from the dev machine;
changes are shipped as `git bundle` files of `origin/master..master`.

## Style

- Prettier config in `.prettierrc` (double quotes, trailing commas,
  70-col). Match the surrounding file rather than reformatting it.
- Comment sparingly, explaining *why* (e.g. a Telegram quirk), matching
  the existing density.
- Commit messages: conventional prefix (`feat:`, `fix:`, `chore:`,
  `docs:`) and a body that explains the user-visible problem, not just the
  code change.
- Commit only what was asked; don't push unless asked.

## Before claiming a change works

- `npx tsc --noEmit -p .` passes; `npm run build` if you touched config.
- Schema touched: migration committed, `npm run build` regenerated the
  client, `npm run smoke` still passes.
- New command: registered in `index.ts`, listed in `botCommands.ts`,
  mentioned in the relevant help text, camelCase + lowercase names.
- Anything rendering a gym name copes with `gymString` null and is
  HTML-escaped.
