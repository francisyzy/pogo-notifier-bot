/*
  Warnings:

  - You are about to drop the column `phone_number` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "phone_number",
DROP COLUMN "updatedAt",
ADD COLUMN     "gymTimesNotified" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "locationTimesNotified" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "silentEndTime" TIMESTAMP(3),
ADD COLUMN     "silentStartTime" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Gym" (
    "id" TEXT NOT NULL,
    "gymString" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "long" DOUBLE PRECISION NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymSubscribe" (
    "userTelegramId" INTEGER NOT NULL,
    "gymId" TEXT NOT NULL,

    PRIMARY KEY ("userTelegramId","gymId")
);

-- CreateTable
CREATE TABLE "GymEvent" (
    "eventTime" TIMESTAMP(3) NOT NULL,
    "gymSubscribeUserTelegramId" INTEGER NOT NULL,
    "gymSubscribeGymId" TEXT NOT NULL,

    PRIMARY KEY ("eventTime","gymSubscribeGymId","gymSubscribeUserTelegramId")
);

-- CreateTable
CREATE TABLE "LocationSubscribe" (
    "locationId" TEXT NOT NULL,
    "userTelegramId" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "long" DOUBLE PRECISION NOT NULL,
    "Radius" DOUBLE PRECISION NOT NULL,

    PRIMARY KEY ("locationId")
);

-- CreateTable
CREATE TABLE "LocationEvent" (
    "locationSubscribeLocationId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "long" DOUBLE PRECISION NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("locationSubscribeLocationId","eventTime")
);

-- AddForeignKey
ALTER TABLE "GymSubscribe" ADD FOREIGN KEY ("userTelegramId") REFERENCES "User"("telegramId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymSubscribe" ADD FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymEvent" ADD FOREIGN KEY ("gymSubscribeUserTelegramId", "gymSubscribeGymId") REFERENCES "GymSubscribe"("userTelegramId", "gymId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationSubscribe" ADD FOREIGN KEY ("userTelegramId") REFERENCES "User"("telegramId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationEvent" ADD FOREIGN KEY ("locationSubscribeLocationId") REFERENCES "LocationSubscribe"("locationId") ON DELETE CASCADE ON UPDATE CASCADE;
