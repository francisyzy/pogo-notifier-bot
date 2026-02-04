import { formatDistanceToNow, formatISO9075 } from "date-fns";
import { pokemonMessage, raidBosses, raidMessage } from "../types";
import { URLS, RAID_CONFIG } from "../constants";

/**
 * Fetches JSON from a URL with proper error handling
 * @param url The URL to fetch
 * @param options Optional fetch options
 * @returns Parsed JSON response
 * @throws Error if fetch fails or response is not OK
 */
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Network error fetching ${url}: ${error.message}`);
    }
    throw new Error(`Unknown error fetching ${url}`);
  }
}

/**
 * Checks if a boss is a shadow Pokemon
 * @param boss Boss object with originalName and name properties
 * @returns true if the boss is a shadow Pokemon
 */
function isShadowBoss(boss: {
  originalName: string;
  name: string;
}): boolean {
  return (
    boss.originalName.toLowerCase().includes("shadow") ||
    boss.name.toLowerCase().includes("shadow")
  );
}

/**
 * Detects if a raid is a shadow raid and returns the actual tier
 * Shadow raids have their level increased by RAID_CONFIG.SHADOW_RAID_LEVEL_OFFSET in upstream data
 * (e.g., shadow 1* = level 11, shadow 3* = level 13, shadow 5* = level 15)
 * @param level The raid level from upstream
 * @param bosses List of all raid bosses
 * @returns Object with actual tier and whether it's a shadow raid
 */
function getActualRaidTier(
  level: number,
  bosses: raidBosses,
): { tier: number; isShadow: boolean } {
  // Shadow raids have level +offset, so check if level >= MIN_SHADOW_RAID_LEVEL
  // and if there are shadow bosses at level - offset
  if (level >= RAID_CONFIG.MIN_SHADOW_RAID_LEVEL) {
    const potentialTier = level - RAID_CONFIG.SHADOW_RAID_LEVEL_OFFSET;
    if (potentialTier > 0) {
      const shadowBossesAtTier = bosses.filter(
        (boss) =>
          Number(boss.tier === "mega" ? "6" : boss.tier) === potentialTier &&
          isShadowBoss(boss),
      );
      // If we find shadow bosses at the lower tier, this is a shadow raid
      if (shadowBossesAtTier.length > 0) {
        return { tier: potentialTier, isShadow: true };
      }
    }
  }
  return { tier: level, isShadow: false };
}

/**
 * Formats raid message
 * @param raidMessage original raidMessage information
 * @returns {Promise<string>} Message formatted to send to user
 * @throws Error if unable to fetch raid boss data
 */
export async function raidMessageFormatter(
  raidMessage: raidMessage,
): Promise<string> {
  let bosses: raidBosses;
  try {
    bosses = await fetchJson<raidBosses>(URLS.RAID_BOSSES_JSON);
  } catch (error) {
    console.error("Failed to fetch raid bosses:", error);
    throw new Error(
      "Unable to fetch raid boss data. Please try again later.",
    );
  }

  // Get actual raid tier and whether it's a shadow raid
  const { tier: actualTier, isShadow } = getActualRaidTier(
    raidMessage.level,
    bosses,
  );

  let possibleBosses = `\n\n<a href="${URLS.LEEKDUCK_BOSS}">Possible raid boss</a>: (`;
  let bossName = "";

  bosses.forEach((raidBoss) => {
    const url = urlFormatter(raidBoss.originalName, raidBoss.tier);
    
    // If it's not a shadow raid, exclude shadow bosses
    if (!isShadow && isShadowBoss(raidBoss)) {
      return;
    }
    
    //If the egg has popped, use leek duck info at the start
    if (raidMessage.pokemonId === raidBoss.no) {
      bossName = `<a href="${url}">${raidBoss.originalName}</a>`;
      bossName += raidBoss.shinyAvailable ? "✨" : "";
    } else if (
      Number(
        raidBoss.tier === "mega"
          ? RAID_CONFIG.MEGA_RAID_TIER.toString()
          : raidBoss.tier,
      ) === actualTier
    ) {
      possibleBosses += `<a href="${url}">${raidBoss.originalName}</a>`;
      possibleBosses += raidBoss.shinyAvailable ? "✨, " : ", ";
    }
  });
  possibleBosses = possibleBosses.slice(0, -2);
  possibleBosses += ")";

  //If leek duck has no info and raid has popped
  if (bossName === "" && raidMessage.pokemonId !== 0) {
    let name: string;
    try {
      const pokemonData = await fetchJson<{ name: string }>(
        `${URLS.POKEAPI_POKEMON}/${raidMessage.pokemonId}`,
      );
      name = pokemonData.name;
    } catch (error) {
      console.error(
        `Failed to fetch Pokemon data for ID ${raidMessage.pokemonId}:`,
        error,
      );
      // Fallback: use Pokemon ID if name fetch fails
      name = `Pokemon #${raidMessage.pokemonId}`;
    }

    let pokebattlerName: string;
    if (isShadow) {
      // Format shadow Pokemon as POKEMON_NAME_SHADOW_FORM
      // Normalize Alolan names using the helper function
      let pokemonName = normalizeAlolanNameForShadow(name);
      pokebattlerName =
        pokemonName.toUpperCase().replace(/[-\s]/g, "_") + "_SHADOW_FORM";
    } else if (actualTier === RAID_CONFIG.MEGA_RAID_TIER) {
      pokebattlerName = name + "_MEGA";
    } else {
      pokebattlerName = name.replace(/\s/g, "_");
    }
    bossName = toTitleCase(
      `<a href="${URLS.POKEBATTLER_RAIDS}/${pokebattlerName}">${name}</a>`,
    );
  }

  const message = `${actualTier}★ Raid at <u>${
    raidMessage.name
  }</u> ${
    raidMessage.pokemonId === 0 ? "starting" : "started"
  } at ${formatISO9075(raidMessage.start, {
    representation: "time",
  })} (${formatDistanceToNow(raidMessage.start, {
    addSuffix: true,
  })})${
    raidMessage.pokemonId === 0
      ? ""
      : ` and will end at ${formatISO9075(raidMessage.end, {
          representation: "time",
        })}(${formatDistanceToNow(raidMessage.end, {
          addSuffix: true,
        })})`
  }${
    raidMessage.pokemonId === 0
      ? possibleBosses
      : ` with boss ${bossName}`
  }`;
  return message;
}

