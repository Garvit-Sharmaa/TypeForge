import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV:      z.enum(['development', 'production', 'test']).default('development'),
  API_PORT:      z.coerce.number().default(4000),
  API_SECRET_KEY: z.string().min(32, 'API_SECRET_KEY must be at least 32 characters'),

  // PostgreSQL
  DATABASE_URL:  z.string().url(),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_USER: z.string().default('typingmaster'),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB:   z.string().default('typingmaster'),

  // Redis
  REDIS_URL:     z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET:          z.string().min(32),
  JWT_EXPIRES_IN:      z.string().default('15m'),
  JWT_REFRESH_SECRET:  z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // OAuth
  GOOGLE_CLIENT_ID:     z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL:  z.string().optional(),
  GITHUB_CLIENT_ID:     z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL:  z.string().optional(),

  // Observability
  LOG_LEVEL: z.enum(['trace','debug','info','warn','error','fatal']).default('info'),
  SENTRY_DSN: z.string().optional(),
});

// Parse and freeze — crash early on misconfiguration
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
