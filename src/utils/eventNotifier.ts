import { PrismaClient } from ".prisma/client";
import {
  addMinutes,
  isWithinInterval,
  subDays,
  subMinutes,
} from "date-fns";
import bot from "../lib/bot";

const prisma = new PrismaClient();

/**
 * Check events from the list notifies the event is about to start
 */
export async function notifyEvent(): Promise<void> {
  console.log("Checking notifyEvents");
  const events = await prisma.event.findMany({
    where: { eventTime: { gte: subDays(new Date(), 1) } },
    orderBy: { eventTime: "asc" },
    take: 2,
  });
  console.log(events);
  events.forEach((event) => {
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

      //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date
      const localEventTime = new Date(
        event.eventTime.getUTCFullYear(),
        event.eventTime.getUTCMonth(),
        event.eventTime.getUTCDate(),
        event.eventTime.getUTCHours(),
        event.eventTime.getUTCMinutes(),
        event.eventTime.getUTCSeconds(),
        event.eventTime.getUTCMilliseconds(),
      );
      //https://date-fns.org/v2.28.0/docs/isWithinInterval
      //https://github.com/date-fns/date-fns/issues/366
      if (
        isWithinInterval(localEventTime, {
          start: subMinutes(new Date(), 20),
          end: addMinutes(new Date(), 20),
        })
      ) {
        bot.telegram.sendMessage(
          "@SGPogoEvents",
          `<a href="${event.eventURL}">${event.eventName}</a> is happening soon!.`,
          { parse_mode: "HTML" },
        );
      }
    } else if (
      isWithinInterval(event.eventTime, {
        start: subMinutes(new Date(), 20),
        end: addMinutes(new Date(), 20),
      })
    ) {
      bot.telegram.sendMessage(
        "@SGPogoEvents",
        `<a href="${event.eventURL}">${event.eventName}</a> is happening soon!`,
        { parse_mode: "HTML" },
      );
    }
  });
}
