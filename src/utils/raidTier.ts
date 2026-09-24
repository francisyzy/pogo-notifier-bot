import { RAID_CONFIG } from "../constants";

/**
 * Checks if a boss is a shadow Pokemon
 * @param boss Boss object with name and name properties
 * @returns true if the boss is a shadow Pokemon
 */
export function isShadowBoss(boss: {
  name: string;
}): boolean {
  return (
    boss.name.toLowerCase().includes("shadow")
  );
}

/**
 * Normalises a raid boss tier string to the upstream numeric tier.
 * ScrapedDuck uses "1-Star Raids" / "5-Star Raids" / "Mega Raids";
 * the backup source uses "1" / "5" / "mega".
 * @param boss Boss object with a tier string
 * @returns 1/3/5 for star tiers, RAID_CONFIG.MEGA_RAID_TIER for mega, 0 if unknown
 */
export function raidBossTier(boss: { tier: string }): number {
  if (/mega/i.test(boss.tier)) return RAID_CONFIG.MEGA_RAID_TIER;
  const tier = parseInt(boss.tier, 10);
  return Number.isNaN(tier) ? 0 : tier;
}
