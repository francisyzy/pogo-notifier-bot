import { addMinutes, isWithinInterval, subMinutes } from "date-fns";
import bot from "../lib/bot";
import { getEvents } from "./getMaper";
import config from "../config";

/**
 * Check events from ScrapedDuck & notifies if event is about to start
 * @see https://github.com/bigfoott/ScrapedDuck
 */
export async function notifyEvent(): Promise<void> {
  console.log("Checking notifyEvents");
  const rawEvents = await getEvents();
  let notifier: { link: string; title: string }[] = [];
  const window = {
    start: subMinutes(new Date(), config.eventBuffer),
    end: addMinutes(new Date(), config.eventBuffer),
  };
  rawEvents.forEach((event) => {
    if (!event.start) return;
    const eventStart = new Date(event.start);
    if (isWithinInterval(eventStart, window)) {
      notifier.push({ link: event.link, title: event.name });
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
    bot.telegram.sendMessage(
      "@SGPogoEvents",
      `<a href="${notify.link}">${notify.title}</a> is starting soon!`,
      { parse_mode: "HTML" },
    );
  });
}
