import { Prisma, PrismaClient } from "@prisma/client";
import { isToday, subDays } from "date-fns";
import bot from "../lib/bot";
import { getRaids } from "./getMaper";
import { gymChecker } from "./gymChecker";
import { sleep } from "./sleep";
import {
  bossCount,
  getEffectiveTierForNotification,
  raidMessageFormatter,
} from "./messageFormatter";
import config from "../config";
import { convertBackToArray } from "./legacy_converter";

const prisma = new PrismaClient();

/**
 * Store active timeout IDs for cleanup on shutdown
 * Key: unique identifier for the timeout (e.g., `${userTelegramId}-${gymId}-${startTime}`)
 * Value: NodeJS.Timeout ID
 */
const activeTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Clear all active raid reminder timeouts
 * Should be called on bot shutdown or restart
 */
export function clearAllRaidReminders(): void {
  activeTimeouts.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });
  activeTimeouts.clear();
  console.log("Cleared all active raid reminder timeouts");
}

/**
 * Check raids and notifies the user if there are raids
 */
export async function notifyAndUpdateUsers(): Promise<void> {
  console.log("Checking raids");
  try {
    const raids = await getRaids();
    const raidMessages = await gymChecker(raids);
    
    // Batch fetch all users to avoid N+1 query problem
    const userIds = [
      ...new Set(raidMessages.map((r) => r.userTelegramId)),
    ];
    const users = await prisma.user.findMany({
      where: { telegramId: { in: userIds } },
    });
    const userMap = new Map(users.map((u) => [u.telegramId, u]));

    for (const raidMessage of raidMessages) {
      const user = userMap.get(raidMessage.userTelegramId);
      
      if (!user) {
        console.log(
          `User ${raidMessage.userTelegramId} not found, skipping raid notification`,
        );
        continue;
      }

      const effectiveTier = getEffectiveTierForNotification(raidMessage.level);
      if (
        convertBackToArray(user.raidLevelNotify).indexOf(effectiveTier) === -1
      ) {
        console.log(user.name + " Skipped Raid " + raidMessage.level);
        continue;
      } else if (
        user.stopNotifyingMeToday &&
        isToday(user.stopNotifyingMeToday)
      ) {
        console.log(user.name + " Skipped Raid stop notify");
        continue;
      }

      let message: string;
      try {
        message = await raidMessageFormatter(raidMessage);
      } catch (error) {
        console.error(
          `Failed to format raid message for user ${user.name}:`,
          error,
        );
        continue;
      }

      await sleep(0.5);
      try {
        //Delete old gym events (not awaited to avoid blocking)
        prisma.gymEvent
          .deleteMany({
            where: { eventTime: { lt: subDays(new Date(), 1) } },
          })
          .catch((error) => {
            console.error("Error deleting old gym events:", error);
          });

        await prisma.gymEvent
          .create({
            data: {
              eventTime: raidMessage.start,
              gymSubscribeGymId: raidMessage.gymId,
              gymSubscribeUserTelegramId: raidMessage.userTelegramId,
            },
          })
          .then(async () => {
            await prisma.user.update({
              where: { telegramId: raidMessage.userTelegramId },
              data: {
                gymTimesNotified: {
                  increment: 1,
                },
              },
            });
            
            let originalMessage;
            try {
              originalMessage = await bot.telegram.sendMessage(
                raidMessage.userTelegramId,
                message,
                {
                  parse_mode: "HTML",
                  link_preview_options: { is_disabled: true },
                },
              );
            } catch (error) {
              console.error(
                `Failed to send raid message to user ${user.name}:`,
                error,
              );
              return;
            }

            //If raid has not started, send reminder
            if (raidMessage.pokemonId === 0) {
              let numberOfBoss: number;
              try {
                //Gets the number of bosses possible (for reminder message)
                numberOfBoss = await bossCount(raidMessage);
              } catch (error) {
                console.error(
                  `Failed to get boss count for raid at ${raidMessage.name}:`,
                  error,
                );
                numberOfBoss = 1; // Default to 1 if fetch fails
              }

              //telegram command - is not clickable whereas _ is clickable
              const gymId = raidMessage.gymId.replaceAll("-", "_");
              const raidAlertMinutes =
                user.raidAlertMinutes || config.raidAlertMinutes;
              const configOffSetMs = raidAlertMinutes * 60000;
              //* 60000, 1min = 60000ms
              const offsetMs =
                raidMessage.start.getTime() -
                new Date().getTime() -
                configOffSetMs;
              //Send reminder if its more than the configured minutes
              if (offsetMs > configOffSetMs) {
                // Create unique key for this timeout
                const timeoutKey = `${raidMessage.userTelegramId}-${raidMessage.gymId}-${raidMessage.start.getTime()}`;
                
                const timeoutId = setTimeout(async () => {
                  try {
                    // Check if user still exists and wants to be notified before sending reminder
                    const userAtReminderTime = await prisma.user.findUnique({
                      where: { telegramId: raidMessage.userTelegramId },
                    });
                    
                    if (!userAtReminderTime) {
                      console.log(
                        `User ${raidMessage.userTelegramId} no longer exists, skipping reminder`,
                      );
                      activeTimeouts.delete(timeoutKey);
                      return;
                    }
                    
                    if (
                      userAtReminderTime.stopNotifyingMeToday &&
                      isToday(userAtReminderTime.stopNotifyingMeToday)
                    ) {
                      console.log(
                        userAtReminderTime.name +
                          " Skipped Raid reminder - stop notify",
                      );
                      activeTimeouts.delete(timeoutKey);
                      return;
                    }
                    
                    await bot.telegram.sendMessage(
                      raidMessage.userTelegramId,
                      `Raid starting in ${raidAlertMinutes} mins${
                        numberOfBoss === 1
                          ? ""
                          : "\n\n/checkRaid_" +
                            gymId +
                            " to check which raid boss spawned, after the egg popped"
                      }\n\n<i>/stopNotifyingMeToday to stop being notified about raids for the rest of the day</i>`,
                      {
                        reply_parameters: {
                          message_id: originalMessage.message_id,
                        },
                        parse_mode: "HTML",
                      },
                    );
                    activeTimeouts.delete(timeoutKey);
                  } catch (error) {
                    console.error(
                      `Error sending raid reminder to user ${raidMessage.userTelegramId}:`,
                      error,
                    );
                    activeTimeouts.delete(timeoutKey);
                  }
                }, offsetMs);
                
                activeTimeouts.set(timeoutKey, timeoutId);
              }
            }
          })
          .catch(async (error) => {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
              if (error.code === "P2002") {
                //User has already been notified - this is expected, not an error
                console.log(
                  `User ${user.name} already notified about raid at ${raidMessage.name}`,
                );
              } else {
                console.error(
                  `Prisma error notifying user ${user.name}:`,
                  error,
                );
              }
            } else {
              console.error(
                `Error creating gym event for user ${user.name}:`,
                error,
              );
            }
          });
      } catch (error) {
        console.error(
          `Unexpected error processing raid for user ${user.name}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("Error in notifyAndUpdateUsers:", error);
  }
}
