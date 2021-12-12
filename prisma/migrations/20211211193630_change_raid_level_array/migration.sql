/*
  Warnings:

  - You are about to drop the column `lowestRaidLevel` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "lowestRaidLevel",
ADD COLUMN     "raidLevelNotify" INTEGER[];
