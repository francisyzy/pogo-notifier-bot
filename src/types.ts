import { GymSubscribe } from "@prisma/client";

interface raid {
  gym_name: string;
  /** S2 level-10 cell id (decimal string); null for some raids */
  cell_id: string | null;
  ex_raid_eligible: number;
  sponsor: number;
  lat: number;
  lng: number;
  raid_spawn: number;
  raid_start: number;
  raid_end: number;
  pokemon_id: number;
  level: number;
  cp: number;
  team: number;
  move1: number;
  move2: number;
  is_exclusive: number;
  form: number;
  gender: number;
}

interface raids extends Array<raid> {}

interface pokemon {
  pokemon_id: number;
  lat: number;
  lng: number;
  despawn: number;
  disguise: number;
  attack: number;
  defence: number;
  stamina: number;
  move1: number;
  move2: number;
  costume: number;
  gender: number;
  shiny: number;
  form: number;
  cp: number;
  level: number;
  weather: number;
}

interface pokemons extends Array<pokemon> {}

interface weather {
  cell_id: string;
  weather: number;
}

interface weathers extends Array<weather> {}

interface raidMessage extends GymSubscribe {
  name: string;
  level: number;
  start: Date;
  end: Date;
  pokemonId: number;
  lat: number;
  long: number;
  /** Feed's S2 weather cell for the gym; null when the feed omits it */
  cellId: string | null;
  /** In-game weather at the gym (GAME_WEATHER id); absent if unknown */
  weatherId?: number;
}

interface pokemonMessage extends pokemon {
  userTelegramId: number;
  locationId: string;
  despawnDate: Date;
  /** Distance from the user's saved pin; absent for ad-hoc checks */
  distanceMeters?: number;
}

// ScrapedDuck format: https://github.com/bigfoott/ScrapedDuck
interface raidBoss {
  name: string;
  tier: string;
  canBeShiny: boolean;
  types: TypeInfo[];
  combatPower: CombatPower;
  boostedWeather: WeatherInfo[];
  image: string;
}

interface TypeInfo {
  name: string;
  image: string;
}

interface WeatherInfo {
  name: string;
  image: string;
}

interface CombatPower {
  normal: CpRange;
  boosted: CpRange;
}

interface CpRange {
  min: number;
  max: number;
}

interface raidBosses extends Array<raidBoss> {}

// ScrapedDuck format: https://github.com/bigfoott/ScrapedDuck
interface RawEventSpotlightPokemon {
  name: string;
  canBeShiny: boolean;
  image: string;
}

interface RawEventExtraDataSpotlight extends RawEventSpotlightPokemon {
  bonus: string;
  list: RawEventSpotlightPokemon[];
}

interface RawEventExtraDataGeneric {
  hasSpawns: boolean;
  hasFieldResearchTasks: boolean;
}

interface RawEventExtraDataCommunityDay {
  spawns: { name: string; image: string }[];
  bonuses: { text: string; image: string }[];
}

interface RawEventExtraData {
  generic?: RawEventExtraDataGeneric;
  spotlight?: RawEventExtraDataSpotlight;
  communityday?: RawEventExtraDataCommunityDay;
  raidbattles?: Record<string, unknown>;
  promocodes?: string[];
}

interface rawEvent {
  eventID: string;
  name: string;
  eventType: string;
  heading: string;
  link: string;
  image: string;
  start: string | null;
  end: string | null;
  extraData?: RawEventExtraData;
}

interface rawEvents extends Array<rawEvent> {}

export {
  raids,
  pokemons,
  weathers,
  raidMessage,
  pokemonMessage,
  raidBosses,
  TypeInfo,
  WeatherInfo,
  CombatPower,
  CpRange,
  rawEvent,
  rawEvents,
};
