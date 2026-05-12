/*
  Warnings:

  - A unique constraint covering the columns `[athleteId]` on the table `StravaToken` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,isActive]` on the table `StravaToken` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "StravaToken" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "StravaToken_athleteId_key" ON "StravaToken"("athleteId");

-- CreateIndex
CREATE INDEX "StravaToken_userId_idx" ON "StravaToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StravaToken_userId_isActive_key" ON "StravaToken"("userId", "isActive");
