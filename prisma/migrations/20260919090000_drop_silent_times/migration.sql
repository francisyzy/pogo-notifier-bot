-- Drop User.silentStartTime/silentEndTime: never read or written by the bot;
-- quiet hours live in NotifyWindow. SQLite drops columns by rebuilding the table.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "telegramId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gymTimesNotified" INTEGER NOT NULL DEFAULT 0,
    "locationTimesNotified" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raidLevelNotify" TEXT NOT NULL,
    "stopNotifyingMeToday" DATETIME,
    "raidAlertMinutes" INTEGER NOT NULL DEFAULT 5
);
INSERT INTO "new_User" ("createdAt", "gymTimesNotified", "lastActivity", "locationTimesNotified", "name", "raidAlertMinutes", "raidLevelNotify", "stopNotifyingMeToday", "telegramId") SELECT "createdAt", "gymTimesNotified", "lastActivity", "locationTimesNotified", "name", "raidAlertMinutes", "raidLevelNotify", "stopNotifyingMeToday", "telegramId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
