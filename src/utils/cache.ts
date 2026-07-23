import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { CACHE_DIR } from "../constants";
import { URLS, BACKUP_URLS } from "../constants";
import type { raidBosses } from "../types";

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

// Shape written to and read from cache (subset of full raidBoss shape)
interface RaidBossCache {
  name: string;
  no?: number;
  canBeShiny: boolean;
  tier: string;
  types: string[];
  typeUrls: string[];
  originalName?: string;
  imageUrl?: string;
  shinyAvailable?: boolean;
  image?: string;
  combatPower?: { normal: { min: number; max: number }; boosted: { min: number; max: number } };
  boostedWeather?: string[];
}

function adaptBackupRaidBoss(boss: RaidBossBackup): RaidBossCache {
  return {
    name: boss.originalName,
    canBeShiny: boss.shinyAvailable,
    tier: boss.tier,
    types: [],
    typeUrls: [],
  };
}

export async function fetchRaidBosses(): Promise<RaidBossCache[] | null> {
  const urls: (string | null)[] = [URLS.RAID_BOSSES_JSON, BACKUP_URLS.RAID_BOSSES_JSON];

  for (const url of urls) {
    if (!url) continue;
    try {
      const data = await fetchJson<RaidBossBackup[] | raidBosses>(url);
      const isBackupFormat = Array.isArray(data) && data.length > 0 && "no" in data[0];
      let bosses: RaidBossCache[];
      if (isBackupFormat) {
        console.log(`[cache] Detected backup source format, adapting to current shape`);
        bosses = (data as RaidBossBackup[]).map(adaptBackupRaidBoss);
      } else {
        bosses = data as RaidBossCache[];
      }
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
      return cached.data;
    }
    console.warn(`[cache] Cached raid bosses too stale (${ageMinutes.toFixed(1)} min old)`);
  }
  return null;
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
