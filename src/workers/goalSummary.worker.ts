import { redis } from '@/lib/redis.js';
import { getAISummary } from '@/service/v1/summary.service.js';
import { Worker } from 'bullmq';

console.log('Goal summary worker started');

export const goalSummaryWorker = new Worker(
  'goal-summary',

  async (job) => {
    switch (job.name) {
      case 'generate-ai-summary': {
        const { summaryId } = job.data;

        return await getAISummary(summaryId);
      }

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
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
