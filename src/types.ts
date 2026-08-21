import { GymSubscribe } from "@prisma/client";

interface raid {
  gym_name: string;
  cell_id: string;
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
}

interface pokemonMessage extends pokemon {
  userTelegramId: number;
  locationId: string;
  despawnDate: Date;
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
interface RawEventExtraDataGeneric {
  name: string;
  canBeShiny: boolean;
  image: string;
  bonus?: string;
}

interface RawEventExtraDataSpotlight {
  name: string;
  canBeShiny: boolean;
  image: string;
  bonus?: string;
}

interface rawEvent {
  eventID: string;
  name: string;
  eventType: string;
  heading: string;
  link: string;
  image: string;
  start: string;
  end: string;
  extraData?: RawEventExtraDataGeneric | RawEventExtraDataSpotlight;
}

interface rawEvents extends Array<rawEvent> {}

export {
  raids,
  pokemons,
  weathers,
  raidMessage,
  pokemonMessage,
  raidBosses,
  rawEvents,
};
