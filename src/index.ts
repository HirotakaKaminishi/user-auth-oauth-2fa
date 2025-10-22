import app from './app';
import { config } from './config';
import logger from './config/logger';
import { testDatabaseConnection, closeDatabaseConnection } from './config/database';
import { testRedisConnection, closeRedisConnection } from './config/redis';

// Server instance
let server: ReturnType<typeof app.listen> | null = null;

// Start server
async function startServer(): Promise<void> {
  try {
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to PostgreSQL');
    }

    // Test Redis connection
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      throw new Error('Failed to connect to Redis');
    }

    // Start HTTP server
    server = app.listen(config.server.port, config.server.host, () => {
      logger.info(`Server started successfully`, {
        host: config.server.host,
        port: config.server.port,
        env: config.server.env,
        nodeVersion: process.version,
      });
    });

    // Handle server errors
    server.on('error', (error: Error) => {
      logger.error('Server error', { error });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await closeDatabaseConnection();
        await closeRedisConnection();
        logger.info('All connections closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason });
  gracefulShutdown('unhandledRejection');
});

// Start the server
if (require.main === module) {
  startServer();
}

export { app, startServer, gracefulShutdown };
