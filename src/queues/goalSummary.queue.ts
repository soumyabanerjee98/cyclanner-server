import { redis } from '@/lib/redis.js';
import { Queue } from 'bullmq';

export const goalSummaryQueue = new Queue(
  'goal-summary',

  {
    connection: redis,

    defaultJobOptions: {
      attempts: 3,

      backoff: {
        type: 'exponential',
        delay: 5000,
      },

      removeOnComplete: {
        age: 60,
      },

      removeOnFail: {
        age: 24 * 3600,
      },

      // removeOnComplete: {
      //   age: 60, // 1 minute
      //   count: 200,
      // },

      // removeOnFail: {
      //   age: 604800, // 1 week
      //   count: 500,
      // },
    },
  },
);
