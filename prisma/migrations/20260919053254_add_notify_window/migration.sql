-- CreateTable
CREATE TABLE "NotifyWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userTelegramId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "notifyKind" TEXT NOT NULL DEFAULT 'ALL',
    "gymId" TEXT,
    "weekdays" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotifyWindow_userTelegramId_fkey" FOREIGN KEY ("userTelegramId") REFERENCES "User" ("telegramId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotifyWindow_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
