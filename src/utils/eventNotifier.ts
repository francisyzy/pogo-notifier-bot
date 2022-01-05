import { addMinutes, isWithinInterval, subMinutes } from "date-fns";
import bot from "../lib/bot";
import { getEvents } from "./getMaper";

const minuteBuffer = 20;

/**
 * Check events from the source & notifies if event is about to start
 */
export async function notifyEvent(): Promise<void> {
  console.log("Checking notifyEvents");
  const rawEvents = await getEvents();
  let notifier: { link: string; title: string }[] = [];
  rawEvents.forEach((event) => {
    if (event.isLocaleTime) {
      //Unused function
      //https://stackoverflow.com/a/18330682
      //Date.toString() returns accurate local time but is in string
      //Set time from db to local time so excel can have local time
      // function convertUTCDateToLocalDate(date: Date) {
      //   var newDate = new Date(
      //     date.getTime() + date.getTimezoneOffset() * 60 * 1000,
      //   );
      //   var offset = date.getTimezoneOffset() / 60;
      //   var hours = date.getHours();
      //   newDate.setHours(hours - offset);
      //   return newDate;
      // }

      const eventTime = new Date(event.startTime);
      //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date
      const localEventTime = new Date(
        eventTime.getUTCFullYear(),
        eventTime.getUTCMonth(),
        eventTime.getUTCDate(),
        eventTime.getUTCHours(),
        eventTime.getUTCMinutes(),
        eventTime.getUTCSeconds(),
        eventTime.getUTCMilliseconds(),
      );
      //https://date-fns.org/v2.28.0/docs/isWithinInterval
      //https://github.com/date-fns/date-fns/issues/366
      if (
        isWithinInterval(localEventTime, {
          start: subMinutes(new Date(), minuteBuffer),
          end: addMinutes(new Date(), minuteBuffer),
        })
      ) {
        notifier.push({ link: event.link, title: event.title });
      }
    } else if (
      isWithinInterval(new Date(event.startTime), {
        start: subMinutes(new Date(), minuteBuffer),
        end: addMinutes(new Date(), minuteBuffer),
      })
    ) {
      notifier.push({ link: event.link, title: event.title });
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
      `<a href="${notify.link}">${notify.title}</a> is happening soon!`,
      { parse_mode: "HTML" },
    );
  });
}
