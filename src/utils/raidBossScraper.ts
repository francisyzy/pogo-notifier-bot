import cron from "node-cron";
import { JSDOM } from "jsdom";
import { readCacheFile, writeCacheFile } from "./cache";
import { CACHE_DIR, WEDNESDAY_SCRAPE_CRON, URLS } from "../constants";
import * as fs from "fs";
import * as path from "path";

// The ScrapedDuck page we scrape
const SCRAPE_URL = "https://github.com/bigfoott/ScrapedDuck";

// Minimum interval between scrapes in ms (don't re-scrape if cache is fresh)
const MIN_SCRAPE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches and parses raid bosses from ScrapedDuck GitHub data page.
 * Returns the raw boss data array, or null if scraping fails.
 */
async function scrapeRaidBossesFromScrapedDuck(): Promise<unknown[] | null> {
  try {
    const response = await fetch(SCRAPE_URL, {
      headers: { "Accept": "text/html" }
    });
    if (!response.ok) {
      console.warn(`ScrapedDuck scrape failed: ${response.status}`);
      return null;
    }
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    // The actual JSON data URL is in a script tag or link with data.min.json
    // ScrapedDuck serves data from raw.githubusercontent.com/bigfoott/ScrapedDuck/data/raidBosses.min.json
    // But we can't fetch that directly from a browser, so fetch the raw JSON URL directly
    const dataUrl = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/raidBosses.min.json";
    const dataResponse = await fetch(dataUrl);
    if (!dataResponse.ok) return null;
    const data = await dataResponse.json() as unknown[];
    return Array.isArray(data) ? data : null;
  } catch (error) {
    console.warn("Failed to scrape raid bosses from ScrapedDuck:", error);
    return null;
  }
}

/**
 * Writes raid boss data to cache if it differs from current cache.
 * Returns true if cache was updated.
 */
async function updateCacheIfChanged(bosses: unknown[]): Promise<boolean> {
  const cachePath = path.join(CACHE_DIR, "raid-bosses.json");
  const existing = readCacheFile<unknown[]>("raid-bosses.json");

  if (existing && JSON.stringify(existing) === JSON.stringify(bosses)) {
    console.log("Raid boss cache unchanged, skipping write");
    return false;
  }

  writeCacheFile("raid-bosses.json", bosses);
  console.log(`Raid boss cache updated with ${bosses.length} bosses`);
  return true;
}

/**
 * Run the Wednesday scrape: fetch from ScrapedDuck and update cache.
 */
export async function runWednesdayScrape(): Promise<void> {
  // Check jsdom is available
  try {
    require("jsdom");
  } catch {
    console.warn("jsdom not installed, skipping Wednesday scrape. Run: npm install jsdom && npm install --save-dev @types/jsdom");
    return;
  }

  // Check minimum interval
  const cachePath = path.join(CACHE_DIR, "raid-bosses.json");
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    const age = Date.now() - stat.mtime.getTime();
    if (age < MIN_SCRAPE_INTERVAL_MS) {
      console.log(`Cache still fresh (${Math.round(age / 60000)}min old), skipping scrape`);
      return;
    }
  }

  const bosses = await scrapeRaidBossesFromScrapedDuck();
  if (bosses && bosses.length > 0) {
    await updateCacheIfChanged(bosses);
  }
}

// Track scheduled tasks for cleanup
let scheduledTasks: cron.ScheduledTask[] = [];

/**
 * Registers the Wednesday cron jobs (10:13am and 11:14am SGT).
 * Idempotent — safe to call multiple times.
 */
export function registerWednesdayScraper(): void {
  if (scheduledTasks.length > 0) {
    console.log("Wednesday scraper already registered");
    return;
  }

  for (const cronExpr of WEDNESDAY_SCRAPE_CRON) {
    const task = cron.schedule(cronExpr, () => {
      console.log(`[Wednesday Scraper] Running scheduled scrape at ${new Date().toISOString()}`);
      runWednesdayScrape().catch((err) => {
        console.error("Wednesday scrape error:", err);
      });
    }, {
      scheduled: true,
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
