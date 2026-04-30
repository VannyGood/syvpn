import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';

import { authRoutes } from './routes/authRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { planRoutes } from './routes/planRoutes.js';
import { subscriptionRoutes } from './routes/subscriptionRoutes.js';
import { walletRoutes } from './routes/walletRoutes.js';
import { paymentRoutes } from './routes/paymentRoutes.js';
import { toolsRoutes } from './routes/toolsRoutes.js';
import { proxyPublicSubscription } from './controllers/subProxyController.js';

const app = express();

// Behind Nginx reverse proxy; required for correct rate limiting + IP handling.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const subFetchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 400,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.get('/sub/:token', subFetchLimiter, proxyPublicSubscription);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use(userRoutes);
app.use(planRoutes);
app.use(subscriptionRoutes);
app.use(walletRoutes);
app.use(paymentRoutes);
app.use('/tools', toolsRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on :${env.PORT}`);
});

