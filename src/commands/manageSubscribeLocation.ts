import { Scenes, Markup, Composer } from "telegraf";
import bot from "../lib/bot";
import { InlineKeyboardButton, Message } from "typegram";
import { PrismaClient } from "@prisma/client";
import {
  formatDistance,
  mapsLink,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
} from "../utils/geo";
import {
  parseRadiusMeters,
  radiusKeyboard,
  radiusPrompt,
} from "./subscribeLocation";

const prisma = new PrismaClient();

const RADIUS_ACTION_PREFIX = "MR_";
const REMOVE_ACTION = "MD";
const EXIT_ACTION = "e";

type ManageLocationState = { locationId?: string };

function formatLocation(lat: number, long: number): string {
  return `📍 ${lat.toFixed(4)}, ${long.toFixed(4)}`;
}

/** Map card for a subscription: title carries the radius so the user can see it */
function sendLocationCard(
  ctx: Scenes.WizardContext,
  label: string,
  lat: number,
  long: number,
  radiusMeters: number,
) {
  return ctx.replyWithVenue(
    lat,
    long,
    `${label} · ${formatDistance(radiusMeters)} radius`,
    `${lat.toFixed(5)}, ${long.toFixed(5)}`,
  );
}

const manageSubscribeLocation = () => {
  try {
    const leaveMessage =
      "Exiting perfect location management. /managePerfect to change or remove locations";

    // Step: pick which location to manage
    const pickHandler = new Composer<Scenes.WizardContext>();
    pickHandler.action(/.+/, async (ctx) => {
      const selectedLocationId = ctx.match[0];
      if (selectedLocationId === EXIT_ACTION) {
        await ctx.answerCbQuery();
        await ctx.editMessageText("Exit manage perfect location subscription");
        return ctx.scene.leave();
      }

      const subscription = await prisma.locationSubscribe.findFirst({
        where: {
          locationId: selectedLocationId,
          userTelegramId: ctx.from!.id,
        },
      });
      if (!subscription) {
        await ctx.answerCbQuery();
        await ctx.editMessageText(
          "This location was <b>already</b> removed from your subscriptions!",
          { parse_mode: "HTML" },
        );
        return ctx.scene.leave();
      }

      await ctx.answerCbQuery("Location selected");
      (ctx.scene.state as ManageLocationState).locationId =
        subscription.locationId;
      await ctx.editMessageText(
        `Selected ${formatLocation(subscription.lat, subscription.long)}`,
      );
      await sendLocationCard(
        ctx,
        "Perfect spawn alerts",
        subscription.lat,
        subscription.long,
        subscription.radiusMeters,
      );
      const keyboard = radiusKeyboard(RADIUS_ACTION_PREFIX);
      keyboard.reply_markup.inline_keyboard.push([
        Markup.button.callback("🗑 Remove this location", REMOVE_ACTION),
        Markup.button.callback("🚫 Exit", EXIT_ACTION),
      ]);
      await ctx.reply(
        `Current radius: <b>${formatDistance(
          subscription.radiusMeters,
        )}</b>\n\nPick a new radius below or type one in metres (${MIN_RADIUS_M}–${MAX_RADIUS_M}, e.g. 300 or 1.5km), 🗑 to remove this location, or /cancel`,
        { parse_mode: "HTML", ...keyboard },
      );
      return ctx.wizard.next();
    });
    pickHandler.command("cancel", async (ctx) => {
      await ctx.reply(leaveMessage, { ...Markup.removeKeyboard() });
      return ctx.scene.leave();
    });
    pickHandler.use((ctx) =>
      ctx.reply(
        "Please select one of the locations in the list or /cancel to exit",
      ),
    );

    // Step: change radius or remove the selected location
    const editHandler = new Composer<Scenes.WizardContext>();
    const setRadius = async (
      ctx: Scenes.WizardContext,
      radiusMeters: number,
    ) => {
      const locationId = (ctx.scene.state as ManageLocationState)
        .locationId;
      if (!locationId) {
        await ctx.reply(
          "No location selected. Use /managePerfect to start again",
        );
        return ctx.scene.leave();
      }
      try {
        const updated = await prisma.locationSubscribe.update({
          where: { locationId },
          data: { radiusMeters },
        });
        await ctx.reply(
          `✅ Radius for ${formatLocation(
            updated.lat,
            updated.long,
          )} is now ${formatDistance(radiusMeters)}`,
        );
      } catch {
        await ctx.reply(
          "This location was already removed. Use /managePerfect to start again",
        );
      }
      return ctx.scene.leave();
    };
    editHandler.action(
      new RegExp(`^${RADIUS_ACTION_PREFIX}(\\d+)$`),
      async (ctx) => {
        const radiusMeters = Number(ctx.match[1]);
        await ctx.answerCbQuery(formatDistance(radiusMeters));
        await ctx.editMessageText(`Radius: ${formatDistance(radiusMeters)}`);
        return setRadius(ctx, radiusMeters);
      },
    );
    editHandler.action(REMOVE_ACTION, async (ctx) => {
      const locationId = (ctx.scene.state as ManageLocationState)
        .locationId;
      await ctx.answerCbQuery("Removing");
      if (!locationId) {
        await ctx.editMessageText(
          "No location selected. Use /managePerfect to start again",
        );
        return ctx.scene.leave();
      }
      try {
        const removed = await prisma.locationSubscribe.delete({
          where: { locationId },
        });
        await ctx.editMessageText(
          `You removed ${formatLocation(
            removed.lat,
            removed.long,
          )} from your perfect Pokemon subscriptions`,
        );
      } catch {
        await ctx.editMessageText(
          "This location was <b>already</b> removed from your subscriptions!",
          { parse_mode: "HTML" },
        );
      }
      return ctx.scene.leave();
    });
    editHandler.action(EXIT_ACTION, async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageText("Exit manage perfect location subscription");
      return ctx.scene.leave();
    });
    editHandler.command("cancel", async (ctx) => {
      await ctx.reply(leaveMessage, { ...Markup.removeKeyboard() });
      return ctx.scene.leave();
    });
    editHandler.on("text", async (ctx) => {
      const radiusMeters = parseRadiusMeters(
        (ctx.message as Message.TextMessage).text,
      );
      if (
        radiusMeters === null ||
        radiusMeters < MIN_RADIUS_M ||
        radiusMeters > MAX_RADIUS_M
      ) {
        await ctx.reply(
          `Please send a radius between ${MIN_RADIUS_M} m and ${formatDistance(
            MAX_RADIUS_M,
          )} (e.g. 300 or 1.5km), pick one of the buttons above, or /cancel`,
        );
        return;
      }
      return setRadius(ctx, radiusMeters);
    });
    editHandler.use((ctx) => ctx.reply(radiusPrompt()));

    const locationListWizard =
      new Scenes.WizardScene<Scenes.WizardContext>(
        "perfectLocationManage",
        async (ctx) => {
          if (!ctx.from || ctx.chat?.type !== "private") {
            await ctx.reply("Please use the bot in a private chat");
            return ctx.scene.leave();
          }
          const subscriptions = await prisma.locationSubscribe.findMany({
            where: { userTelegramId: ctx.from.id },
          });
          if (subscriptions.length === 0) {
            await ctx.reply(
              "You have yet to subscribe to any perfect Pokemon locations. /addLocation to add one",
            );
            return ctx.scene.leave();
          }
          let locationBtnList: (InlineKeyboardButton & {
            hide?: boolean | undefined;
          })[] = [];
          subscriptions.forEach((subscription, i) => {
            locationBtnList.push(
              Markup.button.callback(
                `${i + 1}. ${formatLocation(
                  subscription.lat,
                  subscription.long,
                )} · ${formatDistance(subscription.radiusMeters)}`,
                subscription.locationId,
              ),
            );
          });
          locationBtnList.push(Markup.button.callback("🚫", EXIT_ACTION));

          await ctx.reply(
            "Select the location you want to change the radius of or remove, or 🚫 to exit",
            Markup.inlineKeyboard(locationBtnList, { columns: 1 }),
          );
          return ctx.wizard.next();
        },
        pickHandler,
        editHandler,
      );

    const stage = new Scenes.Stage<Scenes.WizardContext>([
      locationListWizard,
    ]);
    bot.use(stage.middleware());

    bot.command(["myLocations", "mylocations"], async (ctx) => {
      const subscriptions = await prisma.locationSubscribe.findMany({
        where: { userTelegramId: ctx.from.id },
      });
      if (subscriptions.length === 0) {
        return ctx.reply(
          "You have yet to subscribe to any perfect Pokemon locations. /addLocation to add one",
        );
      }

      let returnMessage =
        "You are subscribed to the following perfect Pokemon locations:\n\n";
      subscriptions.forEach((subscription, i) => {
        returnMessage += `${i + 1}. <a href="${mapsLink(
          subscription.lat,
          subscription.long,
        )}">${formatLocation(
          subscription.lat,
          subscription.long,
        )}</a> · ${formatDistance(subscription.radiusMeters)} radius\n`;
      });
      returnMessage +=
        "\n/managePerfect to change a radius or remove a location, /addLocation to add one";
      await ctx.reply(returnMessage, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
      // One map card per location so they can see exactly where each pin is
      for (const [i, subscription] of subscriptions.entries()) {
        await ctx.replyWithVenue(
          subscription.lat,
          subscription.long,
          `Location ${i + 1} · ${formatDistance(
            subscription.radiusMeters,
          )} radius`,
          `${subscription.lat.toFixed(5)}, ${subscription.long.toFixed(5)}`,
        );
      }
      return;
    });

    bot.command(["managePerfect", "manageperfect"], (ctx) => {
      return ctx.scene.enter("perfectLocationManage");
    });
  } catch (error) {
    console.error("Error in manageSubscribeLocation:", error);
  }
};

export default manageSubscribeLocation;
