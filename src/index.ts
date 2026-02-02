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
import { notifyAndUpdateUsers } from "./utils/notifier";
import { removeStaleGyms } from "./utils/gymAdder";
import manageRaidLevels from "./commands/manageRaidLevel";
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
subscribeLocation();
manageSubscribeLocation();
checkPerfect();
checkBoss();

//Catch all unknown messages/commands
catchAll();

//https://www.serverless.com/blog/cron-jobs-on-aws/
//Checks for event every hour
//https://crontab.guru/#45_0-23_*_*_*
schedule("45 0-23 * * *", () => {
  console.log(new Date());
  console.log(new Date().toString());
  notifyEvent();
});
notifyAndUpdateUsers();
notifyPerfect();
notifyLegendary();
// Clean up stale gyms on startup (runs again daily at 4am)
removeStaleGyms();
//Check raids every 10 mins, disable night checking
//https://crontab.guru/#*/10_5-20_*_*_*
schedule("*/10 5-20 * * *", () => {
  notifyAndUpdateUsers();
});
//Check raids every mins when raid hour is starting
//https://crontab.guru/#49-59_17_*_*_3
schedule("44-59 17 * * 3", () => {
  notifyAndUpdateUsers();
});
//Check perfect pokemon every 5 mins
setInterval(() => notifyPerfect(), 300000);
setInterval(() => notifyLegendary(), 330000);

// Remove stale gyms daily at 4am (no raid in 7 days, no subscriptions)
schedule("0 4 * * *", () => {
  removeStaleGyms();
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
