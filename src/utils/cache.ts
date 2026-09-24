import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { CACHE_DIR } from "../constants";
import { URLS, BACKUP_URLS } from "../constants";
import type {
  raidBosses,
  TypeInfo,
  WeatherInfo,
  CombatPower,
} from "../types";
import { scrapeLeekDuckRaidBosses } from "./leekduckScraper";
import { applyRotationOverride, RaidRotation } from "./raidRotation";

/** Written by the Wednesday run (raidBossScraper.ts) */
export const ROTATION_CACHE_FILE = "raid-rotation.json";

export async function ensureCacheDir(): Promise<void> {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }
}

export async function readCacheFile<T>(filename: string): Promise<T | null> {
  try {
    const raw = await readFile(`${CACHE_DIR}/${filename}`, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeCacheFile<T>(filename: string, data: T): Promise<void> {
  await ensureCacheDir();
  await writeFile(`${CACHE_DIR}/${filename}`, JSON.stringify(data), "utf-8");
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "pogo-notifier-bot/1.0",
      ...options?.headers,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

interface RaidBossBackup {
  no: number;
  name: string;
  originalName: string;
  shinyAvailable: boolean;
  tier: string;
}

// Shape written to and read from cache: the ScrapedDuck raidBoss shape,
// with the fields the backup source lacks made optional.
export interface RaidBossCache {
  name: string;
  no?: number;
  canBeShiny: boolean;
  tier: string;
  types: TypeInfo[];
  originalName?: string;
  imageUrl?: string;
  shinyAvailable?: boolean;
  image?: string;
  combatPower?: CombatPower;
  boostedWeather: WeatherInfo[];
}

function adaptBackupRaidBoss(boss: RaidBossBackup): RaidBossCache {
  return {
    name: boss.originalName,
    canBeShiny: boss.shinyAvailable,
    tier: boss.tier,
    types: [],
    boostedWeather: [],
  };
}

/**
 * Raid bosses: the source list (see fetchRaidBossList) with this week's
 * rotation from `.cache/raid-rotation.json` overlaid, so a list that
 * still shows last week's 5★/Mega/shadow 5★ bosses is corrected as soon
 * as the rotation starts. The merged result is never cached;
 * raid-bosses.json stays a plain copy of the source.
 */
export async function fetchRaidBosses(): Promise<RaidBossCache[] | null> {
  const list = await fetchRaidBossList();
  const rotation = await readCacheFile<{
    url: string;
    fetchedAt: number;
    data: RaidRotation;
  }>(ROTATION_CACHE_FILE);
  const merged = applyRotationOverride(
    list ?? [],
    rotation?.data,
    Date.now(),
  );
  return list === null && merged.length === 0 ? null : merged;
}

/**
 * Raid bosses, trying in order: ScrapedDuck JSON, the backup JSON (both on
 * GitHub), LeekDuck's HTML page, then the on-disk cache. The cache is
 * served no matter how old it is: boss rotations change roughly weekly,
 * so a stale list beats dropping raid notifications during an outage.
 */
async function fetchRaidBossList(): Promise<RaidBossCache[] | null> {
  const sources: [string, () => Promise<RaidBossCache[]>][] = [
    [URLS.RAID_BOSSES_JSON, () => fetchRaidBossesJson(URLS.RAID_BOSSES_JSON)],
    [BACKUP_URLS.RAID_BOSSES_JSON, () => fetchRaidBossesJson(BACKUP_URLS.RAID_BOSSES_JSON)],
    [URLS.LEEKDUCK_BOSS, scrapeLeekDuckRaidBosses],
  ];

  for (const [url, load] of sources) {
    try {
      const bosses = await load();
      await writeCacheFile("raid-bosses.json", { url, fetchedAt: Date.now(), data: bosses });
      console.log(`[cache] Fetched raid bosses from ${url}`);
      return bosses;
    } catch (err) {
      console.warn(`[cache] Failed to fetch raid bosses from ${url}:`, err instanceof Error ? err.message : err);
    }
  }

  const cached = await readCacheFile<{ url: string; fetchedAt: number; data: RaidBossCache[] }>("raid-bosses.json");
  if (cached) {
    const ageMinutes = (Date.now() - cached.fetchedAt) / 60_000;
    if (ageMinutes <= 120) {
      console.log(`[cache] Using cached raid bosses (${ageMinutes.toFixed(1)} min old)`);
    } else {
      console.warn(`[cache] Every raid boss source failed; using stale cache from ${cached.url} (${(ageMinutes / 60).toFixed(1)} h old)`);
    }
    return cached.data;
  }
  return null;
}

async function fetchRaidBossesJson(url: string): Promise<RaidBossCache[]> {
  const data = await fetchJson<RaidBossBackup[] | raidBosses>(url);
  const isBackupFormat = Array.isArray(data) && data.length > 0 && "no" in data[0];
  if (isBackupFormat) {
    console.log(`[cache] Detected backup source format, adapting to current shape`);
    return (data as RaidBossBackup[]).map(adaptBackupRaidBoss);
  }
  return data as RaidBossCache[];
}

export async function fetchEvents(): Promise<import("../types").rawEvents | null> {
  const cacheFile = "events.json";
  try {
    const data = await fetchJson<import("../types").rawEvents>(URLS.EVENTS_JSON);
    await writeCacheFile(cacheFile, { url: URLS.EVENTS_JSON, fetchedAt: Date.now(), data });
    console.log(`[cache] Fetched events from ${URLS.EVENTS_JSON}`);
    return data;
  } catch (err) {
    console.warn(`[cache] Failed to fetch events:`, err instanceof Error ? err.message : err);
  }
  const cached = await readCacheFile<{ url: string; fetchedAt: number; data: import("../types").rawEvents }>(cacheFile);
  if (cached) {
    console.log(`[cache] Using cached events (${(Date.now() - cached.fetchedAt) / 60_000} min old)`);
    return cached.data;
  }
  return null;
}
