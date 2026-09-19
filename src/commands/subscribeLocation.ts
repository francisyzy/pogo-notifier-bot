import { Scenes, Markup, Composer } from "telegraf";
import { Message } from "typegram";
import bot from "../lib/bot";
import { PrismaClient } from "@prisma/client";
import { IMAGES } from "../constants";
import {
  formatDistance,
  MAX_RADIUS_M,
  MIN_RADIUS_M,
  RADIUS_CHOICES_M,
} from "../utils/geo";

const prisma = new PrismaClient();

const RADIUS_ACTION_PREFIX = "PR_";

type SubscribeLocationState = { lat?: number; lng?: number };

/** Inline keyboard of preset radii, e.g. for /addLocation and /managePerfect */
export function radiusKeyboard(actionPrefix: string) {
  return Markup.inlineKeyboard(
    RADIUS_CHOICES_M.map((m) =>
      Markup.button.callback(formatDistance(m), actionPrefix + m),
    ),
    { columns: 3 },
  );
}

/**
 * Parse a radius typed by the user ("300", "300m", "1.5km"). Returns
 * metres, or null when it's not a usable number.
 */
export function parseRadiusMeters(text: string): number | null {
  const match = text
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)\s*(m|km)?$/);
  if (!match) return null;
  const value = Number(match[1]) * (match[2] === "km" ? 1000 : 1);
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

export function radiusPrompt(): string {
  return (
    "How far around this pin should I look for perfect spawns?\n\n" +
    `Pick a radius below, or type one in metres (${MIN_RADIUS_M}–${MAX_RADIUS_M}, e.g. 300 or 1.5km). /cancel to exit`
  );
}

const subscribeLocation = () => {
  try {
    const askRadius = async (
      ctx: Scenes.WizardContext,
      lat: number,
      lng: number,
    ) => {
      (ctx.scene.state as SubscribeLocationState).lat = lat;
      (ctx.scene.state as SubscribeLocationState).lng = lng;
      // The location reply keyboard is one_time, so no removeKeyboard here
      // (it would clobber the inline keyboard's reply_markup)
      await ctx.reply(radiusPrompt(), radiusKeyboard(RADIUS_ACTION_PREFIX));
    };

    const saveSubscription = async (
      ctx: Scenes.WizardContext,
      radiusMeters: number,
    ) => {
      const { lat, lng } = ctx.scene.state as SubscribeLocationState;
      if (!ctx.from || lat === undefined || lng === undefined) {
        await ctx.reply("No location received. Use /addLocation to start again");
        return ctx.scene.leave();
      }
      await prisma.user.upsert({
        where: { telegramId: ctx.from.id },
        update: { name: ctx.from.first_name },
        create: {
          telegramId: ctx.from.id,
          raidLevelNotify: "1, 3, 5, 6, 11, 13",
          name: ctx.from.first_name,
        },
      });
      await prisma.locationSubscribe.create({
        data: {
          userTelegramId: ctx.from.id,
          lat,
          long: lng,
          radiusMeters,
        },
      });
      // A venue renders as a map card with a title, unlike a bare pin
      await ctx.replyWithVenue(
        lat,
        lng,
        `Perfect spawn alerts · ${formatDistance(radiusMeters)} radius`,
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      );
      await ctx.reply(
        `✅ Added. You'll be notified when a perfect Pokemon spawns within ${formatDistance(
          radiusMeters,
        )} of this pin.\n\n/myLocations to see all your locations, /managePerfect to change the radius or remove one`,
        { ...Markup.removeKeyboard() },
      );
      return ctx.scene.leave();
    };

    // Step: wait for a location pin
    const locationHandler = new Composer<Scenes.WizardContext>();
    locationHandler.on("location", async (ctx) => {
      const { latitude, longitude } = ctx.message.location;
      await askRadius(ctx, latitude, longitude);
      return ctx.wizard.next();
    });
    locationHandler.command("cancel", async (ctx) => {
      await ctx.reply("Exiting set perfect pokemon location notify", {
        ...Markup.removeKeyboard(),
      });
      return ctx.scene.leave();
    });
    locationHandler.use((ctx) =>
      ctx.replyWithPhoto(IMAGES.LOCATION_TUTORIAL, {
        caption:
          "Please send your location by clicking the button on the keyboard or /cancel to exit",
      }),
    );

    // Step: pick a radius (button or typed number)
    const radiusHandler = new Composer<Scenes.WizardContext>();
    radiusHandler.action(
      new RegExp(`^${RADIUS_ACTION_PREFIX}(\\d+)$`),
      async (ctx) => {
        const radiusMeters = Number(ctx.match[1]);
        await ctx.answerCbQuery(formatDistance(radiusMeters));
        await ctx.editMessageText(
          `Radius: ${formatDistance(radiusMeters)}`,
        );
        return saveSubscription(ctx, radiusMeters);
      },
    );
    radiusHandler.command("cancel", async (ctx) => {
      await ctx.reply("Exiting set perfect pokemon location notify", {
        ...Markup.removeKeyboard(),
      });
      return ctx.scene.leave();
    });
    radiusHandler.on("text", async (ctx) => {
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
      return saveSubscription(ctx, radiusMeters);
    });
    radiusHandler.use((ctx) => ctx.reply(radiusPrompt()));

    const locationSearchWizard =
      new Scenes.WizardScene<Scenes.WizardContext>(
        "subscribeLocation",
        async (ctx) => {
          if (!ctx.from || ctx.chat?.type !== "private") {
            await ctx.reply("Please use the bot in a private chat");
            return ctx.scene.leave();
          }
          // Entered from the /sendLocation button: pin already chosen
          const preset = ctx.scene.state as SubscribeLocationState;
          if (preset.lat !== undefined && preset.lng !== undefined) {
            await askRadius(ctx, preset.lat, preset.lng);
            return ctx.wizard.selectStep(2);
          }
          await ctx.reply(
            "Press the button to send your location to get notified about perfect pokemon near you. /cancel to exit",
            {
              reply_markup: {
                keyboard: [
                  [
                    {
                      text: "Send your current location or a location to get notifications if perfect spawns there",
                      request_location: true,
                    },
                  ],
                ],
                one_time_keyboard: true,
              },
            },
          );
          return ctx.wizard.next();
        },
        locationHandler,
        radiusHandler,
      );

    const stage = new Scenes.Stage<Scenes.WizardContext>([
      locationSearchWizard,
    ]);
    bot.use(stage.middleware());

    bot.command(["addLocation", "addlocation"], (ctx) => {
      return ctx.scene.enter("subscribeLocation");
    });
    bot.action(/^SP_(.+)_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery("Adding location");
      await ctx.editMessageText("Adding a perfect Pokemon location");
      return ctx.scene.enter("subscribeLocation", {
        lat: Number(ctx.match[1]),
        lng: Number(ctx.match[2]),
      });
    });
  } catch (error) {
    console.error("Error in subscribeLocation:", error);
  }
};

export default subscribeLocation;
