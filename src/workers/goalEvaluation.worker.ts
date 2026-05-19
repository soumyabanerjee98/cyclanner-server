import { Worker } from 'bullmq';
import { redis } from '@/lib/redis.js';
import { evaluateGoalCompletion } from '@/service/v1/goal.service.js';

console.log('Goal evaluation worker started');

export const goalEvaluationWorker = new Worker(
  'goal-evaluation',

  async (job) => {
    switch (job.name) {
      case 'evaluate-goal-completion': {
        const { goalId } = job.data;

        return await evaluateGoalCompletion(goalId);
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

goalEvaluationWorker.on('completed', (job) => {
  console.log(`Goal evaluation completed: ${job.id}`);
});

goalEvaluationWorker.on('failed', (job, err) => {
  console.error(`Goal evaluation failed: ${job?.id}`, err);
});
