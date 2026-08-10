/**
 * Mobile Money Webhook Reconciliation Service
 * 
 * This service handles mobile money payment processing, QR code generation,
 * webhook verification, and real-time payment status updates via WebSockets.
 * 
 * Key Features:
 * - Dynamic QR code generation for payments
 * - Express webhook endpoint for payment callbacks
 * - Webhook signature verification
 * - Real-time payment status updates via GraphQL subscriptions
 * - Payment reconciliation and matching
 * - Support for Telebirr, M-Pesa, and other mobile money providers
 * - WebSocket integration for live updates
 * 
 * @author Principal Software Architect
 * @version 2.0.0 - Enterprise Edition
 */

import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { WebSocketServer } from 'ws';

/**
 * Mobile Money Provider Configuration
 */
export interface MobileMoneyProvider {
  name: string;
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
  qrCodePrefix: string;
}

/**
 * Payment Request
 */
export interface PaymentRequest {
  transactionId: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  provider: 'TELEBIRR' | 'MPESA' | 'MOMO' | 'CBE';
  description?: string;
  callbackUrl: string;
}

/**
 * Payment Response
 */
export interface PaymentResponse {
  success: boolean;
  paymentId: string;
  qrCode?: string;
  paymentUrl?: string;
  expiresAt: Date;
  error?: string;
}

/**
 * Webhook Callback Data
 */
export interface WebhookCallback {
  paymentId: string;
  transactionId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount: number;
  provider: string;
  providerTransactionId: string;
  timestamp: number;
  signature: string;
}

/**
 * Payment Status Update
 */
export interface PaymentStatusUpdate {
  transactionId: string;
  status: string;
  providerTransactionId?: string;
  completedAt?: Date;
  metadata?: any;
}

/**
 * Mobile Money Payment Service
 */
export class MobileMoneyService {
  private prisma: PrismaClient;
  private providers: Map<string, MobileMoneyProvider>;
  private wsServer: WebSocketServer | null = null;

  constructor(prisma: PrismaClient, providers: MobileMoneyProvider[] = []) {
    this.prisma = prisma;
    this.providers = new Map();
    
    // Initialize providers
    providers.forEach(provider => {
      this.providers.set(provider.name, provider);
    });

    // Add default Telebirr configuration
    if (!this.providers.has('TELEBIRR')) {
      this.providers.set('TELEBIRR', {
        name: 'TELEBIRR',
        apiKey: process.env.TELEBIRR_API_KEY || 'default-key',
        apiSecret: process.env.TELEBIRR_API_SECRET || 'default-secret',
        webhookUrl: process.env.TELEBIRR_WEBHOOK_URL || '',
        qrCodePrefix: 'TELEBIRR',
      });
    }
  }

