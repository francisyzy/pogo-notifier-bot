import { Context, MiddlewareFn } from "telegraf";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Don't hit SQLite on every keystroke of a wizard: one write per user per minute
const WRITE_INTERVAL_MS = 60 * 1000;
const lastWrite = new Map<number, number>();

/**
 * Bumps User.lastActivity for whoever sent the update (message, callback
 * button, inline query...). Unknown users are ignored: they get the row
 * created (with lastActivity defaulting to now) by the /start or
 * subscribe upserts. Never blocks the handler chain.
 */
export const trackLastActivity: MiddlewareFn<Context> = (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (telegramId) {
    const now = Date.now();
    if (now - (lastWrite.get(telegramId) ?? 0) >= WRITE_INTERVAL_MS) {
      lastWrite.set(telegramId, now);
      prisma.user
        .updateMany({
          where: { telegramId },
          data: { lastActivity: new Date(now) },
        })
        .catch((error) =>
          console.error("Failed to update lastActivity:", error),
        );
    }
  }
  return next();
};
