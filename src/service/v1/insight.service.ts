import { prisma } from '@/lib/prisma.js';
import { generateDailyInsights } from './ai.service.js';
import { updateTrainingState } from './strava.service.js';

const getDayName = (date: Date) => {
  return date.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue
};

export const getDailyInsights = async (userId: string, date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  // 0. Check existing insight
  const existingInsight = await prisma.dailyInsight.findFirst({
    where: {
      userId,
      date: {
        gte: start,
        lte: end,
      },
    },
  });

  if (existingInsight) {
    return existingInsight;
  }

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

  if (activities.length === 0) {
    throw new Error('No activities found for this date');
  }

  const totalActualLoad = activities.reduce(
    (sum, a) => sum + (a.trainingLoad || 0),
    0,
  );

  // 2. Fetch goal
  const goal = await prisma.goal.findFirst({
    where: {
      userId,
      weekStart: { lte: end },
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

  const plan = goal.plan
    .filter((p) => p.day === dayName)
    .sort((a, b) => b.version - a.version)[0];

  const plannedLoad = plan?.load || 0;

  // 4. Deviation logic
  const deviation = totalActualLoad - plannedLoad;

  let status: 'overtrained' | 'undertrained' | 'on_track';

  if (plannedLoad === 0) {
    // rest day logic
    status = totalActualLoad > 0 ? 'overtrained' : 'on_track';
  } else {
    const threshold = plannedLoad * 0.2;

    status =
      deviation > threshold
        ? 'overtrained'
        : deviation < -threshold
          ? 'undertrained'
          : 'on_track';
  }

  const { atl, ctl, tsb } = await updateTrainingState(userId, start);

  // 5. AI insights
  const ai = await generateDailyInsights(
    {
      plannedLoad,
      totalActualLoad,
      deviation,
      status,
      atl,
      ctl,
      tsb,
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
