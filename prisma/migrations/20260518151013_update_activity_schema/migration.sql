/*
  Warnings:

  - You are about to drop the column `type` on the `Activity` table. All the data in the column will be lost.
  - Added the required column `avgSpeed` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `avgWatts` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `calories` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kilojoules` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxSpeed` to the `Activity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "type",
ADD COLUMN     "avgSpeed" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "avgWatts" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "calories" INTEGER NOT NULL,
ADD COLUMN     "kilojoules" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "maxSpeed" DOUBLE PRECISION NOT NULL;
