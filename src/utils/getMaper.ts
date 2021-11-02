import { raids } from "../types";
import got from "got";

/**
 * Get list of raids happening
 * @return {raids} List of raids
 */
export async function getRaids(): Promise<raids> {
  const { raids: raids } = await got(
    `https://sgpokemap.com/raids.php?time=${new Date().valueOf()}`,
  ).json();

  return raids as raids;
}
