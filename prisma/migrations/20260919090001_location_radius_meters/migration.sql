-- LocationSubscribe.Radius (written as 0.05 but never read) becomes radiusMeters.
-- Existing rows get the default 100 m, which matches the ~111 m box
-- (config.perfectRange 0.001 deg) that was actually applied before.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LocationSubscribe" (
    "locationId" TEXT NOT NULL PRIMARY KEY,
    "userTelegramId" INTEGER NOT NULL,
    "lat" REAL NOT NULL,
    "long" REAL NOT NULL,
    "radiusMeters" REAL NOT NULL DEFAULT 100,
    CONSTRAINT "LocationSubscribe_userTelegramId_fkey" FOREIGN KEY ("userTelegramId") REFERENCES "User" ("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LocationSubscribe" ("lat", "locationId", "long", "userTelegramId") SELECT "lat", "locationId", "long", "userTelegramId" FROM "LocationSubscribe";
DROP TABLE "LocationSubscribe";
ALTER TABLE "new_LocationSubscribe" RENAME TO "LocationSubscribe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
