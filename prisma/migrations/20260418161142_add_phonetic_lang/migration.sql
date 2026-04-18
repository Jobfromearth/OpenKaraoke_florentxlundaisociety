/*
  Warnings:

  - Added the required column `phoneticLang` to the `Lyrics` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lyrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "songId" TEXT NOT NULL,
    "phoneticLang" TEXT NOT NULL,
    "lines" TEXT NOT NULL,
    CONSTRAINT "Lyrics_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Lyrics" ("id", "lines", "songId") SELECT "id", "lines", "songId" FROM "Lyrics";
DROP TABLE "Lyrics";
ALTER TABLE "new_Lyrics" RENAME TO "Lyrics";
CREATE UNIQUE INDEX "Lyrics_songId_phoneticLang_key" ON "Lyrics"("songId", "phoneticLang");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
