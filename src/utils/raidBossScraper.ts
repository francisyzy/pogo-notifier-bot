import cron, { ScheduledTask } from "node-cron";
import { rm } from "fs/promises";
import {
  fetchEvents,
  writeCacheFile,
  RaidBossCache,
  ROTATION_CACHE_FILE,
} from "./cache";
import { CACHE_DIR, URLS, WEDNESDAY_SCRAPE_CRON } from "../constants";
import { scrapeLeekDuckRaidBosses } from "./leekduckScraper";
import { buildRotation } from "./raidRotation";

/**
 * The Wednesday run: builds this week's 5★/Mega/shadow 5★ rotation from
 * ScrapedDuck's events feed and writes `.cache/raid-rotation.json`,
 * which fetchRaidBosses overlays on the (often hours-late) boss list.
 * LeekDuck's page is scraped too, as a CP/types/shiny source for
 * bosses the list doesn't have yet. Removes the file when no raid
 * event is active; leaves it alone if the events feed is unavailable.
 */
export async function runWednesdayScrape(): Promise<void> {
  const events = await fetchEvents();
  if (!events) {
    console.warn("[rotation] No events feed; keeping existing rotation");
    return;
  }

  let known: RaidBossCache[] = [];
  try {
    known = await scrapeLeekDuckRaidBosses();
  } catch (error) {
    console.warn(
      "[rotation] LeekDuck scrape failed; override bosses may lack CP:",
      error instanceof Error ? error.message : error,
    );
  }

  const rotation = buildRotation(events, known, Date.now());
  if (!rotation) {
    await rm(`${CACHE_DIR}/${ROTATION_CACHE_FILE}`, { force: true });
    console.log("[rotation] No active raid-battles events; override cleared");
    return;
  }
  await writeCacheFile(ROTATION_CACHE_FILE, {
    url: URLS.EVENTS_JSON,
    fetchedAt: Date.now(),
    data: rotation,
  });
  console.log(
    `[rotation] ${rotation.bosses.map((b) => b.name).join(", ")} until ${new Date(rotation.validUntil).toISOString()}`,
  );
}

// Track scheduled tasks for cleanup
let scheduledTasks: ScheduledTask[] = [];

/**
 * Registers the Wednesday cron jobs (6:13am and 7:14am SGT, shortly after the 6:00am rotation).
 * index.ts also runs runWednesdayScrape once at startup, on any weekday.
 * Idempotent — safe to call multiple times.
 */
export function registerWednesdayScraper(): void {
  if (scheduledTasks.length > 0) {
    console.log("Wednesday scraper already registered");
    return;
  }

  for (const cronExpr of Object.values(WEDNESDAY_SCRAPE_CRON)) {
    const task = cron.schedule(cronExpr, () => {
      console.log(`[Wednesday Scraper] Running scheduled scrape at ${new Date().toISOString()}`);
      runWednesdayScrape().catch((err) => {
        console.error("Wednesday scrape error:", err);
      });
    }, {
      timezone: "Asia/Singapore"
    });
    scheduledTasks.push(task);
    console.log(`Wednesday scraper registered: ${cronExpr} SGT`);
  }
}

/**
 * Stops all scheduled Wednesday scraper tasks.
 */
export function stopWednesdayScraper(): void {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks = [];
  console.log("Wednesday scraper stopped");
}
