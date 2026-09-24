import { Pokedex } from "pmgo-pokedex";
import type { rawEvents } from "../types";
import type { RaidBossCache } from "./cache";
import { isShadowBoss, raidBossTier } from "./raidTier";

/**
 * This week's 5★ / Mega / shadow 5★ bosses, built from ScrapedDuck's
 * `raid-battles` events. The events feed lists rotations weeks ahead,
 * while `raids.min.json` mirrors LeekDuck's raid-bosses page and can
 * lag the 06:00 SGT Wednesday rotation by hours. 1★/3★ never appear
 * in events, so those tiers always come from the boss list.
 */
export interface RaidRotation {
  /** Epoch ms of the earliest end among the events used */
  validUntil: number;
  /** Tier groups the override covers, e.g. "5-Star Raids" (info only) */
  tiers: string[];
  bosses: RaidBossCache[];
}

// Fixed game table: which weather boosts which type
const TYPE_WEATHER: Record<string, string> = {
  grass: "sunny",
  ground: "sunny",
  fire: "sunny",
  water: "rainy",
  electric: "rainy",
  bug: "rainy",
  normal: "partly cloudy",
  rock: "partly cloudy",
  fairy: "cloudy",
  fighting: "cloudy",
  poison: "cloudy",
  dragon: "windy",
  flying: "windy",
  psychic: "windy",
  ice: "snow",
  steel: "snow",
  dark: "fog",
  ghost: "fog",
};

const pokedex = new Pokedex("en-US");
type PokedexEntry = ReturnType<Pokedex["getPokemonByFuzzyName"]>;

function pokedexEntry(name: string): PokedexEntry | undefined {
  // Typed as always returning, but yields undefined for odd names
  return pokedex.getPokemonByFuzzyName(
    name.replace(/^Shadow\s+/i, ""),
  ) as PokedexEntry | undefined;
}

const keyMemo = new Map<string, string>();

/**
 * Identity of a boss across sources: pokedex number + form + shadow
 * and mega/primal flags. Names differ between feeds (events say
 * "Zamazenta (Hero of Many Battles)", ScrapedDuck "Zamazenta (Hero)").
 */
export function raidBossKey(boss: { name: string }): string {
  const name = boss.name.trim();
  const memo = keyMemo.get(name);
  if (memo !== undefined) return memo;
  const bare = name.replace(/^Shadow\s+/i, "");
  const entry = pokedexEntry(bare);
  const id =
    entry === undefined
      ? bare.toLowerCase()
      : `${entry.no}|${(entry.form ?? "").toLowerCase()}`;
  const primal = /^Primal\s/i.test(bare) ? "|primal" : "";
  const key = `${id}${isShadowBoss({ name }) ? "|shadow" : ""}${primal}`;
  keyMemo.set(name, key);
  return key;
}

/** Tier group: regular 5★, shadow 5★ and mega are separate groups */
function tierGroup(boss: { name: string; tier: string }): string {
  return `${raidBossTier(boss)}${isShadowBoss(boss) ? "-shadow" : ""}`;
}

/**
 * Overlays a rotation onto a boss list. Per tier group the override
 * covers: if the list already has every override boss, the list is
 * kept as is (the source has caught up, maybe with extras); otherwise
 * the group is replaced by the override's bosses, reusing the list's
 * entry for any boss it already has (it carries CP figures). Expired
 * overrides are ignored.
 */
export function applyRotationOverride(
  list: RaidBossCache[],
  rotation: RaidRotation | null | undefined,
  now: number,
): RaidBossCache[] {
  if (!rotation || now >= rotation.validUntil) return list;

  const groups = new Map<string, RaidBossCache[]>();
  for (const boss of rotation.bosses) {
    const group = tierGroup(boss);
    groups.set(group, [...(groups.get(group) ?? []), boss]);
  }

  let result = list;
  for (const [group, overrideBosses] of groups) {
    const current = result.filter((b) => tierGroup(b) === group);
    const currentByKey = new Map(
      current.map((b) => [raidBossKey(b), b]),
    );
    if (overrideBosses.every((b) => currentByKey.has(raidBossKey(b)))) {
      continue;
    }
    const replacement = overrideBosses.map(
      (b) => currentByKey.get(raidBossKey(b)) ?? b,
    );
    const next: RaidBossCache[] = [];
    let inserted = false;
    for (const boss of result) {
      if (tierGroup(boss) !== group) {
        next.push(boss);
      } else if (!inserted) {
        next.push(...replacement);
        inserted = true;
      }
    }
    if (!inserted) next.push(...replacement);
    result = next;
  }
  return result;
}

