-- DropForeignKey
ALTER TABLE "GymSubscribe" DROP CONSTRAINT "GymSubscribe_gymId_fkey";

-- DropForeignKey
ALTER TABLE "GymSubscribe" DROP CONSTRAINT "GymSubscribe_userTelegramId_fkey";

-- DropForeignKey
ALTER TABLE "LocationSubscribe" DROP CONSTRAINT "LocationSubscribe_userTelegramId_fkey";

-- AddForeignKey
ALTER TABLE "GymSubscribe" ADD CONSTRAINT "GymSubscribe_userTelegramId_fkey" FOREIGN KEY ("userTelegramId") REFERENCES "User"("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymSubscribe" ADD CONSTRAINT "GymSubscribe_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationSubscribe" ADD CONSTRAINT "LocationSubscribe_userTelegramId_fkey" FOREIGN KEY ("userTelegramId") REFERENCES "User"("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Gym.gymString_unique" RENAME TO "Gym_gymString_key";
