/*
  Warnings:

  - A unique constraint covering the columns `[userId,weekStart]` on the table `Goal` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[goalId,day,version]` on the table `Plan` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_currentGoalId_fkey";

-- DropIndex
DROP INDEX "DailyInsight_userId_idx";

-- DropIndex
DROP INDEX "User_currentGoalId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Goal_userId_weekStart_key" ON "Goal"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_goalId_day_version_key" ON "Plan"("goalId", "day", "version");
