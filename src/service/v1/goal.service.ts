import AppError from '@/handler/error.handler.js';
import { prisma } from '@/lib/prisma.js';

export const createGoal = async (
  userId: string,
  input: {
    currentLoad: number;
    targetLoad: number;
    adjustedLoad: number;

    fatigue: number;
    fitness: number;
    readiness: number;

    startDate: Date;
    endDate: Date;

    plan: Plan[];

    experienceLevel: 'beginner' | 'intermediate' | 'advanced';

    customGoalRequest?: string;
  },
) => {
  const {
    currentLoad,
    targetLoad,
    adjustedLoad,

    fatigue,
    fitness,
    readiness,

    plan,

    startDate,
    endDate,

    experienceLevel,
    customGoalRequest,
  } = input;

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setDate(end.getDate() + 1);

  return await prisma.$transaction(async (tx) => {
    // =========================
    // 1. DEACTIVATE OLD GOALS
    // =========================

    await tx.goal.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // =========================
    // 2. CREATE GOAL
    // =========================

    const goal = await tx.goal.create({
      data: {
        userId,

        startDate: start,
        endDate: end,

        experienceLevel,
        customGoalRequest: customGoalRequest ?? null,

        currentLoad,
        targetLoad,
        adjustedLoad,

        fatigue,
        fitness,
        readiness,

        status: 'on_track',

        isActive: true,
      },
    });

    // =========================
    // 3. CREATE PLAN SESSIONS
    // =========================

    await tx.plan.createMany({
      data: plan.map((p) => ({
        goalId: goal.id,

        date: new Date(p.date),

        type: p.type,

        title: p.title,
        description: p.description,

        instructions: p.instructions,

        targetLoad: p.targetLoad,

        targetDistance: p.targetDistance,
        targetDuration: p.targetDuration,

        completed: false,
      })),
    });

    // =========================
    // 4. UPDATE USER POINTER
    // =========================

    const updatedUser = await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        currentGoalId: goal.id,
      },
    });

    // =========================
    // 5. FETCH CREATED PLANS
    // =========================

    const plans = await tx.plan.findMany({
      where: {
        goalId: goal.id,
      },
      orderBy: {
        date: 'asc',
      },
    });

    return {
      goal,
      plans,
      updatedUser,
    };
  });
};

export const getCurrentGoal = async (userId: string) => {
  const now = new Date();

  // =========================
  // NORMALIZE TODAY RANGE
  // =========================

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  // =========================
  // FIND ACTIVE GOAL
  // =========================

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
        orderBy: {
          date: 'asc',
        },
      },

      goalSummary: true,
    },
  });

  if (!goal) {
    throw new AppError('No active goal found', 404);
  }

  return goal;
};

export const evaluateGoalCompletion = async (goalId: string) => {
  const goal = await prisma.goal.findUnique({
    where: {
      id: goalId,
    },

    include: {
      plan: true,
    },
  });

  if (!goal) {
    throw new AppError('Goal not found', 404);
  }

  // =========================
  // ONLY EVALUATE AFTER END DATE
  // =========================

  const now = new Date();

  if (now < goal.endDate) {
    return {
      completed: false,
      reason: 'Goal period still active',
    };
  }

  // =========================
  // CALCULATE LOADS
  // =========================

  const plannedLoad = goal.plan.reduce((sum, p) => sum + p.targetLoad, 0);

  const actualLoad = goal.plan.reduce((sum, p) => sum + (p.actualLoad || 0), 0);

  const adherence = plannedLoad > 0 ? actualLoad / plannedLoad : 0;

  // =========================
  // DETERMINE COMPLETION
  // =========================

  const isCompleted = adherence >= 0.8;

  // =========================
  // UPDATE GOAL
  // =========================

  await prisma.goal.update({
    where: {
      id: goal.id,
    },

    data: {
      isCompleted,
      isActive: false,
    },
  });

  return {
    plannedLoad,
    actualLoad,
    adherence,

    completed: isCompleted,
  };
};
