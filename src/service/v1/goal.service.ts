import { prisma } from '@/lib/prisma.js';

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.setDate(diff));
};

export const createWeeklyGoal = async (
  userId: string,
  input: {
    currentLoad: number;
    targetLoad: number;
    fatigue: number;
    adjustedLoad: number;
    plan: Plan[];
    adjustedPlan: boolean;
    startDate?: Date;
  },
) => {
  const {
    currentLoad,
    targetLoad,
    fatigue,
    adjustedLoad,
    plan,
    adjustedPlan,
    startDate,
  } = input;

  const weekStart = getWeekStart(startDate || new Date());

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return await prisma.$transaction(async (tx) => {
    // 1. create goal (unique constraint handles duplicates)
    const goal = await tx.goal.create({
      data: {
        userId,
        currentLoad,
        targetLoad,
        adjustedLoad,
        fatigue,
        weekStart,
        weekEnd,
      },
    });

    // 2. create plan (use create instead of createMany for better control)
    const plans = await tx.plan.createMany({
      data: plan.map((p) => ({
        goalId: goal.id,
        day: p.day,
        type: p.type,
        load: p.load,
        version: adjustedPlan ? 2 : 1,
        isAdjusted: adjustedPlan,
      })),
    });

    // 3. update current goal pointer
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        currentGoalId: goal.id,
      },
    });

    return { goal, plans, updatedUser };
  });
};
