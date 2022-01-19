import { PrismaClient, Gym } from ".prisma/client";
import { InlineKeyboardButton } from "typegram";
import { Markup } from "telegraf";

const prisma = new PrismaClient();

export async function gymSearcherBtn(
  latitude: number,
  longitude: number,
): Promise<
  (InlineKeyboardButton & {
    hide?: boolean | undefined;
  })[]
> {
  const gyms = await gymSearcher(latitude, longitude);
  let gymBtnList: (InlineKeyboardButton & {
    hide?: boolean | undefined;
  })[] = [];
  gyms.forEach((gym) => {
    gymBtnList.push(Markup.button.callback(gym.gymString, gym.id));
  });
  return gymBtnList;
}

export async function gymSearcher(
  latitude: number,
  longitude: number,
): Promise<Gym[]> {
  const range = 0.003;

  const gyms = await prisma.gym.findMany({
    where: {
      lat: {
        gte: latitude - range,
        lte: latitude + range,
      },
      long: {
        gte: longitude - range,
        lte: longitude + range,
      },
    },
  });
  return gyms;
}
