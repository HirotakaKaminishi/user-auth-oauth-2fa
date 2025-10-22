import dotenv from 'dotenv';
import { z } from 'zod';
import * as path from 'path';

// Load environment variables
// Load .env.test in test environment, otherwise load .env
const envFile = process.env['NODE_ENV'] === 'test' ? '.env.test' : '.env';
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath, override: false });

// Environment variable schema with Zod validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  HOST: z.string().default('localhost'),

  // Database
  DATABASE_URL: z.string().url().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('5432'),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z.string().transform((val) => val === 'true').default('false'),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).pipe(z.number().min(0).max(15)).default('0'),

  // Session
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL: z.string().transform(Number).pipe(z.number().min(1)).default('604800'),

  // OAuth - Google (disabled - GCP account required)
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // OAuth - GitHub
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),

  // OAuth - Microsoft
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_CALLBACK_URL: z.string().url(),

  // Security
  ENCRYPTION_KEY: z.string().min(32),
  BCRYPT_ROUNDS: z.string().transform(Number).pipe(z.number().min(10).max(20)).default('14'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  CORS_CREDENTIALS: z.string().transform((val) => val === 'true').default('true'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().min(1)).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().min(1)).default('100'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),

  // Sentry
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  SENTRY_TRACES_SAMPLE_RATE: z.string().transform(Number).pipe(z.number().min(0).max(1)).default('1.0'),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      throw new Error(`Invalid environment variables:\n${missingVars}`);
    }
    throw error;
  }
};

const env = parseEnv();

// Application configuration
export const config = {
  server: {
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',
  },

  database: {
    url: env.DATABASE_URL,
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL,
    connectionString: env.DATABASE_URL || `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`,
  },

  redis: {
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
  },

  session: {
    secret: env.SESSION_SECRET,
    ttl: env.SESSION_TTL,
    cookieName: 'auth_session',
    cookieOptions: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: env.SESSION_TTL * 1000,
      path: '/',
    },
  },

  oauth: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      callbackURL: env.GITHUB_CALLBACK_URL,
      scope: ['user:email', 'read:user'],
    },
    microsoft: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      callbackURL: env.MICROSOFT_CALLBACK_URL,
      scope: ['openid', 'profile', 'email'],
    },
  },

  security: {
    encryptionKey: env.ENCRYPTION_KEY,
    bcryptRounds: env.BCRYPT_ROUNDS,
  },

  cors: {
    origin: env.CORS_ORIGIN,
    credentials: env.CORS_CREDENTIALS,
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
  },

  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },

  sentry: {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  },
} as const;

export type Config = typeof config;
