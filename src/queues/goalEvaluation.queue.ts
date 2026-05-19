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
        age: 3600,
        count: 200,
      },

      removeOnFail: {
        age: 604800,
        count: 500,
      },
    },
  },
);
