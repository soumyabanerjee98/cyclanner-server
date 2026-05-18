/*
  Warnings:

  - Added the required column `trainingLoadAccuracy` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trainingLoadSource` to the `Activity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "trainingLoadAccuracy" TEXT NOT NULL,
ADD COLUMN     "trainingLoadSource" TEXT NOT NULL;
