# Deployment Guide

This covers deploying the `new-features` branch to a production server.

## Prerequisites

- Node.js 18+
- npm
- PM2 (for process management)
- Network access to GitHub (for `npm install` and `git pull`)

---

## 1. Transfer Code

Transfer the bundle to the server, then extract:

```bash
# On the airgapped/production machine, decode the bundle
base64 -d /path/to/new-features.bundle.b64 > new-features.bundle

# Clone the repo fresh (if not already cloned)
git clone https://github.com/francisyzy/pogo-notifier-bot -b master
cd pogo-notifier-bot

# Create new-features branch and pull from bundle
git checkout -b new-features
git pull new-features.bundle new-features
```

Or if `new-features` already exists locally:
```bash
git fetch /path/to/new-features.bundle new-features:new-features
git checkout new-features
```

---

## 2. Install Dependencies

```bash
npm install
```

This installs all packages including `jsdom` and `@types/jsdom` required by the Wednesday scraper.

---

## 3. Generate Prisma Client

```bash
./node_modules/.bin/prisma generate
```

This regenerates the `@prisma/client` types from the schema, including the new `geoKey String? @unique` field.

---

## 4. Apply Schema to Database

### Fresh database (new deploy)

```bash
./node_modules/.bin/prisma db push
```

This creates all tables. Then seed the gyms:

```bash
npm run seed
```

### Existing database (upgrade from master)

The schema has changed: `Gym` now has a new `geoKey String? @unique` column.

```bash
# Apply the schema change (adds geoKey column as nullable)
./node_modules/.bin/prisma db push
```

Then backfill `geoKey` for all existing gym records:

```bash
npx tsx src/scripts/backfillGeoKey.ts
```

The backfill:
- Calculates `geoKey` from lat/lng for every gym with `geoKey = NULL`
- Uses the same formula as `gymAdder.ts`: `round(lat,4) | round(lng,4)`
- Is **idempotent** — safe to run multiple times
- Skips gyms whose geoKey would collide with an existing gym (duplicate location — manual merge may be needed)

---

## 5. Build

```bash
npm run build
```

This runs `prisma generate` + `tsc` and outputs to `dist/`.

---

## 6. Register Telegram Bot Commands (one-time)

```bash
npx tsx src/scripts/updateCommands.ts
```

This updates the bot's command menu in Telegram so users see the full command list including `/namegym`, `/checkPerfect`, `/checkBoss`, and `/events`.

---

## 7. Start the Bot

```bash
# First time
pm2 start dist/index.js --name POGO-BOT

# After subsequent deploys (or use /pull from Telegram)
pm2 restart POGO-BOT
```

Or use the `/pull` command from Telegram (owner only — requires `OWNER_ID` in `.env`).

---

## 8. Post-Deploy Verification

```bash
# Check bot is running
pm2 status

# Check logs
pm2 logs POGO-BOT --lines 50

# Verify TypeScript build (optional)
npx tsc --noEmit
```

---

## Key Changes from `master`

| Feature | Description |
|---|---|
| `geoKey` | Gyms identified by lat/lng rounded to 4dp, not name. Run backfill script on existing DB. |
| Wednesday scraper | Requires `jsdom` — run `npm install` to get it. |
| Disk cache | `.cache/` directory created automatically on first run. |
| `/pull` command | Owner only (`OWNER_ID`). Executes `git pull && npm run build && pm2 reload all`. |

---

## Environment Variables (`.env`)

```env
API_TOKEN=          # Telegram bot token (required)
OWNER_ID=           # Your Telegram user ID (required for /pull)
LOG_GROUP_ID=       # Optional group chat for production logging
NODE_ENV=production # Required for webhook mode
PORT=               # Webhook port
URL=                # Webhook domain
```

---

## Rolling Back

If something goes wrong, `master` branch has the old code without `geoKey`:

```bash
git checkout master
pm2 restart POGO-BOT
```

The `Gym` table's `geoKey` column added by `prisma db push` is harmless — `master` code simply won't use it.
