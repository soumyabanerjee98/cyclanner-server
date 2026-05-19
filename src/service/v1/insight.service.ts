import { prisma } from '@/lib/prisma.js';
import { generateDailyInsights } from './ai.service.js';
import { updateTrainingState } from './strava.service.js';
import AppError from '@/handler/error.handler.js';

export const getDailyInsights = async (
  userId: string,
  date: Date,
  regenerate: boolean = false,
) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  // 0. Check existing insight
  if (!regenerate) {
    const existingInsight = await prisma.dailyInsight.findFirst({
      where: {
        userId,
        date: start,
      },
    });

    if (existingInsight) {
      return existingInsight;
    }
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
    throw new AppError('No activities found for this date', 404);
  }

  const totalActualLoad = activities.reduce(
    (sum, a) => sum + (a.trainingLoad || 0),
    0,
  );

  // 2. Fetch goal
  const goal = await prisma.goal.findFirst({
    where: {
      userId,
      startDate: {
        lte: end,
      },
      endDate: {
        gte: start,
      },
      isActive: true,
    },
    include: {
      plan: {
        where: {
          date: {
            gte: start,
            lte: end,
          },
        },
      },
    },
  });

  if (!goal) {
    throw new AppError('No active goal found', 404);
  }

  // 3. Get correct plan for day

  const plan =
    goal.plan.find((p) => {
      const d = new Date(p.date);
      return d >= start && d <= end;
    }) || null;

  const plannedLoad = plan?.targetLoad ?? 0;

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
