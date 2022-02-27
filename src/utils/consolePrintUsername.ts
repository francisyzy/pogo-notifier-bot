import { Telegraf, Scenes } from "telegraf";
import qrcode from "qrcode-terminal";

/**
 * Console logs the bot username and gives a link to the bot
 * @param bot Bot object
 * @returns {Promise<number>} number of possible bosses from information given
 */
export async function printBotInfo(
  bot: Telegraf<Scenes.WizardContext<Scenes.WizardSessionData>>,
): Promise<void> {
  const botMe = await bot.telegram.getMe();
  console.log(
      `Bot \x1b[4m${botMe.first_name}\x1b[24m is running with username \x1b[4m@${botMe.username}\x1b[24m \nhttps://t.me/${botMe.username}`,
  );
  qrcode.generate(`https://t.me/${botMe.username}`, { small: true });
}
