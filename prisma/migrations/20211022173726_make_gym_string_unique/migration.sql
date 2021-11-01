/*
  Warnings:

  - A unique constraint covering the columns `[gymString]` on the table `Gym` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Gym.gymString_unique" ON "Gym"("gymString");
