import { prisma } from '@/lib/prisma.js';
import { updateTrainingState } from './strava.service.js';
import { generateSummaryAIInsight } from './ai.service.js';
import AppError from '@/handler/error.handler.js';
import { goalSummaryQueue } from '@/queues/goalSummary.queue.js';

export const getGoalSummary = async (userId: string, date: Date) => {
  const queryDate = new Date(date);
  queryDate.setHours(0, 0, 0, 0);

  // 1. Find goal covering this date
  const now = new Date();

  const goal = await prisma.goal.findFirst({
    where: {
      userId,
      endDate: {
        lt: now, // only consider completed weeks
      },
    },
    orderBy: {
      endDate: 'desc', // latest completed week
    },
    include: {
      plan: true,
      goalSummary: true,
    },
  });

  if (!goal) {
    throw new AppError('No completed weekly goal found', 404);
  }

  // 2. RETURN EXISTING SUMMARY
  if (goal.goalSummary) {
    return goal.goalSummary;
  }

  // 3. Planned Load
  const plannedLoad = goal.plan.reduce((sum, p) => sum + p.targetLoad, 0);

  // 4. Actual Load
  const actualLoad = goal.plan.reduce((sum, a) => sum + (a.actualLoad || 0), 0);

  // 5. Balance
  const balance = actualLoad - plannedLoad;

  // 6. Adherence
  const adherenceScore =
    plannedLoad === 0 ? 0 : (actualLoad / plannedLoad) * 100;

  const safeAdherence = Math.min(120, Math.max(0, adherenceScore));

  // 7. Trend
  let trend: 'improving' | 'overreaching' | 'stable';

  if (safeAdherence > 110) trend = 'overreaching';
  else if (safeAdherence < 85) trend = 'improving';
  else trend = 'stable';

  // 8. Fatigue Risk (based on end of week)
  const { tsb } = await updateTrainingState(userId, goal.endDate);

  let fatigueRisk: 'low' | 'medium' | 'high';

  if (tsb < -20) fatigueRisk = 'high';
  else if (tsb < -10) fatigueRisk = 'medium';
  else fatigueRisk = 'low';

  // 9. Store summary
  const summary = await prisma.goalSummary.upsert({
    where: {
      goalId: goal.id,
    },
    update: {
      plannedLoad,
      actualLoad,
      balance,
      adherenceScore: safeAdherence,
      trend,
      fatigueRisk,
    },
    create: {
      goalId: goal.id,
      plannedLoad,
      actualLoad,
      balance,
      adherenceScore: safeAdherence,
      trend,
      fatigueRisk,
    },
  });

  await goalSummaryQueue.add(
    'generate-ai-summary',
    { summaryId: summary.id },
    { jobId: `generate-ai-summary-${summary.id}` },
  );

  return summary;
};

export const getAISummary = async (summaryId: string) => {
  // 1. Fetch summary
  const summary = await prisma.goalSummary.findUnique({
    where: { id: summaryId },
  });

  if (!summary) {
    throw new AppError('Weekly summary not found', 404);
  }

  // 2. RETURN IF AI ALREADY EXISTS
  if (summary.aiSummary) {
    return summary;
  }

  // 3. Generate AI
  const ai = await generateSummaryAIInsight({
    plannedLoad: summary.plannedLoad,
    actualLoad: summary.actualLoad,
    balance: summary.balance,
    adherenceScore: summary.adherenceScore,
    trend: summary.trend,
    fatigueRisk: summary.fatigueRisk,
  });

  if (ai.type !== 'json') {
    throw new AppError('AI failed to generate weekly summary');
  }

  const data = ai.value as {
    summary: string;
    positives: string[];
    issues: string[];
    currentState: string;
    recommendations: string[];
  };

  // 4. Store AI result
  const updated = await prisma.goalSummary.update({
    where: { id: summaryId },
    data: {
      aiSummary: data.summary,
      aiPositives: data.positives,
      aiIssues: data.issues,
      aiCurrentState: data.currentState,
      aiRecommendations: data.recommendations,
    },
  });

  return updated;
};
