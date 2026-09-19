import { Scenes, Markup, Composer, Context } from "telegraf";
import bot from "../lib/bot";
import { Message, InlineKeyboardButton } from "typegram";
import { PrismaClient } from "@prisma/client";
import {
  ALL_WEEKDAYS,
  DAY_END,
  DAY_START,
  NotifyMode,
  WEEKDAYS_MON_FRI,
  WEEKENDS,
  describeWindow,
  formatClockTime,
  parseClockRange,
  parseClockTime,
  parseWeekdays,
} from "../utils/notifyWindows";

const prisma = new PrismaClient();

/**
 * /quietHours — manage the user's notification windows (see NotifyWindow in schema.prisma).
 *
 * Wizard steps (indexes used with ctx.wizard.selectStep):
 *   0 entry      show current windows + main menu
 *   1 menu       ➕ add / 🏢 work-hours preset / 🗑 remove / 🚫 exit
 *   2 mode       Allow or Block
 *   3 weekdays   toggle days, then Done
 *   4 time       "HH:MM-HH:MM" text or preset buttons
 *   5 scope      everything / raids / perfect / one gym
 *   6 work start (preset)
 *   7 work end   (preset)
 *   8 lunch      (preset) -> saves BLOCK windows
 *   9 remove     pick a window to delete
 */
const STEP = {
  MENU: 1,
  MODE: 2,
  WEEKDAYS: 3,
  TIME: 4,
  SCOPE: 5,
  WORK_START: 6,
  WORK_END: 7,
  WORK_LUNCH: 8,
  REMOVE: 9,
} as const;

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};
const WORK_DEFAULTS = { start: "09:00", end: "18:00", lunch: "12:00-13:00" };

interface NotifyWindowState {
  mode?: NotifyMode;
  weekdays?: number[];
  startTime?: string;
  endTime?: string;
  workStart?: string;
  workEnd?: string;
}

const twoColumns = {
  wrap: (_btn: unknown, _index: number, currentRow: unknown[]) =>
    currentRow.length === 2,
};

