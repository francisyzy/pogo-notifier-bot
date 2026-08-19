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
-- Backfill geoKey from lat/lng rounded to 4 decimal places.
-- Handle duplicate-location gyms by appending #1, #2, etc. to subsequent occurrences.
INSERT INTO "new_Gym" ("gymString", "id", "lastRaidAt", "lat", "long", "geoKey")
SELECT
    "gymString",
    "id",
    "lastRaidAt",
    "lat",
    "long",
    -- First occurrence: bare geoKey. Subsequent: append #1, #2, ...
    CASE
        WHEN dup_count = 1 THEN CAST(ROUND("lat", 4) AS TEXT) || '|' || CAST(ROUND("long", 4) AS TEXT)
        ELSE CAST(ROUND("lat", 4) AS TEXT) || '|' || CAST(ROUND("long", 4) AS TEXT) || '#' || (row_num - 1)
    END
FROM (
    SELECT
        "gymString",
        "id",
        "lastRaidAt",
        "lat",
        "long",
        ROW_NUMBER() OVER (
            PARTITION BY CAST(ROUND("lat", 4) AS TEXT) || '|' || CAST(ROUND("long", 4) AS TEXT)
            ORDER BY "gymString"
        ) AS row_num,
        COUNT(*) OVER (
            PARTITION BY CAST(ROUND("lat", 4) AS TEXT) || '|' || CAST(ROUND("long", 4) AS TEXT)
        ) AS dup_count
    FROM "Gym"
);
DROP TABLE "Gym";
ALTER TABLE "new_Gym" RENAME TO "Gym";
CREATE UNIQUE INDEX "Gym_geoKey_key" ON "Gym"("geoKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
