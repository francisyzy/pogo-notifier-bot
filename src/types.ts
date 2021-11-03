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

export { raids, weathers, raidMessage };
