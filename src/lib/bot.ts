import config from "../config";
import { Telegraf, Scenes } from "telegraf";

if (config.API_TOKEN === undefined) {
  throw new Error("BOT_TOKEN must be provided!");
}

const bot = new Telegraf<Scenes.WizardContext>(config.API_TOKEN);

export default bot;