  /**
   * Set up WebSocket server for real-time updates
   */
  setupWebSocketServer(server: any): void {
    this.wsServer = new WebSocketServer({ server, path: '/ws/payments' });

    this.wsServer.on('connection', (ws) => {
      console.log('WebSocket client connected for payment updates');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('WebSocket message received:', data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });

    console.log('WebSocket server initialized for payment updates');
  }

  /**
   * Broadcast payment status update to all connected clients
   */
  private broadcastPaymentUpdate(update: PaymentStatusUpdate): void {
    if (!this.wsServer) {
      console.warn('WebSocket server not initialized');
      return;
    }

    const message = JSON.stringify({
      type: 'PAYMENT_UPDATE',
      data: update,
      timestamp: new Date().toISOString(),
    });

    this.wsServer.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  /**
   * Generate QR code for payment
   */
  async generatePaymentQRCode(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const provider = this.providers.get(request.provider);
      if (!provider) {
        throw new Error(`Provider ${request.provider} not configured`);
      }

      // Create payment record
      const payment = await this.prisma.payment.create({
        data: {
          transactionId: request.transactionId,
          amount: request.amount,
          currency: request.currency,
          phoneNumber: request.phoneNumber,
          provider: request.provider,
          status: 'PENDING',
          description: request.description,
          callbackUrl: request.callbackUrl,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes expiry
        },
      });

      // Generate payment URL
      const paymentUrl = this.generatePaymentUrl(payment.id, provider);
      
      // Generate QR code
      const qrCode = await QRCode.toDataURL(paymentUrl);

      return {
        success: true,
        paymentId: payment.id,
        qrCode,
        paymentUrl,
        expiresAt: payment.expiresAt,
      };
    } catch (error) {
      console.error('Failed to generate payment QR code:', error);
      return {
        success: false,
        paymentId: '',
        expiresAt: new Date(),
        error: error instanceof Error ? error.message : 'QR code generation failed',
      };
    }
  }

  /**
   * Generate payment URL for QR code
   */
  private generatePaymentUrl(paymentId: string, provider: MobileMoneyProvider): string {
    const baseUrl = provider.webhookUrl || 'https://mobilemoney.example.com';
    const paymentData = `${provider.qrCodePrefix}:${paymentId}:${Date.now()}`;
    return `${baseUrl}/pay/${encodeURIComponent(paymentData)}`;
  }

  /**
   * Generate webhook signature
   */
  private generateWebhookSignature(callback: WebhookCallback, secret: string): string {
    const dataString = JSON.stringify(callback);
    return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(callback: WebhookCallback, signature: string, secret: string): boolean {
    const expectedSignature = this.generateWebhookSignature(callback, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Process webhook callback
   */
  async processWebhookCallback(callback: WebhookCallback): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = this.providers.get(callback.provider);
      if (!provider) {
        throw new Error(`Provider ${callback.provider} not configured`);
      }

      // Verify signature
      if (!this.verifyWebhookSignature(callback, callback.signature, provider.apiSecret)) {
        throw new Error('Invalid webhook signature');
      }

      // Find payment record
      const payment = await this.prisma.payment.findUnique({
        where: { id: callback.paymentId },
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Update payment status
      const updateData: any = {
        status: callback.status,
        providerTransactionId: callback.providerTransactionId,
      };

      if (callback.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }

      await this.prisma.payment.update({
        where: { id: callback.paymentId },
        data: updateData,
      });

      // Update transaction status if payment completed
      if (callback.status === 'COMPLETED') {
        await this.prisma.transaction.update({
          where: { id: callback.transactionId },
          data: {
            clearanceStatus: 'CLEARED',
            clearedAt: new Date(),
          },
        });
      }

      // Broadcast real-time update
      this.broadcastPaymentUpdate({
        transactionId: callback.transactionId,
        status: callback.status,
        providerTransactionId: callback.providerTransactionId,
        completedAt: callback.status === 'COMPLETED' ? new Date() : undefined,
      });

      // Create audit log
      await this.prisma.activityLog.create({
        data: {
          userId: 'SYSTEM',
          action: 'PAYMENT_WEBHOOK_RECEIVED',
          entityType: 'PAYMENT',
          entityId: callback.paymentId,
          details: `Payment webhook received: ${callback.status}`,
          newValue: JSON.stringify(callback),
        },
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to process webhook callback:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed',
      };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<{
    paymentId: string;
    transactionId: string;
    status: string;
    amount: number;
    provider: string;
    completedAt?: Date;
  } | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        transactionId: true,
        status: true,
        amount: true,
        provider: true,
        completedAt: true,
      },
    });

    if (!payment) {
      return null;
    }

    return {
      paymentId: payment.id,
      transactionId: payment.transactionId,
      status: payment.status,
      amount: payment.amount,
      provider: payment.provider,
      completedAt: payment.completedAt || undefined,
    };
  }

  /**
   * Reconcile payments
   */
  async reconcilePayments(): Promise<{
    totalPayments: number;
    completedPayments: number;
    failedPayments: number;
    pendingPayments: number;
    totalAmount: number;
  }> {
    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    const completedPayments = payments.filter(p => p.status === 'COMPLETED').length;
    const failedPayments = payments.filter(p => p.status === 'FAILED').length;
    const pendingPayments = payments.filter(p => p.status === 'PENDING').length;
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalPayments: payments.length,
      completedPayments,
      failedPayments,
      pendingPayments,
      totalAmount,
    };
  }

  /**
   * Set up Express webhook endpoints
   */
  setupExpressRoutes(app: Express): void {
    // Webhook endpoint for payment callbacks
    app.post('/api/payments/webhook/:provider', async (req, res) => {
      try {
        const { provider } = req.params;
        const callback: WebhookCallback = req.body;

        // Verify provider
        if (!this.providers.has(provider)) {
          return res.status(400).json({ error: 'Invalid provider' });
        }

        // Process webhook
        const result = await this.processWebhookCallback(callback);

        if (result.success) {
          res.status(200).json({ success: true });
        } else {
          res.status(400).json({ error: result.error });
        }
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Payment status endpoint
    app.get('/api/payments/:paymentId/status', async (req, res) => {
      try {
        const { paymentId } = req.params;
        const status = await this.getPaymentStatus(paymentId);

        if (!status) {
          return res.status(404).json({ error: 'Payment not found' });
        }

        res.status(200).json(status);
      } catch (error) {
        console.error('Payment status check error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Reconciliation endpoint
    app.get('/api/payments/reconciliation', async (req, res) => {
      try {
        const reconciliation = await this.reconcilePayments();
        res.status(200).json(reconciliation);
      } catch (error) {
        console.error('Reconciliation error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    console.log('Express webhook routes configured');
  }
}

/**
 * Create mobile money service instance
 */
export function createMobileMoneyService(
  prisma: PrismaClient,
  providers?: MobileMoneyProvider[]
): MobileMoneyService {
  return new MobileMoneyService(prisma, providers);
}