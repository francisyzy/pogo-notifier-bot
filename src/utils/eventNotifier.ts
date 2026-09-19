import { addMinutes, isWithinInterval, subMinutes } from "date-fns";
import bot from "../lib/bot";
import { getEvents } from "./getMaper";
import config from "../config";
import { rawEvent } from "../types";
import { toEscapeHTMLMsg } from "./messageHandler";

/**
 * Builds the Telegram HTML message for an event that is about to start
 */
export function formatEventMessage(event: rawEvent): string {
  let message = `<a href="${event.link}">${toEscapeHTMLMsg(event.name)}</a> is starting soon!`;
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

/**
 * Check events from ScrapedDuck & notifies if event is about to start
 * @see https://github.com/bigfoott/ScrapedDuck
 */
export async function notifyEvent(): Promise<void> {
  console.log("Checking notifyEvents");
  const rawEvents = await getEvents();
  let notifier: { link: string; message: string }[] = [];
  const window = {
    start: subMinutes(new Date(), config.eventBuffer),
    end: addMinutes(new Date(), config.eventBuffer),
  };
  rawEvents.forEach((event) => {
    if (!event.start) return;
    const eventStart = new Date(event.start);
    if (isWithinInterval(eventStart, window)) {
      notifier.push({ link: event.link, message: formatEventMessage(event) });
    }
  });
  //Removes duplicate events
  //https://stackoverflow.com/a/36744732
  notifier = notifier.filter(
    (value, index, self) =>
      index === self.findIndex((t) => t.link === value.link),
  );
  //Sends notification out
  notifier.forEach((notify) => {
    bot.telegram.sendMessage("@SGPogoEvents", notify.message, {
      parse_mode: "HTML",
    });
  });
}
