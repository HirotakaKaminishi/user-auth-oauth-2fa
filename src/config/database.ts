import { Pool, PoolConfig } from 'pg';
import { config } from './index';
import logger from './logger';

// PostgreSQL connection configuration
const poolConfig: PoolConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create PostgreSQL connection pool
export const pool = new Pool(poolConfig);

// Pool error handling
pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err });
});

// Test database connection
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('PostgreSQL connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL', { error });
    return false;
  }
};

// Graceful shutdown
export const closeDatabaseConnection = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('PostgreSQL pool closed');
  } catch (error) {
    logger.error('Error closing PostgreSQL pool', { error });
  }
};

export default pool;