/**
 * Checks how many pokemon are there in each raid level
 * @param raidMessage original raidMessage information
 * @returns {Promise<number>} number of possible bosses from information given
 * @throws Error if unable to fetch raid boss data
 */
export async function bossCount(
  raidMessage: raidMessage,
): Promise<number> {
  let bosses: raidBosses;
  try {
    bosses = await fetchJson<raidBosses>(URLS.RAID_BOSSES_JSON);
  } catch (error) {
    console.error("Failed to fetch raid bosses:", error);
    throw new Error(
      "Unable to fetch raid boss data. Please try again later.",
    );
  }

  // Get actual raid tier and whether it's a shadow raid
  const { tier: actualTier, isShadow } = getActualRaidTier(
    raidMessage.level,
    bosses,
  );

  return bosses.filter((boss) => {
    // If it's not a shadow raid, exclude shadow bosses
    if (!isShadow && isShadowBoss(boss)) {
      return false;
    }
    return (
      Number(
        boss.tier === "mega"
          ? RAID_CONFIG.MEGA_RAID_TIER.toString()
          : boss.tier,
      ) === actualTier
    );
  }).length;
}

/**
 * Formats perfect message
 * @param pokemonMessage original pokemonMessage information
 * @returns {Promise<string>} Message formatted to send to the user
 * @throws Error if unable to fetch Pokemon data
 */
export async function perfectMessageFormatter(
  pokemonMessage: pokemonMessage,
): Promise<string> {
  let name: string;
  try {
    const pokemonData = await fetchJson<{ name: string }>(
      `${URLS.POKEAPI_POKEMON}/${pokemonMessage.pokemon_id}`,
    );
    name = pokemonData.name;
  } catch (error) {
    console.error(
      `Failed to fetch Pokemon data for ID ${pokemonMessage.pokemon_id}:`,
      error,
    );
    // Fallback: use Pokemon ID if name fetch fails
    name = `Pokemon #${pokemonMessage.pokemon_id}`;
  }

  const message = `Perfect pokemon ${toTitleCase(name)}(CP ${
    pokemonMessage.cp
  }) despawns at ${formatISO9075(pokemonMessage.despawnDate, {
    representation: "time",
  })}(${formatDistanceToNow(pokemonMessage.despawnDate, {
    addSuffix: true,
  })})`;
  return message;
}

/**
 * Caps the first char of all words
 * @param str input string
 * @returns Title Case Strings
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

/**
 * Normalizes Alolan Pokemon names to Pokebattler format
 * Converts "Alolan X" or "Alola X" to "X Alola"
 * Handles various formats: "Alolan Marowak", "Alola Marowak", "marowak-alola", "alola-marowak"
 * @param pokemonName The Pokemon name (may contain "Alolan" or "Alola")
 * @returns Normalized name in "Pokemon Alola" format, or original name if not Alolan
 */
