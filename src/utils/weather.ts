import { weathers } from "../types";
import { latLngToS2CellId } from "./s2";

/**
 * In-game weather enum as SGPokeMap reports it (`weathers[].weather`
 * and `pokemon.weather`).
 */
export const GAME_WEATHER: Record<
  number,
  { name: string; emoji: string }
> = {
  1: { name: "sunny", emoji: "☀️" },
  2: { name: "rainy", emoji: "🌧" },
  3: { name: "partly cloudy", emoji: "⛅" },
  4: { name: "cloudy", emoji: "☁️" },
  5: { name: "windy", emoji: "🌬" },
  6: { name: "snow", emoji: "❄️" },
  7: { name: "fog", emoji: "🌫" },
};

// ScrapedDuck's boostedWeather names plus the spellings other sources use
const WEATHER_NAME_TO_ID: Record<string, number> = {
  sunny: 1,
  clear: 1,
  rainy: 2,
  rain: 2,
  "partly cloudy": 3,
  partlycloudy: 3,
  partly_cloudy: 3,
  cloudy: 4,
  overcast: 4,
  windy: 5,
  wind: 5,
  snow: 6,
  snowy: 6,
  fog: 7,
  foggy: 7,
};

/** Weather id for a name such as ScrapedDuck's "rainy"; unknown → undefined */
export function weatherIdFromName(name: string): number | undefined {
  return WEATHER_NAME_TO_ID[name.trim().toLowerCase()];
}

/** S2 level-10 cell id → weather id, from the raid feed's `weathers` */
export type WeatherCells = Map<string, number>;

export function buildWeatherCells(list: weathers): WeatherCells {
  return new Map(list.map((w) => [String(w.cell_id), w.weather]));
}

/**
 * Weather at a point. The cell is always computed from lat/lng: about a
 * quarter of raids arrive with `cell_id: null`, and the feed's own
 * `cell_id` is occasionally wrong (2 of ~1700 checked on 2026-09-20
 * pointed at a cell 15 km away). The feed id is only a fallback for the
 * unlikely case the computed cell is missing from `weathers`.
 */
export function weatherAt(
  cells: WeatherCells,
  lat: number,
  lng: number,
  cellId?: string | null,
): number | undefined {
  const computed = cells.get(latLngToS2CellId(lat, lng));
  if (computed !== undefined) return computed;
  return cellId ? cells.get(cellId) : undefined;
}
