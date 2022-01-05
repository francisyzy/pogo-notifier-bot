import { PrismaClient, Event } from ".prisma/client";
import { getEvents } from "./getMaper";

const prisma = new PrismaClient();

/**
 * Check add lists of events into the database
 */
//if ever need to recast the chinese event names to english:
//https://raw.githubusercontent.com/pmgo-professor-willow/data-leekduck/main/data/event-types.json
export async function eventAdder(): Promise<void> {
  console.log("Adding events");
  const rawEvents = await getEvents();
  let events: Event[] = [];
  rawEvents.forEach((rawEvent) => {
    if (rawEvent.startTime) {
      events.push({
        eventURL: rawEvent.link,
        eventName: rawEvent.title,
        eventTime: new Date(rawEvent.startTime),
        isLocaleTime: rawEvent.isLocaleTime,
      });
    }
  });
  await prisma.event.createMany({
    data: events,
    skipDuplicates: true,
  });
}
