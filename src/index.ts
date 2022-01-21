import { Message } from "typegram";
import { Telegraf } from "telegraf";

import config from "./config";

import bot from "./lib/bot";
import { toEscapeHTMLMsg } from "./utils/messageHandler";

import helper from "./commands/helper";
import catchAll from "./commands/catch-all";
import checkRaid from "./commands/checkRaid";
import subscribe from "./commands/subscribeGym";
import manageGyms from "./commands/manageSubscribeGym";
import { notifyAndUpdateUsers } from "./utils/notifier";
import manageRaidLevels from "./commands/manageRaidLevel";
import { notifyPerfect } from "./utils/perfectNotifier";
import subscribeLocation from "./commands/subscribeLocation";
import checkPerfect from "./commands/checkPerfect";
import { notifyEvent } from "./utils/eventNotifier";
import { schedule } from "node-cron";
import location from "./commands/location";

//Production Settings
if (process.env.NODE_ENV === "production") {
  //Production Logging
  bot.use((ctx, next) => {
    if (ctx.message && config.LOG_GROUP_ID) {
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
    return next();
  });
  bot.launch({
    webhook: {
      domain: config.URL,
      port: Number(config.PORT),
    },
  });
} else {
  //Development logging
  bot.use(Telegraf.log());
  bot.launch();
}

helper();
checkRaid();
subscribe();
manageGyms();
location();
manageRaidLevels();
subscribeLocation();
checkPerfect();

//Catch all unknown messages/commands
catchAll();

//https://www.serverless.com/blog/cron-jobs-on-aws/
//https://crontab.guru/#55_0-23_*_*_*
schedule("45 0-23 * * *", () => {
  console.log(new Date());
  console.log(new Date().toString());
  notifyEvent();
});
notifyAndUpdateUsers();
notifyPerfect();
//Check raids every 10 mins, disable night checking
//https://crontab.guru/#*/10_5-20_*_*_*
schedule("*/10 5-20 * * *", () => {
  notifyAndUpdateUsers();
});
//Check perfect pokemon every 5 mins
setInterval(() => notifyPerfect(), 300000);

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
