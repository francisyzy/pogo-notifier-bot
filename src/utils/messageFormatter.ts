import { Prisma, PrismaClient } from ".prisma/client";
import { isToday, subDays } from "date-fns";
import bot from "../lib/bot";
import { getRaids } from "./getMaper";
import { gymChecker } from "./gymChecker";
import { sleep } from "./sleep";
import got from "got";
import { raidBosses, raidMessage } from "../types";
import { el } from "date-fns/locale";

const prisma = new PrismaClient();

/**
 * Check raids and notifies the user if there are raids
 */
export async function raidMessageFormatter(
  raidMessage: raidMessage,
): Promise<string> {
  const raidBosses = (await got(
    "https://raw.githubusercontent.com/pmgo-professor-willow/data-leekduck/gh-pages/raid-bosses.min.json",
  ).json()) as raidBosses;

  let possibleBosses = `\n\n<a href="https://www.leekduck.com/boss/">Possible raid boss</a>: (`;
  let bossName = "";

  raidBosses.forEach((raidBoss) => {
    //change mega formatting
    let customMegaFormat = "";
    if (raidBoss.tier === "mega") {
      raidBoss.tier = "6";
      customMegaFormat = raidBoss.originalName.slice(5) + "_MEGA";
    }
    //TODO check if future forms are still correct
    //If the egg has popped, use leek duck info at the start
    if (raidMessage.pokemonId === raidBoss.no) {
      bossName = `<a href="https://www.pokebattler.com/raids/${
        customMegaFormat || raidBoss.originalName.replace(/\s/g, "_")
      }">${raidBoss.originalName}</a>`;
      bossName += raidBoss.shinyAvailable ? "✨" : "";
    } else if (Number(raidBoss.tier) === raidMessage.level) {
      possibleBosses += `<a href="https://www.pokebattler.com/raids/${
        raidMessage.level === 6
          ? customMegaFormat
          : raidBoss.originalName.replace(/\s/g, "_")
      }">${raidBoss.originalName}</a>`;
      possibleBosses += raidBoss.shinyAvailable ? "✨, " : ", ";
    }
  });
  possibleBosses = possibleBosses.slice(0, -2);
  possibleBosses += ")";

  if (bossName === "" && raidMessage.level === 0) {
    const { name: name } = await got(
      `https://pokeapi.co/api/v2/pokemon/${raidMessage.pokemonId}`,
    ).json();
    bossName = toTitleCase(name);
  }

  const message = `Level ${raidMessage.level} Raid at <u>${
    raidMessage.name
  }</u> ${raidMessage.pokemonId === 0 ? "starting" : "started"} at ${
    raidMessage.start
  }${
    raidMessage.pokemonId === 0
      ? possibleBosses
      : ` with boss ${bossName}`
  }`;
  return message;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}