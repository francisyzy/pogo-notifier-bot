/**
 * Offline smoke test — exercises every scheduled feature of the bot without
 * a real Telegram token or a live bot.
 *
 *   npx tsx src/scripts/smokeTest.ts
 *
 * - A dummy API_TOKEN is used and `bot.telegram.callApi` is stubbed, so all
 *   outgoing Telegram calls are captured in memory instead of sent.
 * - Runs against `prisma/dev.db` (the file the runtime resolves), which is
 *   gitignored. Copy your real DB there first if you want realistic data:
 *       cp dev.db prisma/dev.db
 * - Raid/pokemon/event feeds are fetched live; a synthetic raid is injected
 *   at the first subscribed gym so the raid-notification path is always hit.
 */
import "./smokeTestEnv"; // must be first: sets dummy API_TOKEN before bot loads
import { PrismaClient } from "@prisma/client";
import cron from "node-cron";
import bot from "../lib/bot";
import { URLS } from "../constants";
import { getRaids } from "./../utils/getMaper";
import { gymChecker, gymCheckerAdHoc } from "../utils/gymChecker";
import { geoKeyFromLatLng, removeStaleGyms } from "../utils/gymAdder";
import {
  clearAllRaidReminders,
  notifyAndUpdateUsers,
} from "../utils/notifier";
import { notifyLegendary, notifyPerfect } from "../utils/perfectNotifier";
import { notifyEvent } from "../utils/eventNotifier";
import {
  registerWednesdayScraper,
  stopWednesdayScraper,
} from "../utils/raidBossScraper";
import { ensureCacheDir } from "../utils/cache";
import { isNotifyAllowed, localWeekdayAndMinutes } from "../utils/notifyWindows";
import { raids } from "../types";
type raid = raids[number];

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Telegram stub: capture every API call instead of sending it
// ---------------------------------------------------------------------------
type ApiCall = { method: string; payload: Record<string, unknown> };
const apiCalls: ApiCall[] = [];
let nextMessageId = 1;
(bot.telegram as unknown as { callApi: unknown }).callApi = async (
  method: string,
  payload: Record<string, unknown>,
) => {
  apiCalls.push({ method, payload });
  if (method === "sendMessage" || method === "sendPhoto") {
    return { message_id: nextMessageId++, chat: { id: payload.chat_id } };
  }
  return true;
};
const sentTo = (chatId: number) =>
  apiCalls.filter(
    (c) => c.method === "sendMessage" && Number(c.payload.chat_id) === chatId,
  );

// ---------------------------------------------------------------------------
// fetch wrapper: log outbound requests and inject a synthetic raid
// ---------------------------------------------------------------------------
const fetched: string[] = [];
let syntheticRaid: raid | null = null;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  fetched.push(url.split("?")[0]);
  const res = await realFetch(input, init);
  if (syntheticRaid && url.startsWith(URLS.SGPOKEMAP.RAIDS)) {
    const body = (await res.json()) as { raids: raid[] };
    body.raids = [syntheticRaid, ...body.raids];
    return new Response(JSON.stringify(body), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  }
  return res;
}) as typeof fetch;

