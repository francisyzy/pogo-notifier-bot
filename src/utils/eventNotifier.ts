import { addMinutes, isWithinInterval, subMinutes } from "date-fns";
import bot from "../lib/bot";
import { getEvents } from "./getMaper";
import config from "../config";
import { rawEvent } from "../types";
import { toEscapeHTMLMsg } from "./messageHandler";
import { createLogger, sgtTimestamp } from "./logger";

const log = createLogger("events");

/**
 * Builds the Telegram HTML message for an event that is about to start
 * (or, for a retried announcement, has just started)
 */
export function formatEventMessage(
  event: rawEvent,
  now = new Date(),
): string {
  // A retried announcement can go out after the start time
  const started = event.start != null && new Date(event.start) <= now;
  let message = `<a href="${event.link}">${toEscapeHTMLMsg(event.name)}</a> ${
    started ? "has started!" : "is starting soon!"
  }`;
  const spotlight = event.extraData?.spotlight;
  if (event.eventType === "pokemon-spotlight-hour" && spotlight) {
    const details: string[] = [];
    if (spotlight.name) details.push(`Featured: ${toEscapeHTMLMsg(spotlight.name)}`);
    if (spotlight.bonus) details.push(`Bonus: ${toEscapeHTMLMsg(spotlight.bonus)}`);
    if (details.length) message += `\n${details.join(" — ")}`;
  }
  // The featured Pokémon is already in the event name; only the bonuses
  // are worth repeating.
  const bonuses = event.extraData?.communityday?.bonuses;
  if (event.eventType === "community-day" && bonuses?.length) {
    message += `\nBonuses:\n${bonuses
      .map((bonus) => `• ${toEscapeHTMLMsg(bonus.text)}`)
      .join("\n")}`;
  }
  return message;
}

const SEND_ATTEMPTS = 3;
const RETRY_DELAY_MS = 30_000;
// Used when the start time has already passed by the time a send fails
const LATE_RETRY_MS = 5 * 60_000;

async function sendWithRetry(message: string): Promise<boolean> {
  for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
    try {
      await bot.telegram.sendMessage("@SGPogoEvents", message, {
        parse_mode: "HTML",
      });
      return true;
    } catch (error) {
      log.warn(
        `Event announcement attempt ${attempt}/${SEND_ATTEMPTS} failed:`,
        error,
      );
      if (attempt < SEND_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  return false;
}

/**
 * The job runs hourly, so the next run is too late to make up a failed
 * announcement (Telegram timeouts are routine on this host); try once
 * more when the event starts instead
 */
function retryAtStart(event: rawEvent): void {
  const untilStart = new Date(event.start!).getTime() - Date.now();
  const delay = untilStart > 0 ? untilStart : LATE_RETRY_MS;
  log.warn(
    `Will retry announcing ${event.name} at ${sgtTimestamp(
      new Date(Date.now() + delay),
    )}`,
  );
  // unref: a pending retry must not hold the process open on shutdown
  setTimeout(async () => {
    try {
      if (await sendWithRetry(formatEventMessage(event))) {
        log.info(`Announced event on retry: ${event.name}`);
      } else {
        log.error(`Gave up announcing ${event.name}`);
      }
    } catch (error) {
      log.error(`Retry announcing ${event.name} failed:`, error);
    }
  }, delay).unref();
}

/**
 * Check events from ScrapedDuck & notifies if event is about to start
 * @see https://github.com/bigfoott/ScrapedDuck
 */
export async function notifyEvent(): Promise<void> {
  log.debug("Checking events");
  const rawEvents = await getEvents();
  const window = {
    start: subMinutes(new Date(), config.eventBuffer),
    end: addMinutes(new Date(), config.eventBuffer),
  };
  const due = new Map<string, rawEvent>();
  rawEvents.forEach((event) => {
    if (!event.start) return;
    const eventStart = new Date(event.start);
    // ScrapedDuck can list one event more than once
    if (isWithinInterval(eventStart, window) && !due.has(event.link)) {
      due.set(event.link, event);
    }
  });

  for (const event of due.values()) {
    if (await sendWithRetry(formatEventMessage(event))) {
      log.info(`Announced event: ${event.name} (starts ${event.start})`);
    } else {
      retryAtStart(event);
    }
  }
}
