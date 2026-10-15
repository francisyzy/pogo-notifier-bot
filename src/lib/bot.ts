import { setDefaultResultOrder } from "dns";
import config from "../config";
import { Telegraf, Scenes } from "telegraf";

// api.telegram.org resolves IPv6-first, and Node 18 only tries the first
// address; the server's IPv6 route keeps timing out (ETIMEDOUT
// 2001:67c:4e8:f004::9), so prefer IPv4 process-wide
setDefaultResultOrder("ipv4first");

if (config.API_TOKEN === undefined) {
  throw new Error("BOT_TOKEN must be provided!");
}

const bot = new Telegraf<Scenes.WizardContext>(config.API_TOKEN);

export default bot;