// ---------------------------------------------------------------------------
// Tiny test runner
// ---------------------------------------------------------------------------
let failures = 0;
async function step(name: string, fn: () => Promise<void>): Promise<void> {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`  ✔ ${name} (${Date.now() - t0}ms)`);
  } catch (err) {
    failures++;
    console.log(`  ✘ ${name}`);
    console.error("    ", err instanceof Error ? err.message : err);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("Smoke test — no Telegram traffic will be sent\n");
  await ensureCacheDir();

  // --- DB sanity ------------------------------------------------------------
  let subscribedGymId = "";
  let subscribedUserId = 0;
  let subscribedLat = 0;
  let subscribedLng = 0;
  await step("database reachable and has subscriptions", async () => {
    const gyms = await prisma.gym.count();
    const subs = await prisma.gymSubscribe.findMany({ include: { gym: true } });
    assert(gyms > 0, "no gyms in DB");
    assert(subs.length > 0, "no gym subscriptions in DB — nothing to notify");
    const nullGeo = await prisma.gym.count({ where: { geoKey: null } });
    console.log(
      `    gyms=${gyms} subscriptions=${subs.length} nullGeoKey=${nullGeo}`,
    );
    subscribedGymId = subs[0].gymId;
    subscribedUserId = subs[0].userTelegramId;
    subscribedLat = subs[0].gym.lat;
    subscribedLng = subs[0].gym.long;
  });
  if (!subscribedGymId) throw new Error("cannot continue without a subscription");

  // Make sure the user will actually be notified (not muted / level filtered)
  const user = await prisma.user.findUnique({ where: { telegramId: subscribedUserId } });
  assert(user, "subscribed user missing");
  await prisma.user.update({
    where: { telegramId: subscribedUserId },
    data: { stopNotifyingMeToday: null },
  });

  // --- Live feeds -----------------------------------------------------------
  let liveRaids: raid[] = [];
  await step("getRaids() fetches live raid feed", async () => {
    liveRaids = await getRaids();
    assert(Array.isArray(liveRaids), "raids is not an array");
    console.log(`    live raids=${liveRaids.length}`);
  });

  // --- Synthetic raid at the subscribed gym --------------------------------
  const startsIn = 30 * 60; // 30 min from now → future egg, reminder eligible
  const nowSec = Math.floor(Date.now() / 1000);
  syntheticRaid = {
    gym_name: "SMOKE TEST GYM",
    cell_id: "0",
    ex_raid_eligible: 0,
    sponsor: 0,
    lat: subscribedLat,
    lng: subscribedLng,
    raid_spawn: nowSec,
    raid_start: nowSec + startsIn,
    raid_end: nowSec + startsIn + 45 * 60,
    pokemon_id: 0,
    level: 5,
    cp: 0,
    team: 0,
    move1: 0,
    move2: 0,
    is_exclusive: 0,
    form: 0,
    gender: 0,
  };
  // Remove any prior event for this synthetic raid so the run is repeatable
  await prisma.gymEvent.deleteMany({
    where: { eventTime: new Date(syntheticRaid.raid_start * 1000) },
  });

  await step("gymChecker() matches raid to subscription via geoKey", async () => {
    const msgs = await gymChecker([syntheticRaid!]);
    assert(
      msgs.some((m) => m.gymId === subscribedGymId && m.userTelegramId === subscribedUserId),
      "subscribed gym not matched",
    );
  });

  await step("gymChecker() still matches when gym.geoKey is NULL (fallback)", async () => {
    const gym = await prisma.gym.findUnique({ where: { id: subscribedGymId } });
    assert(gym, "gym missing");
    const savedKey = gym.geoKey;
    await prisma.gym.update({ where: { id: subscribedGymId }, data: { geoKey: null } });
    try {
      const msgs = await gymChecker([syntheticRaid!]);
      assert(msgs.some((m) => m.gymId === subscribedGymId), "NULL-geoKey gym was dropped");
      const adHoc = await gymCheckerAdHoc([syntheticRaid!], [{ ...gym, geoKey: null }]);
      assert(adHoc.length === 1 && adHoc[0].gymId === subscribedGymId, "adHoc fallback failed");
    } finally {
      // updateGyms() (fire-and-forget inside gymChecker) will have upserted a
      // fresh gym row under this geoKey — the very thing that broke prod.
      // Remove it before handing the key back to the original row.
      await new Promise((r) => setTimeout(r, 500));
      await prisma.gym.deleteMany({ where: { geoKey: savedKey, id: { not: subscribedGymId } } });
      await prisma.gym.update({ where: { id: subscribedGymId }, data: { geoKey: savedKey } });
    }
  });

  await step("notifyWindows: evaluator handles block/allow/gym/wrap windows", async () => {
    const base = { id: "w", userTelegramId: 0, notifyKind: "ALL", gymId: null as string | null, createdAt: new Date() };
    const w = (o: Partial<typeof base> & { mode: string; weekdays: string; startTime: string; endTime: string }) => ({ ...base, ...o });
    const sgt = (local: string) => new Date(local + "+08:00"); // 2026-09-21 is a Monday
    const work = [
      w({ mode: "BLOCK", weekdays: "1,2,3,4,5", startTime: "09:00", endTime: "12:00" }),
      w({ mode: "BLOCK", weekdays: "1,2,3,4,5", startTime: "13:00", endTime: "18:00" }),
    ];
    assert(localWeekdayAndMinutes(sgt("2026-09-21T10:30")).weekday === 1, "SGT weekday wrong");
    assert(!isNotifyAllowed(work, { kind: "RAID", at: sgt("2026-09-21T10:00") }), "work hours should block");
    assert(isNotifyAllowed(work, { kind: "RAID", at: sgt("2026-09-21T12:30") }), "lunch should allow");
    assert(isNotifyAllowed(work, { kind: "RAID", at: sgt("2026-09-26T10:00") }), "saturday should allow");
    const gymTue = [...work, w({ mode: "ALLOW", gymId: "G1", weekdays: "2", startTime: "00:00", endTime: "23:59" })];
    assert(isNotifyAllowed(gymTue, { kind: "RAID", gymId: "G1", at: sgt("2026-09-22T10:00") }), "gym window should override global block");
    assert(!isNotifyAllowed(gymTue, { kind: "RAID", gymId: "G1", at: sgt("2026-09-21T20:00") }), "gym allow-only should block other days");
    assert(!isNotifyAllowed(gymTue, { kind: "RAID", gymId: "G2", at: sgt("2026-09-21T10:00") }), "other gym should follow global");
    const night = [w({ mode: "BLOCK", notifyKind: "PERFECT", weekdays: "1,2,3,4,5,6,7", startTime: "23:00", endTime: "07:00" })];
    assert(!isNotifyAllowed(night, { kind: "PERFECT", at: sgt("2026-09-22T03:00") }), "wrapped window should block after midnight");
    assert(isNotifyAllowed(night, { kind: "RAID", at: sgt("2026-09-22T03:00") }), "PERFECT window should not affect raids");
    assert(isNotifyAllowed([], { kind: "RAID" }), "no windows should allow");
  });

  await step("notifyAndUpdateUsers() skips the raid while a BLOCK window is active", async () => {
    const block = await prisma.notifyWindow.create({
      data: { userTelegramId: subscribedUserId, mode: "BLOCK", weekdays: "1,2,3,4,5,6,7", startTime: "00:00", endTime: "23:59" },
    });
    try {
      const before = sentTo(subscribedUserId).length;
      await notifyAndUpdateUsers();
      await new Promise((r) => setTimeout(r, 1500));
      assert(sentTo(subscribedUserId).length === before, "raid was sent despite BLOCK window");
      const ev = await prisma.gymEvent.findFirst({
        where: { gymSubscribeGymId: subscribedGymId, eventTime: new Date(syntheticRaid!.raid_start * 1000) },
      });
      assert(!ev, "skipped raid must not be recorded as notified");
    } finally {
      await prisma.notifyWindow.delete({ where: { id: block.id } });
    }
  });

  await step("notifyAndUpdateUsers() sends a raid message for the synthetic raid", async () => {
    const before = sentTo(subscribedUserId).length;
    await notifyAndUpdateUsers();
    // notifier chains .then() without awaiting the outer promise fully; give it a tick
    await new Promise((r) => setTimeout(r, 1500));
    const after = sentTo(subscribedUserId);
    assert(after.length > before, "no sendMessage captured for subscribed user");
    const last = after[after.length - 1];
    assert(last.payload.parse_mode === "HTML", "parse_mode not HTML");
    console.log(`    message preview: ${String(last.payload.text).split("\n")[0]}`);
    const ev = await prisma.gymEvent.findFirst({
      where: { gymSubscribeGymId: subscribedGymId, eventTime: new Date(syntheticRaid!.raid_start * 1000) },
    });
    assert(ev, "GymEvent row not recorded");
  });

  await step("notifyAndUpdateUsers() does not re-notify the same raid (P2002 dedup)", async () => {
    const before = sentTo(subscribedUserId).length;
    await notifyAndUpdateUsers();
    await new Promise((r) => setTimeout(r, 1500));
    assert(sentTo(subscribedUserId).length === before, "duplicate notification sent");
  });

  await step("updateGyms() upserts by geoKey without creating duplicates", async () => {
    const key = geoKeyFromLatLng(subscribedLat, subscribedLng);
    const n = await prisma.gym.count({ where: { geoKey: key } });
    assert(n === 1, `expected 1 gym with geoKey ${key}, found ${n}`);
  });

  syntheticRaid = null;

  await step("removeStaleGyms() runs", async () => {
    const removed = await removeStaleGyms();
    console.log(`    removed=${removed}`);
  });

  await step("notifyPerfect() runs against live feed", async () => {
    await notifyPerfect();
  });
  await step("notifyLegendary() runs against live feed", async () => {
    await notifyLegendary();
  });
  await step("notifyEvent() runs against live feed", async () => {
    await notifyEvent();
  });

  await step("node-cron v4: index.ts cron expressions validate", async () => {
    for (const expr of ["45 0-23 * * *", "*/10 5-20 * * *", "44-59 17 * * 3", "0 4 * * *"]) {
      assert(cron.validate(expr), `invalid cron expression: ${expr}`);
    }
  });

  await step("node-cron v4: Wednesday scraper registers and stops", async () => {
    const before = cron.getTasks().size;
    registerWednesdayScraper();
    const during = cron.getTasks().size;
    assert(during > before, "no tasks registered");
    registerWednesdayScraper(); // idempotent
    assert(cron.getTasks().size === during, "re-register created extra tasks");
    stopWednesdayScraper();
  });

  await step("node-cron v4: schedule() with timezone fires a task", async () => {
    let fired = false;
    const task = cron.schedule("* * * * * *", () => { fired = true; }, { timezone: "Asia/Singapore" });
    await new Promise((r) => setTimeout(r, 1500));
    task.stop();
    await task.destroy();
    assert(fired, "task never fired");
  });

  clearAllRaidReminders();

  // --- Summary --------------------------------------------------------------
  console.log("\nOutbound HTTP hosts:", [...new Set(fetched.map((u) => new URL(u).host))].join(", "));
  console.log("Captured Telegram calls:", apiCalls.length);
  for (const [m, n] of Object.entries(
    apiCalls.reduce<Record<string, number>>((acc, c) => ((acc[c.method] = (acc[c.method] ?? 0) + 1), acc), {}),
  )) console.log(`  ${m}: ${n}`);

  // Undo the synthetic-raid side effects so the DB is left as we found it
  await prisma.gymEvent.deleteMany({ where: { eventTime: new Date((nowSec + startsIn) * 1000) } });
  await prisma.user.update({
    where: { telegramId: subscribedUserId },
    data: { stopNotifyingMeToday: user.stopNotifyingMeToday, gymTimesNotified: user.gymTimesNotified },
  });

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error("Smoke test crashed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // cron tasks / reminder timeouts would otherwise keep the process alive
    setTimeout(() => process.exit(process.exitCode ?? 0), 200).unref();
  });
