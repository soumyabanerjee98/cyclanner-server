import '@/workers/activity.worker.js'; // start activity worker
import '@/workers/dailyInsight.worker.js'; // start daily insight worker (Updates daily insights after everty activity creation, later it will be used for cron end daily insight generation if user is subscribed to premium)
import '@/workers/goalSummary.worker.js'; // start goal summary worker (Unused for now, but will be used for cron end goal summary in future if user is subscribed to premium)
import '@/workers/goalEvaluation.worker.js'; // start goal evaluation worker (Evaluates goal completion after every activity creation, later it will be used for cron end goal evaluation in future if user is subscribed to premium)

console.log('Workers initialized');
