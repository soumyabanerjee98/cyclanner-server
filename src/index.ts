import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { validateApiKey } from './middleware/apiKey.middleware.js';
import routes from '@/routes/index.js';

const app = express();

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

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  return res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
