import { GymSubscribe } from ".prisma/client";

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
  pokemonId: number;
}

interface pokemonMessage extends pokemon {
  userTelegramId: number;
  locationId: string;
  despawnDate: Date;
}

interface raidBoss {
  tier: string;
  no: number;
  name: string;
  originalName: string;
  imageUrl: string;
  shinyAvailable: boolean;
  types: string[];
  typeUrls: string[];
  cp: { min: number; max: number };
  boostedCp: { min: number; max: number };
  boostedWeathers: string[];
  boostedWeatherUrls: string[];
}

interface raidBosses extends Array<raidBoss> {}

export {
  raids,
  pokemons,
  weathers,
  raidMessage,
  pokemonMessage,
  raidBosses,
};
