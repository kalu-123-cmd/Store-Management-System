/**
 * Development Configuration - Redis Fallback
 * 
 * This configuration allows the system to work without Redis
 * for development purposes by using synchronous processing
 * as a fallback when Redis is not available.
 */

import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';

/**
 * Check if Redis is available
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const Redis = require('ioredis');
    const client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Disable retries for quick check
    });

    await client.ping();
    await client.quit();
    return true;
  } catch (error) {
    console.warn('Redis not available, using synchronous processing');
    return false;
  }
}

/**
 * Create queue with Redis fallback
 */
export async function createQueueWithFallback(queueName: string, prisma: PrismaClient) {
  const redisAvailable = await checkRedisConnection();

  if (redisAvailable) {
    // Use BullMQ with Redis
    const { Queue } = require('bullmq');
    const REDIS_CONFIG = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };

    return new Queue(queueName, {
      connection: REDIS_CONFIG,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });
  } else {
    // Return null to indicate synchronous processing
    console.log('Queue initialized in synchronous mode (no Redis)');
    return null;
  }
}

/**
 * Process job synchronously if Redis is not available
 */
export async function processJobSynchronously(
  jobData: any,
  processor: (jobData: any) => Promise<void>
): Promise<void> {
  console.log('Processing job synchronously:', jobData);
  await processor(jobData);
  console.log('Job processed synchronously');
}
