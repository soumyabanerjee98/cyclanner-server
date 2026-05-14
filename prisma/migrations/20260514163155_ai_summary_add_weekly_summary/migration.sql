-- AlterTable
ALTER TABLE "WeeklySummary" ADD COLUMN     "aiCurrentState" TEXT,
ADD COLUMN     "aiIssues" JSONB,
ADD COLUMN     "aiPositives" JSONB,
ADD COLUMN     "aiRecommendations" JSONB,
ADD COLUMN     "aiSummary" TEXT;
