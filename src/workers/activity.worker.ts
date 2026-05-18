import { redis } from '@/lib/redis.js';
import { syncActivity } from '@/service/v1/strava.service.js';
import { Worker } from 'bullmq';

export const activityWorker = new Worker(
  'activity-sync',

  async (job) => {
    switch (job.name) {
      case 'sync-activity': {
        const { activityId, athleteId } = job.data;

        return await syncActivity(parseInt(activityId), parseInt(athleteId));
      }

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },

  {
    connection: redis,

    concurrency: 5,
  },
);

activityWorker.on('completed', (job) => {
  console.log(`Job completed: ${job.id}`);
});

activityWorker.on('failed', (job, err) => {
  console.error(`Job failed: ${job?.id}`, err);
});
