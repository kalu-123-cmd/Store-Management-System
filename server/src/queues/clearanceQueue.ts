/**
 * Clearance Queue Service - BullMQ + Redis + Circuit Breaker
 * 
 * This service implements an asynchronous job queue for processing
 * government e-invoicing clearance requests using BullMQ, Redis, and
 * Circuit Breaker pattern for resilience.
 * 
 * Key Features:
 * - Background job processing for clearance requests
 * - Circuit breaker pattern for fault tolerance
 * - HMAC-SHA256 signature verification
 * - Simulated government API integration
 * - Automatic retry mechanism for failed clearances
 * - Status tracking and persistence
 * - Real-time queue monitoring
 * - Transaction signature validation
 * 
 * @author Principal Software Architect
 * @version 2.0.0 - Enterprise Edition
 */

import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import CircuitBreaker from 'opossum';

// Configuration
const QUEUE_NAME = 'clearance-queue';
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

// Government API Simulation Configuration
const GOVERNMENT_API_CONFIG = {
  baseUrl: process.env.GOVERNMENT_API_URL || 'https://api.gov.et/e-invoicing',
  apiKey: process.env.GOVERNMENT_API_KEY || 'test-api-key',
  timeout: 30000, // 30 seconds
  maxRetries: 3,
};

// Circuit Breaker Configuration
const CIRCUIT_BREAKER_CONFIG = {
  timeout: 10000, // 10 seconds
  errorThresholdPercentage: 50, // 50% error rate triggers circuit breaker
  resetTimeout: 60000, // 60 seconds to reset circuit breaker
  rollingCountTimeout: 10000, // 10 seconds rolling window
  rollingCountBuckets: 10, // 10 buckets in rolling window
};

/**
 * Clearance Job Data Interface
 */
export interface ClearanceJobData {
  transactionId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  userId: string;
  signature: string; // HMAC-SHA256 signature
  retryCount?: number;
  timestamp: number;
}

/**
 * Government API Response Interface
 */
interface GovernmentClearanceResponse {
  success: boolean;
  irn?: string; // Invoice Reference Number
  rrn?: string; // Request Reference Number
  error?: string;
  errorCode?: string;
  signature?: string; // Response signature
}

/**
 * Generate HMAC-SHA256 signature for transaction verification
 */
export function generateTransactionSignature(
  transactionData: ClearanceJobData,
  secret: string = process.env.SIGNATURE_SECRET || 'default-secret'
): string {
  const dataString = JSON.stringify(transactionData);
  return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
}

/**
 * Verify transaction signature
 */
