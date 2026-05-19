import { redis } from '@/lib/redis.js';
import { getDailyInsights } from '@/service/v1/insight.service.js';
import { Worker } from 'bullmq';

console.log('Daily insight worker started');

export const dailyInsightWorker = new Worker(
  'daily-insight',

  async (job) => {
    const { userId, date, regenerate } = job.data;

    return await getDailyInsights(userId, new Date(date), regenerate);
  },

  {
    connection: redis,

    concurrency: 5,
  },
);

dailyInsightWorker.on('completed', (job) => {
  console.log(`Daily insight completed: ${job.id}`);
});

dailyInsightWorker.on('failed', (job, err) => {
  console.error(`Daily insight failed: ${job?.id}`, err);
});
