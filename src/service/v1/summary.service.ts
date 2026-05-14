import { prisma } from '@/lib/prisma.js';
import { updateTrainingState } from './strava.service.js';
import { generateWeeklyAIInsight } from './ai.service.js';

export const getWeeklySummary = async (userId: string, date: Date) => {
  const queryDate = new Date(date);
  queryDate.setHours(0, 0, 0, 0);

  // 1. Find goal covering this date
  const now = new Date();

  const goal = await prisma.goal.findFirst({
    where: {
      userId,
      weekEnd: {
        lt: now, // only consider completed weeks
      },
    },
    orderBy: {
      weekEnd: 'desc', // latest completed week
    },
    include: {
      plan: true,
      weeklySummary: true,
    },
  });

  if (!goal) {
    throw new Error('No completed weekly goal found');
  }

  // 2. RETURN EXISTING SUMMARY
  if (goal.weeklySummary) {
    return goal.weeklySummary;
  }

  // 3. Planned Load
  const plannedLoad = goal.plan.reduce((sum, p) => sum + p.load, 0);

  // 4. Actual Load
  const activities = await prisma.activity.findMany({
    where: {
      userId,
      startDate: {
        gte: goal.weekStart,
        lte: goal.weekEnd,
      },
    },
  });

  const actualLoad = activities.reduce(
    (sum, a) => sum + (a.trainingLoad || 0),
    0,
  );

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
  const { tsb } = await updateTrainingState(userId, goal.weekEnd);

  let fatigueRisk: 'low' | 'medium' | 'high';

  if (tsb < -20) fatigueRisk = 'high';
  else if (tsb < -10) fatigueRisk = 'medium';
  else fatigueRisk = 'low';

  // 9. Store summary
  const summary = await prisma.weeklySummary.upsert({
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

  return summary;
};

export const getWeeklyAISummary = async (weeklySummaryId: string) => {
  // 1. Fetch summary
  const summary = await prisma.weeklySummary.findUnique({
    where: { id: weeklySummaryId },
  });

  if (!summary) {
    throw new Error('Weekly summary not found');
  }

  // 2. RETURN IF AI ALREADY EXISTS
  if (summary.aiSummary) {
    return summary;
  }

  // 3. Generate AI
  const ai = await generateWeeklyAIInsight({
    plannedLoad: summary.plannedLoad,
    actualLoad: summary.actualLoad,
    balance: summary.balance,
    adherenceScore: summary.adherenceScore,
    trend: summary.trend,
    fatigueRisk: summary.fatigueRisk,
  });

  if (ai.type !== 'json') {
    throw new Error('AI failed to generate weekly summary');
  }

  const data = ai.value as {
    summary: string;
    positives: string[];
    issues: string[];
    currentState: string;
    recommendations: string[];
  };

  // 4. Store AI result
  const updated = await prisma.weeklySummary.update({
    where: { id: weeklySummaryId },
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
