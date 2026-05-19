import { redis } from '@/lib/redis.js';
import { getGoalSummary } from '@/service/v1/summary.service.js';
import { Worker } from 'bullmq';

console.log('Goal summary worker started');

export const goalSummaryWorker = new Worker(
  'goal-summary',

  async (job) => {
    const { userId, date } = job.data;

    return await getGoalSummary(userId, new Date(date));
  },

  {
    connection: redis,

    concurrency: 3,
  },
);

goalSummaryWorker.on('completed', (job) => {
  console.log(`Goal summary completed: ${job.id}`);
});

goalSummaryWorker.on('failed', (job, err) => {
  console.error(`Goal summary failed: ${job?.id}`, err);
});
