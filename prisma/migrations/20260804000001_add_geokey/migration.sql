-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Gym" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "geoKey" TEXT,
    "gymString" TEXT,
    "lat" REAL NOT NULL,
    "long" REAL NOT NULL,
    "lastRaidAt" DATETIME
);
-- Backfill geoKey from lat/lng rounded to 4 decimal places during migration
INSERT INTO "new_Gym" ("gymString", "id", "lastRaidAt", "lat", "long", "geoKey")
SELECT
    "gymString",
    "id",
    "lastRaidAt",
    "lat",
    "long",
    CAST(ROUND("lat", 4) AS TEXT) || '|' || CAST(ROUND("long", 4) AS TEXT)
FROM "Gym";
DROP TABLE "Gym";
ALTER TABLE "new_Gym" RENAME TO "Gym";
CREATE UNIQUE INDEX "Gym_geoKey_key" ON "Gym"("geoKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;