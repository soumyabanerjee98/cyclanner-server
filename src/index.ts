import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { validateApiKey } from './middleware/apiKey.middleware.js';
import routes from '@/routes/index.js';
import { apiLimiter } from './utils/rate_limiter.util.js';
import AppError from './handler/error.handler.js';
import '@/workers/index.js'; // start activity worker
import '@/cron/index.js'; // start cron jobs

const app = express();

app.use(
  apiLimiter({
    minutes: 1,
    maxRequests: 200,
    message: 'Too many requests from this IP, please try again after 1 minute',
  }),
); // Apply rate limiter to all requests

app.use(
  cors({
    origin: '*',
    credentials: true,
  }),
);

app.use('/api/strava/webhook', express.raw({ type: 'application/json' }));

app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use('/api', validateApiKey, routes); // apply routes

app.get('/health', (_, res) => {
  res.json({ status: 'OK' });
});

app.use((err: any, req: Request, res: Response, next: any) => {
  console.error(err);
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.statusCode === 500 ? 'Internal Server Error' : 'Error',
      message: err.message,
    });
  }
  return res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