const manageNotifyWindows = () => {
  try {
    const state = (ctx: Scenes.WizardContext) =>
      ctx.scene.state as NotifyWindowState;

    /**
     * Every step accepts /cancel. It must be registered before any on("text")
     * handler in the same composer, otherwise the text handler swallows it.
     */
    const newStep = () => {
      const composer = new Composer<Scenes.WizardContext>();
      composer.command("cancel", async (ctx) => {
        await ctx.reply("Exiting notification hours", {
          ...Markup.removeKeyboard(),
        });
        return ctx.scene.leave();
      });
      return composer;
    };
    /** Registered last: nudge on any input the step did not understand */
    const withFallback = (
      composer: Composer<Scenes.WizardContext>,
      hint: string,
    ) => composer.use((ctx) => ctx.reply(`${hint} or /cancel to exit`));

    const showMenu = async (ctx: Scenes.WizardContext) => {
      const windows = await prisma.notifyWindow.findMany({
        where: { userTelegramId: ctx.from!.id },
        include: { gym: true },
        orderBy: { createdAt: "asc" },
      });
      let text: string;
      if (windows.length === 0) {
        text =
          "You have no notification hours set, so you are notified at any time.\n\n" +
          "Add a window to block notifications (e.g. during work) or to only allow them at certain times. " +
          "A gym with its own windows ignores your general windows.";
      } else {
        text =
          "Your notification hours (Singapore time):\n\n" +
          windows.map((w, i) => `${i + 1}. ${describeWindow(w)}`).join("\n") +
          "\n\nIf any Allow windows exist you are only notified inside them. Block windows always win. A gym with its own windows ignores your general windows.";
      }
      const buttons = [
        Markup.button.callback("➕ Add window", "add"),
        Markup.button.callback("🏢 Work hours preset", "preset"),
      ];
      if (windows.length > 0) {
        buttons.push(Markup.button.callback("🗑 Remove window", "remove"));
      }
      buttons.push(Markup.button.callback("🚫 Exit", "e"));
      await ctx.reply(text, Markup.inlineKeyboard(buttons, twoColumns));
      return ctx.wizard.selectStep(STEP.MENU);
    };

    const weekdayKeyboard = (selected: number[]) =>
      Markup.inlineKeyboard(
        [
          ...[1, 2, 3, 4, 5, 6, 7].map((d) =>
            Markup.button.callback(
              `${selected.includes(d) ? "✅ " : ""}${WEEKDAY_LABELS[d]}`,
              `day_${d}`,
            ),
          ),
          Markup.button.callback("Mon–Fri", "days_weekdays"),
          Markup.button.callback("Sat–Sun", "days_weekends"),
          Markup.button.callback("Every day", "days_all"),
          Markup.button.callback("✔️ Done", "days_done"),
        ],
        // rows: Mon–Thu / Fri–Sun / presets / Done
        { wrap: (_btn, index) => index === 4 || index === 7 || index === 10 },
      );

    const askTime = (ctx: Scenes.WizardContext) =>
      ctx.reply(
        "Send the time range as HH:MM-HH:MM, e.g. 09:00-18:00 or 22:00-06:00 (crosses midnight), or pick one",
        Markup.inlineKeyboard(
          [
            Markup.button.callback("All day", "time_allday"),
            Markup.button.callback("Night 22:00–07:00", "time_night"),
          ],
          twoColumns,
        ),
      );

    const askScope = async (ctx: Scenes.WizardContext) => {
      const subscriptions = await prisma.gymSubscribe.findMany({
        where: { userTelegramId: ctx.from!.id },
        include: { gym: true },
      });
      const buttons = [
        Markup.button.callback("Everything", "scope_ALL"),
        Markup.button.callback("All raids", "scope_RAID"),
        Markup.button.callback("Perfect Pokémon", "scope_PERFECT"),
      ];
      if (subscriptions.length > 0) {
        buttons.push(Markup.button.callback("One gym…", "scope_gym"));
      }
      return ctx.reply(
        "What should this window apply to?",
        Markup.inlineKeyboard(buttons, twoColumns),
      );
    };

    const saveWindow = async (
      ctx: Scenes.WizardContext,
      notifyKind: "ALL" | "RAID" | "PERFECT",
      gymId: string | null,
    ) => {
      const s = state(ctx);
      const window = await prisma.notifyWindow.create({
        data: {
          userTelegramId: ctx.from!.id,
          mode: s.mode!,
          notifyKind,
          gymId,
          weekdays: s.weekdays!.sort((a, b) => a - b).join(","),
          startTime: s.startTime!,
          endTime: s.endTime!,
        },
        include: { gym: true },
      });
      await ctx.reply(`Added: ${describeWindow(window)}\n\n/quietHours to view or change`);
      return ctx.scene.leave();
    };

    // ---- step 1: main menu ------------------------------------------------
    const menuHandler = newStep();
    menuHandler.action("add", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      await ctx.reply(
        "Should this window allow or block notifications?",
        Markup.inlineKeyboard([
          Markup.button.callback("🔔 Allow only during", "mode_ALLOW"),
          Markup.button.callback("🔕 Block during", "mode_BLOCK"),
        ]),
      );
      return ctx.wizard.selectStep(STEP.MODE);
    });
    menuHandler.action("preset", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      await ctx.reply(
        `Work hours preset: blocks all notifications Mon–Fri during work, except lunch.\n\nWhat time does work start? (HH:MM)`,
        Markup.inlineKeyboard([
          Markup.button.callback(WORK_DEFAULTS.start, "work_default"),
        ]),
      );
      return ctx.wizard.selectStep(STEP.WORK_START);
    });
    menuHandler.action("remove", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      const windows = await prisma.notifyWindow.findMany({
        where: { userTelegramId: ctx.from!.id },
        orderBy: { createdAt: "asc" },
      });
      const buttons: InlineKeyboardButton[] = windows.map((w, i) =>
        Markup.button.callback(String(i + 1), `rm_${w.id}`),
      );
      buttons.push(Markup.button.callback("🚫", "e"));
      await ctx.reply(
        "Which window do you want to remove?",
        Markup.inlineKeyboard(buttons, { columns: 4 }),
      );
      return ctx.wizard.selectStep(STEP.REMOVE);
    });
    menuHandler.action("e", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      return ctx.scene.leave();
    });
    withFallback(menuHandler, "Please pick one of the buttons");

    // ---- step 2: allow / block -------------------------------------------
    const modeHandler = newStep();
    modeHandler.action(/^mode_(ALLOW|BLOCK)$/, async (ctx) => {
      await ctx.answerCbQuery();
      state(ctx).mode = ctx.match[1] as NotifyMode;
      state(ctx).weekdays = [];
      await ctx.editMessageText(
        ctx.match[1] === "ALLOW"
          ? "🔔 Allow notifications only during this window"
          : "🔕 Block notifications during this window",
      );
      await ctx.reply("Which days? Tap to toggle, then Done", weekdayKeyboard([]));
      return ctx.wizard.selectStep(STEP.WEEKDAYS);
    });
    withFallback(modeHandler, "Please choose Allow or Block");

    // ---- step 3: weekdays -------------------------------------------------
    const weekdaysHandler = newStep();
    weekdaysHandler.action(/^day_(\d)$/, async (ctx) => {
      const day = Number(ctx.match[1]);
      const s = state(ctx);
      s.weekdays = s.weekdays!.includes(day)
        ? s.weekdays!.filter((d) => d !== day)
        : [...s.weekdays!, day];
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(weekdayKeyboard(s.weekdays).reply_markup);
    });
    weekdaysHandler.action(/^days_(weekdays|weekends|all)$/, async (ctx) => {
      const preset = { weekdays: WEEKDAYS_MON_FRI, weekends: WEEKENDS, all: ALL_WEEKDAYS }[
        ctx.match[1] as "weekdays" | "weekends" | "all"
      ];
      state(ctx).weekdays = [...parseWeekdays(preset)];
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(weekdayKeyboard(state(ctx).weekdays!).reply_markup);
    });
    weekdaysHandler.action("days_done", async (ctx) => {
      const days = state(ctx).weekdays ?? [];
      if (days.length === 0) {
        return ctx.answerCbQuery("Pick at least one day", { show_alert: true });
      }
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `Days: ${days.sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(", ")}`,
      );
      await askTime(ctx);
      return ctx.wizard.selectStep(STEP.TIME);
    });
    withFallback(weekdaysHandler, "Please toggle the days and press Done");

    // ---- step 4: time range ----------------------------------------------
    const timeHandler = newStep();
    const acceptTime = async (
      ctx: Scenes.WizardContext,
      range: { startTime: string; endTime: string },
    ) => {
      state(ctx).startTime = range.startTime;
      state(ctx).endTime = range.endTime;
      await askScope(ctx);
      return ctx.wizard.selectStep(STEP.SCOPE);
    };
    timeHandler.action("time_allday", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageText("Time: all day");
      return acceptTime(ctx, { startTime: DAY_START, endTime: DAY_END });
    });
    timeHandler.action("time_night", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageText("Time: 22:00–07:00");
      return acceptTime(ctx, { startTime: "22:00", endTime: "07:00" });
    });
    timeHandler.on("text", async (ctx) => {
      const range = parseClockRange((ctx.message as Message.TextMessage).text);
      if (!range) {
        return ctx.reply(
          "❌ I couldn't read that. Send a range like 09:00-18:00, or /cancel",
        );
      }
      if (range.startTime === range.endTime) {
        return ctx.reply(
          "❌ Start and end are the same. Use the All day button for a whole day, or /cancel",
        );
      }
      return acceptTime(ctx, range);
    });
    withFallback(timeHandler, "Please send a time range like 09:00-18:00");

    // ---- step 5: scope ----------------------------------------------------
    const scopeHandler = newStep();
    scopeHandler.action(/^scope_(ALL|RAID|PERFECT)$/, async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      return saveWindow(ctx, ctx.match[1] as "ALL" | "RAID" | "PERFECT", null);
    });
    scopeHandler.action("scope_gym", async (ctx) => {
      await ctx.answerCbQuery();
      const subscriptions = await prisma.gymSubscribe.findMany({
        where: { userTelegramId: ctx.from!.id },
        include: { gym: true },
      });
      await ctx.editMessageText(
        "Which gym?",
        Markup.inlineKeyboard(
          subscriptions.map((s) =>
            Markup.button.callback(
              s.gym.gymString ?? s.gym.geoKey ?? s.gym.id,
              `gym_${s.gymId}`,
            ),
          ),
          twoColumns,
        ),
      );
    });
    scopeHandler.action(/^gym_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      return saveWindow(ctx, "RAID", ctx.match[1]);
    });
    withFallback(scopeHandler, "Please pick what the window applies to");

    // ---- steps 6-8: work hours preset ------------------------------------
    const readClock = (ctx: Context): string | null => {
      const text = (ctx.message as Message.TextMessage | undefined)?.text ?? "";
      const minutes = parseClockTime(text);
      return minutes === null ? null : formatClockTime(minutes);
    };

    const askWorkEnd = (ctx: Scenes.WizardContext) => {
      ctx.reply(
        `Work starts ${state(ctx).workStart}. What time does work end? (HH:MM)`,
        Markup.inlineKeyboard([
          Markup.button.callback(WORK_DEFAULTS.end, "work_default"),
        ]),
      );
      return ctx.wizard.selectStep(STEP.WORK_END);
    };
    const askLunch = (ctx: Scenes.WizardContext) => {
      ctx.reply(
        `Work is ${state(ctx).workStart}–${state(ctx).workEnd}. When is lunch? (HH:MM-HH:MM)`,
        Markup.inlineKeyboard([
          Markup.button.callback(WORK_DEFAULTS.lunch, "work_default"),
          Markup.button.callback("No lunch break", "work_nolunch"),
        ]),
      );
      return ctx.wizard.selectStep(STEP.WORK_LUNCH);
    };

    const workStartHandler = newStep();
    workStartHandler.action("work_default", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      state(ctx).workStart = WORK_DEFAULTS.start;
      return askWorkEnd(ctx);
    });
    workStartHandler.on("text", async (ctx) => {
      const time = readClock(ctx);
      if (!time) return ctx.reply("❌ Send a time like 09:00, or /cancel");
      state(ctx).workStart = time;
      return askWorkEnd(ctx);
    });
    withFallback(workStartHandler, "Please send the time work starts, like 09:00");

    const workEndHandler = newStep();
    workEndHandler.action("work_default", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      state(ctx).workEnd = WORK_DEFAULTS.end;
      return askLunch(ctx);
    });
    workEndHandler.on("text", async (ctx) => {
      const time = readClock(ctx);
      if (!time) return ctx.reply("❌ Send a time like 18:00, or /cancel");
      if (parseClockTime(time)! <= parseClockTime(state(ctx).workStart!)!) {
        return ctx.reply("❌ Work must end after it starts. Try again, or /cancel");
      }
      state(ctx).workEnd = time;
      return askLunch(ctx);
    });
    withFallback(workEndHandler, "Please send the time work ends, like 18:00");

    const saveWorkPreset = async (
      ctx: Scenes.WizardContext,
      lunch: { startTime: string; endTime: string } | null,
    ) => {
      const { workStart, workEnd } = state(ctx);
      const blocks = lunch
        ? [
            { startTime: workStart!, endTime: lunch.startTime },
            { startTime: lunch.endTime, endTime: workEnd! },
          ]
        : [{ startTime: workStart!, endTime: workEnd! }];
      await prisma.notifyWindow.createMany({
        data: blocks.map((b) => ({
          userTelegramId: ctx.from!.id,
          mode: "BLOCK",
          notifyKind: "ALL",
          weekdays: WEEKDAYS_MON_FRI,
          ...b,
        })),
      });
      await ctx.reply(
        `Done! You will not be notified Mon–Fri ${
          lunch
            ? `${workStart}–${lunch.startTime} and ${lunch.endTime}–${workEnd}`
            : `${workStart}–${workEnd}`
        }.\n\n/quietHours to view or change`,
      );
      return ctx.scene.leave();
    };

    const workLunchHandler = newStep();
    workLunchHandler.action("work_default", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      return saveWorkPreset(ctx, parseClockRange(WORK_DEFAULTS.lunch));
    });
    workLunchHandler.action("work_nolunch", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      return saveWorkPreset(ctx, null);
    });
    workLunchHandler.on("text", async (ctx) => {
      const lunch = parseClockRange((ctx.message as Message.TextMessage).text);
      const s = state(ctx);
      if (
        !lunch ||
        parseClockTime(lunch.startTime)! >= parseClockTime(lunch.endTime)! ||
        parseClockTime(lunch.startTime)! < parseClockTime(s.workStart!)! ||
        parseClockTime(lunch.endTime)! > parseClockTime(s.workEnd!)!
      ) {
        return ctx.reply(
          `❌ Lunch must be a range inside ${s.workStart}–${s.workEnd}, like 12:00-13:00. Try again, or /cancel`,
        );
      }
      return saveWorkPreset(ctx, lunch);
    });
    withFallback(workLunchHandler, "Please send the lunch break like 12:00-13:00");

    // ---- step 9: remove ---------------------------------------------------
    const removeHandler = newStep();
    removeHandler.action(/^rm_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const deleted = await prisma.notifyWindow.deleteMany({
        where: { id: ctx.match[1], userTelegramId: ctx.from!.id },
      });
      await ctx.editMessageText(
        deleted.count ? "Window removed" : "That window no longer exists",
      );
      return showMenu(ctx);
    });
    removeHandler.action("e", async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined);
      return showMenu(ctx);
    });
    withFallback(removeHandler, "Please pick a window number");

    const wizard = new Scenes.WizardScene<Scenes.WizardContext>(
      "notifyWindowsManage",
      async (ctx) => {
        if (!ctx.from || ctx.chat?.type !== "private") {
          await ctx.reply("Please use the bot in a private chat");
          return ctx.scene.leave();
        }
        return showMenu(ctx);
      },
      menuHandler,
      modeHandler,
      weekdaysHandler,
      timeHandler,
      scopeHandler,
      workStartHandler,
      workEndHandler,
      workLunchHandler,
      removeHandler,
    );

    const stage = new Scenes.Stage<Scenes.WizardContext>([wizard]);
    bot.use(stage.middleware());

    bot.command(["quietHours", "quiethours"], (ctx) =>
      ctx.scene.enter("notifyWindowsManage"),
    );
  } catch (error) {
    console.error("Error in manageNotifyWindows:", error);
  }
};

export default manageNotifyWindows;
