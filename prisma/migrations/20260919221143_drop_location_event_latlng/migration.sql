-- Drop LocationEvent.lat/long: perfectNotifier wrote the spawn coordinates
-- into every row but nothing ever read them (dedup only uses the PK).
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LocationEvent" (
    "locationSubscribeLocationId" TEXT NOT NULL,
    "eventTime" DATETIME NOT NULL,

    PRIMARY KEY ("locationSubscribeLocationId", "eventTime"),
    CONSTRAINT "LocationEvent_locationSubscribeLocationId_fkey" FOREIGN KEY ("locationSubscribeLocationId") REFERENCES "LocationSubscribe" ("locationId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LocationEvent" ("eventTime", "locationSubscribeLocationId") SELECT "eventTime", "locationSubscribeLocationId" FROM "LocationEvent";
DROP TABLE "LocationEvent";
ALTER TABLE "new_LocationEvent" RENAME TO "LocationEvent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