function normalizeAlolanName(pokemonName: string): string {
  const lowerName = pokemonName.toLowerCase();
  if (lowerName.includes("alolan") || lowerName.includes("alola")) {
    // Handle "alola-marowak" format: reorder to "marowak-alola"
    if (lowerName.includes("-")) {
      const parts = pokemonName.split("-");
      if (parts.length === 2 && parts[0].toLowerCase() === "alola") {
        return parts[1] + "-alola";
      }
    }
    // Handle "Alolan X" or "Alola X" prefix: remove and add " Alola" suffix
    // Remove "Alolan " or "Alola " prefix and reorder: "Alolan Marowak" -> "Marowak Alola"
    return pokemonName.replace(/(Alolan|Alola)\s+/i, "").trim() + " Alola";
  }
  return pokemonName;
}

/**
 * Normalizes Alolan Pokemon names specifically for shadow Pokemon URLs
 * Handles PokeAPI formats like "marowak-alola" or "alola-marowak"
 * @param pokemonName The Pokemon name from PokeAPI
 * @returns Normalized name ready for shadow form URL formatting
 */
function normalizeAlolanNameForShadow(pokemonName: string): string {
  const lowerName = pokemonName.toLowerCase();
  // Handle PokeAPI format: "marowak-alola" or "alola-marowak"
  if (lowerName.includes("alolan")) {
    return pokemonName.replace(/-?alolan/i, "").trim() + "-alola";
  } else if (lowerName.includes("alola")) {
    // Check if format is "alola-marowak" and needs reordering
    const parts = pokemonName.split("-");
    if (parts.length === 2 && parts[0].toLowerCase() === "alola") {
      return parts[1] + "-alola";
    }
    // Already in correct format "marowak-alola"
    return pokemonName;
  }
  return pokemonName;
}

export function urlFormatter(
  originalName: string,
  raidTier: string,
): string {
  const base = URLS.POKEBATTLER_RAIDS;
  let url = `${base}/${originalName.replace(/\s/g, "_")}`;
  
  // Check if it's a shadow Pokemon (case-insensitive)
  const isShadow = originalName.toLowerCase().includes("shadow");
  if (isShadow) {
    // Extract Pokemon name (remove "Shadow " prefix)
    let pokemonName = originalName.replace(/^Shadow\s+/i, "").trim();
    
    // Normalize Alolan names if present
    pokemonName = normalizeAlolanName(pokemonName);
    
    // Format as POKEMON_NAME_SHADOW_FORM (uppercase, spaces to underscores)
    // For forms like "Marowak Alola", it becomes "MAROWAK_ALOLA_SHADOW_FORM"
    const formattedName = pokemonName.toUpperCase().replace(/\s/g, "_") + "_SHADOW_FORM";
    url = `${base}/${formattedName}`;
  } else if (raidTier === "mega" || raidTier === RAID_CONFIG.MEGA_RAID_TIER.toString()) {
    //TODO check if future forms are still correct
    url = `${base}/${originalName.slice(5) + "_MEGA"}`;
  } else if (originalName.includes("Deoxys (Att")) {
    url = `${base}/DEOXYS_ATTACK_FORM`;
  } else if (originalName.includes("Deoxys (Def")) {
    url = `${base}/DEOXYS_DEFENSE_FORM`;
  } else if (originalName.includes("Deoxys (Speed")) {
    url = `${base}/DEOXYS_SPEED_FORM`;
  } else if (originalName.includes("Deoxys (Normal")) {
    url = `${base}/DEOXYS`;
  } else if (originalName.includes("Genesect (Shock)")) {
    url = `${base}/GENESECT_SHOCK_FORM`;
  } else if (originalName.includes("Genesect (Chill)")) {
    url = `${base}/GENESECT_CHILL_FORM`;
  } else if (originalName.includes("Genesect (Burn)")) {
    url = `${base}/GENESECT_BURN_FORM`;
  } else if (originalName.includes("Genesect (Douse)")) {
    url = `${base}/GENESECT_DOUSE_FORM`;
  } else if (originalName.includes("Thundurus (Therian)")) {
    url = `${base}/THUNDURUS_THERIAN_FORM`;
  } else if (originalName.includes("Tornadus (Therian)")) {
    url = `${base}/TORNADUS_THERIAN_FORM`;
  } else if (originalName.includes("Landorus (Therian)")) {
    url = `${base}/LANDORUS_THERIAN_FORM`;
  } else if (originalName.toLowerCase().includes("alolan")) {
    // Handle Alolan Pokemon generically
    // Example: "Alolan Raichu" -> "RAICHU_ALOLA_FORM"
    const pokemonName = normalizeAlolanName(originalName);
    
    // Format as POKEMON_NAME_ALOLA_FORM (uppercase, spaces to underscores)
    const formattedName = pokemonName.toUpperCase().replace(/\s/g, "_") + "_ALOLA_FORM";
    url = `${base}/${formattedName}`;
  }

  return url;
}
