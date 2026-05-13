import { prisma } from '@/lib/prisma.js';
import { generateDailyInsights } from './ai.service.js';

const getDayName = (date: Date) => {
  return date.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue
};

export const getDailyInsights = async (userId: string, date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  // 1. Fetch activities
  const activities = await prisma.activity.findMany({
    where: {
      userId,
      startDate: {
        gte: start,
        lte: end,
      },
    },
  });

  const totalActualLoad = activities.reduce(
    (sum, a) => sum + (a.trainingLoad || 0),
    0,
  );

  // 2. Fetch goal
  const goal = await prisma.goal.findFirst({
    where: {
      userId,
      weekStart: { lte: start },
      weekEnd: { gte: start },
    },
    include: {
      plan: {
        orderBy: { version: 'desc' },
      },
    },
  });

  if (!goal) {
    throw new Error('No goal found for this date');
  }

  // 3. Get correct plan for day
  const dayName = getDayName(start);

  const plan = goal.plan.find((p) => p.day === dayName);

  const plannedLoad = plan?.load || 0;

  // 4. Deviation logic
  const deviation = totalActualLoad - plannedLoad;

  const threshold = plannedLoad * 0.2;

  const status =
    deviation > threshold
      ? 'overtrained'
      : deviation < -threshold
        ? 'undertrained'
        : 'on_track';

  // 5. AI insights
  const ai = await generateDailyInsights(
    {
      plannedLoad,
      totalActualLoad,
      deviation,
      status,
    },
    3,
  );

  if (ai.type !== 'json') {
    throw new Error('AI failed to return valid insights');
  }

  const insightData = ai.value as {
    fatigueScore: number;
    strainScore: number;
    commentary: string;
  };

  // 6. Upsert insight
  const dailyInsight = await prisma.dailyInsight.upsert({
    where: {
      userId_date: {
        userId,
        date: start,
      },
    },
    update: {
      plannedLoad,
      actualLoad: totalActualLoad,
      deviation,
      status,
      fatigueScore: insightData.fatigueScore,
      strainScore: insightData.strainScore,
      commentary: insightData.commentary,
    },
    create: {
      userId,
      goalId: goal.id,
      date: start,
      plannedLoad,
      actualLoad: totalActualLoad,
      deviation,
      status,
      fatigueScore: insightData.fatigueScore,
      strainScore: insightData.strainScore,
      commentary: insightData.commentary,
    },
  });

  return dailyInsight;
};