/**
 * Event times have no zone ("2026-09-23T06:00:00.000") and are local
 * time; the bot is Singapore-only, so read them as SGT.
 */
export function parseEventTime(time: string | null): number {
  if (!time) return NaN;
  const hasZone = /(?:[zZ]|[+-]\d\d:?\d\d)$/.test(time);
  return Date.parse(hasZone ? time : `${time}+08:00`);
}

type EventKind = "five" | "mega" | "shadow";

function eventKind(name: string): EventKind | undefined {
  if (/shadow raids/i.test(name)) return "shadow";
  if (/mega raids/i.test(name)) return "mega";
  if (/5-star/i.test(name)) return "five";
  return undefined;
}

interface EventBoss {
  name: string;
  image?: string;
  canBeShiny?: boolean;
}

/**
 * Boss entry for an override boss. Prefers a matching entry from
 * `known` (LeekDuck scrape: has CP, types, weather); otherwise types
 * come from the pokedex and boostedWeather from the type table, with
 * no CP until a source lists it.
 */
function overrideBoss(
  boss: RaidBossCache,
  known: RaidBossCache[],
): RaidBossCache {
  const key = raidBossKey(boss);
  const match = known.find(
    (k) => raidBossKey(k) === key && tierGroup(k) === tierGroup(boss),
  );
  if (match) return { ...match, tier: boss.tier };

  const types = (pokedexEntry(boss.name)?.types ?? []).map((t) =>
    t.toLowerCase(),
  );
  const weathers = [
    ...new Set(
      types
        .map((t) => TYPE_WEATHER[t])
        .filter((w): w is string => w !== undefined),
    ),
  ];
  return {
    ...boss,
    types: types.map((name) => ({ name, image: "" })),
    boostedWeather: weathers.map((name) => ({ name, image: "" })),
  };
}

/**
 * Rotation from the `raid-battles` events active at `now`, or null when
 * none are. Events without start/end (undated leftovers) are ignored.
 * @param known Boss entries to enrich from (LeekDuck scrape)
 */
export function buildRotation(
  events: rawEvents,
  known: RaidBossCache[],
  now: number,
): RaidRotation | null {
  const bosses: RaidBossCache[] = [];
  const tiers = new Set<string>();
  let validUntil = Infinity;

  for (const event of events) {
    if (event.eventType !== "raid-battles") continue;
    const start = parseEventTime(event.start);
    const end = parseEventTime(event.end);
    if (!(start <= now && now < end)) continue;
    const kind = eventKind(event.name);
    const list = event.extraData?.raidbattles?.bosses;
    if (!kind || !Array.isArray(list)) {
      console.warn(`[rotation] Skipping raid event "${event.name}"`);
      continue;
    }

    const tier = kind === "mega" ? "Mega Raids" : "5-Star Raids";
    for (const raw of list as EventBoss[]) {
      if (typeof raw?.name !== "string") continue;
      // Shadow events name bosses without the "Shadow " prefix
      const name =
        kind === "shadow" && !/^shadow\s/i.test(raw.name)
          ? `Shadow ${raw.name}`
          : raw.name;
      const boss = overrideBoss(
        {
          name,
          tier,
          canBeShiny: raw.canBeShiny === true,
          types: [],
          boostedWeather: [],
          image: raw.image ?? "",
        },
        known,
      );
      const key = raidBossKey(boss);
      if (bosses.some((b) => raidBossKey(b) === key)) continue;
      bosses.push(boss);
      tiers.add(kind === "shadow" ? `Shadow ${tier}` : tier);
    }
    validUntil = Math.min(validUntil, end);
  }

  if (bosses.length === 0) return null;
  return { validUntil, tiers: [...tiers], bosses };
}
