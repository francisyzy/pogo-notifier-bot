import { Message } from "typegram";
import { Telegraf, session } from "telegraf";

import config from "./config";

import bot from "./lib/bot";

// Session must be used once before any Scenes/Stage middleware
bot.use(session());
import { toEscapeHTMLMsg } from "./utils/messageHandler";

import helper from "./commands/helper";
import catchAll from "./commands/catch-all";
import checkRaid from "./commands/checkRaid";
import subscribe from "./commands/subscribeGym";
import manageGyms from "./commands/manageSubscribeGym";
import manageSubscribeLocation from "./commands/manageSubscribeLocation";
import { notifyAndUpdateUsers, clearAllRaidReminders } from "./utils/notifier";
import { removeStaleGyms } from "./utils/gymAdder";
import manageRaidLevels from "./commands/manageRaidLevel";
import manageRaidAlertMinutes from "./commands/manageRaidAlertMinutes";
import {
  notifyLegendary,
  notifyPerfect,
} from "./utils/perfectNotifier";
import subscribeLocation from "./commands/subscribeLocation";
import checkPerfect from "./commands/checkPerfect";
import { notifyEvent } from "./utils/eventNotifier";
import { schedule } from "node-cron";
import location from "./commands/location";
import { printBotInfo } from "./utils/consolePrintUsername";
import checkBoss from "./commands/checkBoss";

//Production Settings
if (process.env.NODE_ENV === "production") {
  //Production Logging
  bot.use((ctx, next) => {
    if (ctx.message && config.LOG_GROUP_ID) {
      //Remove logging from botOwner
      if (ctx.message.from.id !== config.OWNER_ID) {
        let userInfo: string;
        if (ctx.message.from.username) {
          userInfo = `name: <a href="tg://user?id=${
            ctx.message.from.id
          }">${toEscapeHTMLMsg(ctx.message.from.first_name)}</a> (@${
            ctx.message.from.username
          })`;
        } else {
          userInfo = `name: <a href="tg://user?id=${
            ctx.message.from.id
          }">${toEscapeHTMLMsg(ctx.message.from.first_name)}</a>`;
        }
        const text = `\ntext: ${
          (ctx.message as Message.TextMessage).text
        }`;
        const logMessage = userInfo + toEscapeHTMLMsg(text);
        bot.telegram.sendMessage(config.LOG_GROUP_ID, logMessage, {
          parse_mode: "HTML",
        });
      }
    }
    return next();
  });
  bot.use(Telegraf.log());
  bot.launch();
} else {
  //Development logging
  bot.use(Telegraf.log());
  bot.launch();
  printBotInfo(bot);
}

helper();
checkRaid();
subscribe();
manageGyms();
location();
manageRaidLevels();
manageRaidAlertMinutes();
subscribeLocation();
manageSubscribeLocation();
checkPerfect();
checkBoss();

//Catch all unknown messages/commands
catchAll();

//https://www.serverless.com/blog/cron-jobs-on-aws/
//Checks for event every hour
//https://crontab.guru/#45_0-23_*_*_*
schedule("45 0-23 * * *", async () => {
  try {
    console.log(new Date());
    console.log(new Date().toString());
    await notifyEvent();
  } catch (error) {
    console.error("Error in event notification cron:", error);
  }
});

// Initial notifications on startup
notifyAndUpdateUsers().catch((error) => {
  console.error("Error in initial notifyAndUpdateUsers:", error);
});
notifyPerfect().catch((error) => {
  console.error("Error in initial notifyPerfect:", error);
});
notifyLegendary().catch((error) => {
  console.error("Error in initial notifyLegendary:", error);
});

// Clean up stale gyms on startup (runs again daily at 4am)
removeStaleGyms().catch((error) => {
  console.error("Error in initial removeStaleGyms:", error);
});

//Check raids every 10 mins, disable night checking
//https://crontab.guru/#*/10_5-20_*_*_*
schedule("*/10 5-20 * * *", async () => {
  try {
    await notifyAndUpdateUsers();
  } catch (error) {
    console.error("Error in raid notification cron:", error);
  }
});

//Check raids every mins when raid hour is starting
//https://crontab.guru/#49-59_17_*_*_3
schedule("44-59 17 * * 3", async () => {
  try {
    await notifyAndUpdateUsers();
  } catch (error) {
    console.error("Error in raid hour notification cron:", error);
  }
});

//Check perfect pokemon every 5 mins
setInterval(() => {
  notifyPerfect().catch((error) => {
    console.error("Error in notifyPerfect interval:", error);
  });
}, 300000);

setInterval(() => {
  notifyLegendary().catch((error) => {
    console.error("Error in notifyLegendary interval:", error);
  });
}, 330000);

// Remove stale gyms daily at 4am (no raid in 7 days, no subscriptions)
schedule("0 4 * * *", async () => {
  try {
    await removeStaleGyms();
  } catch (error) {
    console.error("Error in removeStaleGyms cron:", error);
  }
});

// Enable graceful stop
process.once("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully...");
  clearAllRaidReminders();
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  clearAllRaidReminders();
  bot.stop("SIGTERM");
});
