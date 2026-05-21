import { Queue } from 'bullmq';
import { redis } from '@/lib/redis.js';

export const goalEvaluationQueue = new Queue(
  'goal-evaluation',

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
