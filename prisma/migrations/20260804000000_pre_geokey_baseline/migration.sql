-- CreateTable
CREATE TABLE "User" (
    "telegramId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "silentStartTime" DATETIME,
    "silentEndTime" DATETIME,
    "gymTimesNotified" INTEGER NOT NULL DEFAULT 0,
    "locationTimesNotified" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raidLevelNotify" TEXT NOT NULL,
    "stopNotifyingMeToday" DATETIME,
    "raidAlertMinutes" INTEGER NOT NULL DEFAULT 5
);

-- CreateTable
CREATE TABLE "Gym" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gymString" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "long" REAL NOT NULL,
    "lastRaidAt" DATETIME
);

-- CreateTable
CREATE TABLE "GymSubscribe" (
    "userTelegramId" INTEGER NOT NULL,
    "gymId" TEXT NOT NULL,

    PRIMARY KEY ("userTelegramId", "gymId"),
    CONSTRAINT "GymSubscribe_userTelegramId_fkey" FOREIGN KEY ("userTelegramId") REFERENCES "User" ("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GymSubscribe_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GymEvent" (
    "eventTime" DATETIME NOT NULL,
    "gymSubscribeUserTelegramId" INTEGER NOT NULL,
    "gymSubscribeGymId" TEXT NOT NULL,

    PRIMARY KEY ("eventTime", "gymSubscribeGymId", "gymSubscribeUserTelegramId"),
    CONSTRAINT "GymEvent_gymSubscribeUserTelegramId_gymSubscribeGymId_fkey" FOREIGN KEY ("gymSubscribeUserTelegramId", "gymSubscribeGymId") REFERENCES "GymSubscribe" ("userTelegramId", "gymId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationSubscribe" (
    "locationId" TEXT NOT NULL PRIMARY KEY,
    "userTelegramId" INTEGER NOT NULL,
    "lat" REAL NOT NULL,
    "long" REAL NOT NULL,
    "Radius" REAL NOT NULL,
    CONSTRAINT "LocationSubscribe_userTelegramId_fkey" FOREIGN KEY ("userTelegramId") REFERENCES "User" ("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocationEvent" (
    "locationSubscribeLocationId" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "long" REAL NOT NULL,
    "eventTime" DATETIME NOT NULL,

    PRIMARY KEY ("locationSubscribeLocationId", "eventTime"),
    CONSTRAINT "LocationEvent_locationSubscribeLocationId_fkey" FOREIGN KEY ("locationSubscribeLocationId") REFERENCES "LocationSubscribe" ("locationId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Gym_gymString_key" ON "Gym"("gymString");