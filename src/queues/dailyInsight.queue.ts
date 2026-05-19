import { redis } from '@/lib/redis.js';
import { Queue } from 'bullmq';

export const dailyInsightQueue = new Queue('daily-insight', {
  connection: redis,

  defaultJobOptions: {
    attempts: 3,

    backoff: {
      type: 'exponential',
      delay: 5000,
    },

    removeOnComplete: {
      age: 3600, // 1 hour
      count: 200,
    },

    removeOnFail: {
      age: 604800, // 1 week
      count: 1000,
    },
  },
});
