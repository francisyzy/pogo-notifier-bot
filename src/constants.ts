/**
 * Centralized magic strings - URLs, images, and links used across the app.
 * Update these when upstream sources change.
 */

/** Image assets */
export const IMAGES = {
  /** Tutorial showing how to send location in Telegram */
  LOCATION_TUTORIAL:
    "https://user-images.githubusercontent.com/24467184/147383291-61994fe2-ad11-4e0e-be8d-baf0cdec6b3d.png",
} as const;

/** API and data source URLs */
export const URLS = {
  /** Raid bosses from pmgo-professor-willow/data-leekduck (currently 404) */
  RAID_BOSSES_JSON:
    "https://raw.githubusercontent.com/pmgo-professor-willow/data-leekduck/gh-pages/raidBosses.min.json",

  /** Events from ScrapedDuck (LeekDuck data with start/end times) */
  EVENTS_JSON:
    "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json",

  /** PokeAPI for Pokemon names */
  POKEAPI_POKEMON: "https://pokeapi.co/api/v2/pokemon",

  /** LeekDuck boss list page */
  LEEKDUCK_BOSS: "https://www.leekduck.com/boss/",

  /** Pokebattler raids base URL */
  POKEBATTLER_RAIDS: "https://www.pokebattler.com/raids",

  /** SGPokeMap API */
  SGPOKEMAP: {
    RAIDS: "https://sgpokemap.com/raids.php",
    QUERY: "https://sgpokemap.com/query2.php",
    REFERER: "https://sgpokemap.com/index.html",
  },
} as const;

/** User-facing links for help text and channels */
export const LINKS = {
  /** Bug report / issues */
  ISSUES: "http://go.francisyzy.com/pogo-notifier-bot-issues",

  /** Events notification channel */
  EVENTS_CHANNEL: "https://t.me/SGPogoEvents",
} as const;
