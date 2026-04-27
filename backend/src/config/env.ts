import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  // Admin notifications/approval
  ADMIN_TELEGRAM_CHAT_ID: z.string().min(1),
  PUBLIC_BASE_URL: z.string().url(),

  MARZBAN_URL: z.string().url(),
  MARZBAN_USERNAME: z.string().min(1),
  MARZBAN_PASSWORD: z.string().min(1),
  // Optional: restrict Marzban user creation to this inbound tag
  // (useful to force 🇳🇱 / 🇫🇷 etc to appear in clients)
  MARZBAN_INBOUND_TAG: z.string().min(1).optional(),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);

