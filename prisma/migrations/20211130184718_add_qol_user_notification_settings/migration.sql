-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lowestRaidLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stopNotifyingMeToday" BOOLEAN NOT NULL DEFAULT false;
