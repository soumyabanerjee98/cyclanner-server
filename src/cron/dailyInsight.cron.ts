import { prisma } from '@/lib/prisma.js';
import { dailyInsightQueue } from '@/queues/dailyInsight.queue.js';
import cron from 'node-cron';

export const startDailyInsightCron = () => {
  console.log('Daily insight cron started');
  /**
   * Runs every day at 11:55 PM
   */

  cron.schedule('55 23 * * *', async () => {
    console.log('Running daily insight cron...');

    const start = new Date();

    start.setHours(0, 0, 0, 0);

    const end = new Date();

    end.setHours(23, 59, 59, 999);

    /**
     * Find active goals
     */

    const goals = await prisma.goal.findMany({
      where: {
        isActive: true,

        startDate: {
          lte: end,
        },

        endDate: {
          gte: start,
        },
      },

      select: {
        id: true,
        userId: true,
      },
    });

    for (const goal of goals) {
      /**
       * Check if user had activity today
       */

      const activityCount = await prisma.activity.count({
        where: {
          userId: goal.userId,

          startDate: {
            gte: start,
            lte: end,
          },
        },
      });

      if (activityCount === 0) {
        continue;
      }

      /**
       * Queue insight generation
       */
      await dailyInsightQueue.add(
        'generate-daily-insight',
        {
          userId: goal.userId,

          date: start.toISOString(),
        },
        {
          jobId: `daily-insight-${goal.userId}-${start.toISOString()}`,
        },
      );
    }

    console.log('Daily insight cron completed');
  });
};
