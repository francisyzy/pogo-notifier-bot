# Pogo-notifier-bot

Pokemon Go Notification bot that notifies users of raids and 100% IV spawns based on their config. Also notifies of events (via [ScrapedDuck](https://github.com/bigfoott/ScrapedDuck)).

## Built with

- Telegraf
- Prisma
- SQLite
- Node.js 18+

## Deployment

### First-time setup

1. Clone the repo and install dependencies:

   ```bash
   git clone <repo-url>
   cd pogo-notifier-bot
   npm ci
   ```

2. Create `.env` with required variables (see `.env.example`):

   ```
   BOT_TOKEN=your_telegram_bot_token
   OWNER_ID=your_telegram_user_id
   ```

3. Build and create the database:

   ```bash
   npm run build
   npx prisma db push
   ```

4. (Optional) Seed gyms from `prisma/gym_data.json`:

   ```bash
   npm run seed
   ```

5. Start the bot (e.g. with PM2):

   ```bash
   pm2 start dist/index.js --name POGO-BOT
   ```

   For PM2, set env vars in your ecosystem config or `.env`. SQLite uses `file:dev.db` (no `DATABASE_URL` needed).

### Updating

```bash
cd pogo-notifier-bot
git pull
npm ci
npm run build
npx prisma db push   # only if schema changed
pm2 restart POGO-BOT
```

## Development

```bash
npm install
npm run dev
```

Runs with tsx watch. SQLite database is created at `dev.db` on first run.

## Deployment troubleshooting

### `ReferenceError: exports is not defined in ES module scope`

The build outputs **CommonJS**. If your `package.json` has `"type": "module"`, Node treats `.js` files as ESM and `exports` is undefined. **Remove** `"type": "module"` from `package.json` for production.

### `P5010` or Prisma connection errors

This project uses SQLite with `file:dev.db`. Ensure:

- `prisma/schema.prisma` has `provider = "sqlite"` and `url = "file:dev.db"` (or an absolute path like `file:/home/tg/pogo-notifier-bot/dev.db`)
- No `DATABASE_URL` pointing to Prisma Data Proxy (`prisma://`) or PostgreSQL
- Run `npx prisma db push` after schema changes

### Wrong entry path

The built entry point is `dist/index.js` (not `dist/src/index.js`). Update PM2 or your start script to use `dist/index.js`.
