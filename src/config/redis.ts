import Redis, { Redis as RedisClient, RedisOptions } from 'ioredis';
import { config } from './index';
import logger from './logger';

// Redis connection configuration
const redisOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

// Create Redis client
export const redis: RedisClient = new Redis(redisOptions);

// Redis event handlers
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready to accept commands');
});

redis.on('error', (err) => {
  logger.error('Redis client error', { error: err });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting');
});

// Test Redis connection
export const testRedisConnection = async (): Promise<boolean> => {
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      logger.info('Redis connection established successfully');
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to connect to Redis', { error });
    return false;
  }
};

// Graceful shutdown
export const closeRedisConnection = async (): Promise<void> => {
  try {
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection', { error });
  }
};

export default redis;