export function verifyTransactionSignature(
  transactionData: ClearanceJobData,
  signature: string,
  secret: string = process.env.SIGNATURE_SECRET || 'default-secret'
): boolean {
  const expectedSignature = generateTransactionSignature(transactionData, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Government E-Invoicing API Service
 * 
 * Simulates the Ethiopian government e-invoicing API integration.
 * In production, this would make actual HTTP requests to the government API.
 */
class GovernmentEInvoicingService {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    // Initialize circuit breaker for API calls
    this.circuitBreaker = new CircuitBreaker(
      this.submitForClearance.bind(this),
      CIRCUIT_BREAKER_CONFIG
    );

    // Circuit breaker event handlers
    this.circuitBreaker.on('open', () => {
      console.warn('🔴 Circuit breaker OPENED - Government API calls blocked');
    });

    this.circuitBreaker.on('halfOpen', () => {
      console.log('🟡 Circuit breaker HALF-OPEN - Testing API recovery');
    });

    this.circuitBreaker.on('close', () => {
      console.log('🟢 Circuit breaker CLOSED - API calls resumed');
    });

    this.circuitBreaker.on('fallback', (error) => {
      console.error('❌ Circuit breaker fallback triggered:', error.message);
    });
  }

  /**
   * Submit invoice to government system for clearance
   * 
   * @param invoiceData - Invoice details
   * @returns Promise with clearance response
   */
  async submitForClearance(invoiceData: ClearanceJobData): Promise<GovernmentClearanceResponse> {
    try {
      // Verify signature before submission
      if (!verifyTransactionSignature(invoiceData, invoiceData.signature)) {
        return {
          success: false,
          error: 'Invalid transaction signature',
          errorCode: 'SIGNATURE_INVALID',
        };
      }

      // Simulate API delay (2-5 seconds)
      await this.simulateNetworkDelay(2000, 5000);

      // Simulate 95% success rate (realistic for production)
      const isSuccess = Math.random() > 0.05;

      if (!isSuccess) {
        return {
          success: false,
          error: 'Government system temporarily unavailable',
          errorCode: 'GOV_TIMEOUT',
        };
      }

      // Generate mock IRN and RRN (in production, these come from government)
      const irn = this.generateIRN();
      const rrn = this.generateRRN();
      const signature = this.generateResponseSignature(irn, rrn);

      return {
        success: true,
        irn,
        rrn,
        signature,
      };
    } catch (error) {
      console.error('Government API call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown API error',
        errorCode: 'API_ERROR',
      };
    }
  }

  /**
   * Submit with circuit breaker protection
   */
  async submitWithCircuitBreaker(invoiceData: ClearanceJobData): Promise<GovernmentClearanceResponse> {
    try {
      return await this.circuitBreaker.fire(invoiceData);
    } catch (error) {
      console.error('Circuit breaker protected call failed:', error);
      return {
        success: false,
        error: 'Circuit breaker triggered - API temporarily unavailable',
        errorCode: 'CIRCUIT_BREAKER',
      };
    }
  }

  /**
   * Simulate network delay for realistic API behavior
   */
  private async simulateNetworkDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Generate mock Invoice Reference Number (IRN)
   * Format: ET + year + random 10 digits
   */
  private generateIRN(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    return `ET${year}${random}`;
  }

  /**
   * Generate mock Request Reference Number (RRN)
   * Format: RRN + timestamp + random 6 digits
   */
  private generateRRN(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `RRN${timestamp}${random}`;
  }

  /**
   * Generate response signature
   */
  private generateResponseSignature(irn: string, rrn: string): string {
    const dataString = `${irn}${rrn}${Date.now()}`;
    return crypto.createHmac('sha256', 'response-secret').update(dataString).digest('hex');
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): {
    open: boolean;
    stats: any;
  } {
    return {
      open: this.circuitBreaker.opened,
      stats: this.circuitBreaker.stats,
    };
  }
}

/**
 * Clearance Queue Service
 * 
 * Manages the BullMQ queue and worker for processing clearance jobs.
 */
export class ClearanceQueueService {
  private queue: Queue;
  private worker: Worker;
  private prisma: PrismaClient;
  private governmentService: GovernmentEInvoicingService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.governmentService = new GovernmentEInvoicingService();
    
    // Initialize BullMQ queue
    this.queue = new Queue(QUEUE_NAME, {
      connection: REDIS_CONFIG,
      defaultJobOptions: {
        attempts: 3, // Retry 3 times on failure
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 seconds, exponential backoff
        },
        removeOnComplete: {
          count: 1000, // Keep last 1000 completed jobs
          age: 3600, // Remove after 1 hour
        },
        removeOnFail: {
          count: 5000, // Keep last 5000 failed jobs
          age: 86400, // Remove after 24 hours
        },
      },
    });

    // Initialize worker
    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job<ClearanceJobData>) => {
        return this.processClearanceJob(job);
      },
      {
        connection: REDIS_CONFIG,
        concurrency: 5, // Process 5 jobs concurrently
      }
    );

    // Set up worker event handlers
    this.setupWorkerEvents();
  }

  /**
   * Set up worker event handlers for monitoring
   */
  private setupWorkerEvents(): void {
    this.worker.on('completed', (job) => {
      console.log(`✅ Clearance job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`❌ Clearance job failed: ${job?.id}`, error.message);
    });

    this.worker.on('error', (error) => {
      console.error('Worker error:', error);
    });

    this.worker.on('progress', (job, progress) => {
      console.log(`🔄 Job progress: ${job.id} - ${progress}%`);
    });
  }

  /**
   * Add clearance job to queue
   * 
   * @param jobData - Clearance job data
   * @returns Promise with job ID
   */
  async addClearanceJob(jobData: ClearanceJobData): Promise<string> {
    // Generate signature if not provided
    if (!jobData.signature) {
      jobData.signature = generateTransactionSignature(jobData);
    }

    // Add timestamp
    jobData.timestamp = Date.now();

    const job = await this.queue.add('clearance-request', jobData, {
      jobId: jobData.transactionId, // Use transaction ID as job ID
      priority: 1, // Normal priority
    });

    console.log(`📋 Clearance job added to queue: ${job.id}`);
    return job.id!;
  }

  /**
   * Process individual clearance job
   * 
   * @param job - BullMQ job instance
   * @returns Promise with processing result
   */
  private async processClearanceJob(job: Job<ClearanceJobData>): Promise<void> {
    const { transactionId } = job.data;

    try {
      console.log(`🔄 Processing clearance job: ${transactionId}`);

      // Update transaction status to processing
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          clearanceStatus: 'PROCESSING',
        },
      });

      // Call government API for clearance with circuit breaker protection
      const response = await this.governmentService.submitWithCircuitBreaker(job.data);

      if (response.success && response.irn && response.rrn) {
        // Update transaction as cleared
        await this.prisma.transaction.update({
          where: { id: transactionId },
          data: {
            clearanceStatus: 'CLEARED',
            irn: response.irn,
            rrn: response.rrn,
            clearedAt: new Date(),
          },
        });

        console.log(`✅ Transaction cleared: ${transactionId} (IRN: ${response.irn})`);
      } else {
        // Update transaction as failed
        await this.prisma.transaction.update({
          where: { id: transactionId },
          data: {
            clearanceStatus: 'FAILED',
            failureReason: response.error || 'Unknown clearance failure',
          },
        });

        throw new Error(`Clearance failed: ${response.error}`);
      }
    } catch (error) {
      console.error(`❌ Clearance processing failed for ${transactionId}:`, error);

      // Update transaction status if not already failed
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          clearanceStatus: 'FAILED',
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }

  /**
   * Get queue statistics
   * 
   * @returns Promise with queue metrics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return this.governmentService.getCircuitBreakerStatus();
  }

  /**
   * Pause queue processing
   */
  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    console.log('⏸️ Clearance queue paused');
  }

  /**
   * Resume queue processing
   */
  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    console.log('▶️ Clearance queue resumed');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down clearance queue service...');
    await this.worker.close();
    await this.queue.close();
    console.log('✅ Clearance queue service shut down');
  }
}

/**
 * Initialize clearance queue service
 * 
 * Factory function to create and configure the clearance queue service.
 * 
 * @param prisma - Prisma client instance
 * @returns ClearanceQueueService instance
 */
export function initializeClearanceQueue(prisma: PrismaClient): ClearanceQueueService {
  const service = new ClearanceQueueService(prisma);
  console.log('✅ Clearance queue service initialized with circuit breaker');
  return service;
}
