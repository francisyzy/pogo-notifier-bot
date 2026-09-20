import { parse } from "node-html-parser";
import { URLS } from "../constants";
import type { CpRange } from "../types";
import type { RaidBossCache } from "./cache";

/**
 * Last-resort raid boss source: LeekDuck's own page. Both JSON sources
 * live on raw.githubusercontent.com, so a GitHub outage takes them out
 * together; this parses the same page ScrapedDuck scrapes.
 *
 * Markup (as of 2026-09): `.raid-bosses` (regular) and
 * `.shadow-raid-bosses` containers, each with `.tier` blocks carrying a
 * `.tier-label` ("1-Star Raids", "Mega Raids") and `.card`s holding
 * `.name`, an optional `.shiny-icon`, `.boss-type .type-label`s,
 * `.cp-range`, `.boosted-cp` and `.weather-boosted .label`s. Shadow
 * bosses are already named "Shadow …" like ScrapedDuck's feed.
 */
export function parseLeekDuckRaidBosses(html: string): RaidBossCache[] {
  const root = parse(html);
  const bosses: RaidBossCache[] = [];
  for (const tier of root.querySelectorAll(
    ".raid-bosses .tier, .shadow-raid-bosses .tier",
  )) {
    const tierLabel = tier.querySelector(".tier-label")?.text.trim();
    if (!tierLabel) continue;
    for (const card of tier.querySelectorAll(".card")) {
      const name = card.querySelector(".name")?.text.trim();
      if (!name) continue;
      const normal = parseCpRange(card.querySelector(".cp-range")?.text);
      const boosted = parseCpRange(card.querySelector(".boosted-cp")?.text);
      bosses.push({
        name,
        tier: tierLabel,
        canBeShiny: card.querySelector(".shiny-icon") !== null,
        types: card
          .querySelectorAll(".boss-type .type-label")
          .map((t) => ({ name: t.text.trim().toLowerCase(), image: "" })),
        // Only claim CP figures when both ranges parsed; a half-parsed
        // card must not show a bogus range
        ...(normal && boosted && { combatPower: { normal, boosted } }),
        boostedWeather: card
          .querySelectorAll(".weather-boosted .label")
          .map((w) => ({ name: w.text.trim().toLowerCase(), image: "" })),
        image: card.querySelector(".boss-img img")?.getAttribute("src") ?? "",
      });
    }
  }
  return bosses;
}

/** "CP 493 - 536" → { min: 493, max: 536 } */
function parseCpRange(text: string | undefined): CpRange | undefined {
  const match = text?.match(/(\d+)\s*-\s*(\d+)/);
  return match
    ? { min: Number(match[1]), max: Number(match[2]) }
    : undefined;
}

export async function scrapeLeekDuckRaidBosses(): Promise<RaidBossCache[]> {
  const response = await fetch(URLS.LEEKDUCK_BOSS, {
    headers: { "User-Agent": "pogo-notifier-bot/1.0", Accept: "text/html" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${URLS.LEEKDUCK_BOSS}`);
  }
  const bosses = parseLeekDuckRaidBosses(await response.text());
  if (bosses.length === 0) {
    throw new Error("LeekDuck page parsed to zero bosses (markup changed?)");
  }
  return bosses;
}
