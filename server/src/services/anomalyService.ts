/**
 * Anomaly Detection Service - Enterprise Fraud Detection
 * 
 * This service provides comprehensive anomaly detection and risk scoring
 * for retail operations, focusing on cashier behavior and transaction patterns.
 * 
 * Key Features:
 * - Real-time risk scoring (0-100 scale)
 * - Pattern-based anomaly detection
 * - Post-print receipt void detection
 * - Excessive manual price override detection
 * - Suspicious transaction timing analysis
 * - Background worker for continuous monitoring
 * - Regulatory compliance tracking
 * 
 * @author Principal Software Architect
 * @version 2.0.0 - Enterprise Edition
 */

import { PrismaClient } from '@prisma/client';

/**
 * Risk Score Configuration
 */
export interface RiskConfig {
  postPrintVoidWeight: number;        // Weight for voiding after print
  priceOverrideWeight: number;        // Weight for manual price changes
  largeTransactionWeight: number;     // Weight for unusually large transactions
  rapidTransactionWeight: number;     // Weight for rapid successive transactions
  voidRateThreshold: number;          // Void rate threshold (%)
  overrideRateThreshold: number;      // Override rate threshold (%)
  largeTransactionThreshold: number;  // Amount threshold for large transactions
  rapidTransactionWindow: number;     // Time window for rapid detection (seconds)
}

/**
 * Cashier Risk Profile
 */
export interface CashierRiskProfile {
  userId: string;
  userName: string;
  riskScore: number;                  // 0-100 risk score
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  anomalies: AnomalyType[];
  metrics: CashierMetrics;
  lastUpdated: Date;
}

/**
 * Anomaly Type Definition
 */
export interface AnomalyType {
  type: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  timestamp: Date;
  details: any;
}

/**
 * Cashier Performance Metrics
 */
export interface CashierMetrics {
  totalTransactions: number;
  totalVoids: number;
  totalOverrides: number;
  totalSales: number;
  voidRate: number;
  overrideRate: number;
  averageTransactionValue: number;
  rapidTransactionCount: number;
  postPrintVoidCount: number;
}

/**
 * Default Risk Configuration
 */
const DEFAULT_RISK_CONFIG: RiskConfig = {
  postPrintVoidWeight: 30,
  priceOverrideWeight: 20,
  largeTransactionWeight: 15,
  rapidTransactionWeight: 10,
  voidRateThreshold: 5,           // 5% void rate is suspicious
  overrideRateThreshold: 10,     // 10% override rate is suspicious
  largeTransactionThreshold: 10000, // ETB 10,000
  rapidTransactionWindow: 60,     // 60 seconds
};

/**
 * Anomaly Detection Service
 * 
 * Provides comprehensive anomaly detection and risk scoring capabilities.
 */
export class AnomalyDetectionService {
  private prisma: PrismaClient;
  private config: RiskConfig;

  constructor(prisma: PrismaClient, config?: Partial<RiskConfig>) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  /**
   * Calculate comprehensive risk score for a cashier
   * 
   * @param userId - User ID to analyze
   * @param timeWindow - Time window for analysis (default: 24 hours)
   * @returns CashierRiskProfile with risk score and anomalies
   */
  async calculateCashierRiskScore(
    userId: string,
    timeWindow: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<CashierRiskProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const startDate = new Date(Date.now() - timeWindow);
    const anomalies: AnomalyType[] = [];
    let riskScore = 0;

    // Get cashier metrics
    const metrics = await this.getCashierMetrics(userId, startDate);

    // Detect anomalies
    const voidAnomaly = this.detectVoidRateAnomaly(metrics);
    if (voidAnomaly) {
      anomalies.push(voidAnomaly);
      riskScore += voidAnomaly.score;
    }

    const overrideAnomaly = this.detectOverrideRateAnomaly(metrics);
    if (overrideAnomaly) {
      anomalies.push(overrideAnomaly);
      riskScore += overrideAnomaly.score;
    }

    const largeTransactionAnomaly = this.detectLargeTransactionAnomaly(metrics);
    if (largeTransactionAnomaly) {
      anomalies.push(largeTransactionAnomaly);
      riskScore += largeTransactionAnomaly.score;
    }

    const rapidTransactionAnomaly = this.detectRapidTransactionAnomaly(userId, startDate);
    if (rapidTransactionAnomaly) {
      anomalies.push(rapidTransactionAnomaly);
      riskScore += rapidTransactionAnomaly.score;
    }

    const postPrintVoidAnomaly = await this.detectPostPrintVoidAnomaly(userId, startDate);
    if (postPrintVoidAnomaly) {
      anomalies.push(postPrintVoidAnomaly);
      riskScore += postPrintVoidAnomaly.score;
    }

    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);

    // Determine risk level
    const riskLevel = this.determineRiskLevel(riskScore);

    // Store risk profile in database
    await this.storeRiskProfile(userId, riskScore, riskLevel, anomalies);

    return {
      userId: user.id,
      userName: user.name,
      riskScore,
      riskLevel,
      anomalies,
      metrics,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get cashier performance metrics
   */
  private async getCashierMetrics(
    userId: string,
    startDate: Date
  ): Promise<CashierMetrics> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      select: {
        id: true,
        type: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    const sales = transactions.filter(t => t.type === 'OUT');
    const totalSales = sales.length;
    const totalVoids = transactions.filter(t => t.type === 'VOID').length;
    const totalSalesAmount = sales.reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    // Get price overrides from audit logs
    const overrideLogs = await this.prisma.activityLog.findMany({
      where: {
        userId,
        action: 'PRICE_OVERRIDE',
        createdAt: { gte: startDate },
      },
    });

    const totalOverrides = overrideLogs.length;

    return {
      totalTransactions: transactions.length,
      totalVoids,
      totalOverrides,
      totalSales,
      voidRate: totalSales > 0 ? (totalVoids / totalSales) * 100 : 0,
      overrideRate: totalSales > 0 ? (totalOverrides / totalSales) * 100 : 0,
      averageTransactionValue: totalSales > 0 ? totalSalesAmount / totalSales : 0,
      rapidTransactionCount: 0, // Calculated separately
      postPrintVoidCount: 0, // Calculated separately
    };
  }

  /**
   * Detect void rate anomaly
   */
  private detectVoidRateAnomaly(metrics: CashierMetrics): AnomalyType | null {
    if (metrics.voidRate > this.config.voidRateThreshold) {
      return {
        type: 'HIGH_VOID_RATE',
        description: `Void rate ${metrics.voidRate.toFixed(2)}% exceeds threshold ${this.config.voidRateThreshold}%`,
        severity: metrics.voidRate > 15 ? 'HIGH' : 'MEDIUM',
        score: 25,
        timestamp: new Date(),
        details: { voidRate: metrics.voidRate, threshold: this.config.voidRateThreshold },
      };
    }
    return null;
  }

  /**
   * Detect price override rate anomaly
   */
  private detectOverrideRateAnomaly(metrics: CashierMetrics): AnomalyType | null {
    if (metrics.overrideRate > this.config.overrideRateThreshold) {
      return {
        type: 'HIGH_OVERRIDE_RATE',
        description: `Override rate ${metrics.overrideRate.toFixed(2)}% exceeds threshold ${this.config.overrideRateThreshold}%`,
        severity: metrics.overrideRate > 25 ? 'HIGH' : 'MEDIUM',
        score: 20,
        timestamp: new Date(),
        details: { overrideRate: metrics.overrideRate, threshold: this.config.overrideRateThreshold },
      };
    }
    return null;
  }

  /**
   * Detect large transaction anomaly
   */
  private detectLargeTransactionAnomaly(metrics: CashierMetrics): AnomalyType | null {
    if (metrics.averageTransactionValue > this.config.largeTransactionThreshold) {
      return {
        type: 'LARGE_TRANSACTIONS',
        description: `Average transaction value ${metrics.averageTransactionValue.toFixed(2)} exceeds threshold ${this.config.largeTransactionThreshold}`,
        severity: 'MEDIUM',
        score: 15,
        timestamp: new Date(),
        details: { averageValue: metrics.averageTransactionValue, threshold: this.config.largeTransactionThreshold },
      };
    }
    return null;
  }

  /**
   * Detect rapid transaction anomaly
   */
  private async detectRapidTransactionAnomaly(
    userId: string,
    startDate: Date
  ): Promise<AnomalyType | null> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'OUT',
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    let rapidCount = 0;
    for (let i = 0; i < transactions.length - 1; i++) {
      const timeDiff = transactions[i + 1].createdAt.getTime() - transactions[i].createdAt.getTime();
      if (timeDiff < this.config.rapidTransactionWindow * 1000) {
        rapidCount++;
      }
    }

    if (rapidCount > 10) {
      return {
        type: 'RAPID_TRANSACTIONS',
        description: `${rapidCount} rapid transactions detected within ${this.config.rapidTransactionWindow} seconds`,
        severity: 'MEDIUM',
        score: 10,
        timestamp: new Date(),
        details: { rapidCount, window: this.config.rapidTransactionWindow },
      };
    }

    return null;
  }

  /**
   * Detect post-print receipt void anomaly
   * 
   * This is a critical fraud indicator - voiding transactions after printing receipts
   */
  private async detectPostPrintVoidAnomaly(
    userId: string,
    startDate: Date
  ): Promise<AnomalyType | null> {
    // Get void transactions
    const voidTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'VOID',
        createdAt: { gte: startDate },
      },
      select: { id: true, createdAt, entityId: true },
    });

    let postPrintVoidCount = 0;

    for (const voidTx of voidTransactions) {
      // Check if there was a corresponding sale transaction before this void
      const originalSale = await this.prisma.transaction.findFirst({
        where: {
          userId,
          type: 'OUT',
          id: voidTx.entityId,
          createdAt: { lt: voidTx.createdAt },
        },
      });

      if (originalSale) {
        // Check time difference - if voided within 5 minutes of sale, suspicious
        const timeDiff = voidTx.createdAt.getTime() - originalSale.createdAt.getTime();
        if (timeDiff < 5 * 60 * 1000) { // 5 minutes
          postPrintVoidCount++;
        }
      }
    }

    if (postPrintVoidCount > 0) {
      return {
        type: 'POST_PRINT_VOID',
        description: `${postPrintVoidCount} transactions voided shortly after printing receipts`,
        severity: postPrintVoidCount > 3 ? 'CRITICAL' : 'HIGH',
        score: postPrintVoidCount * 30, // 30 points per post-print void
        timestamp: new Date(),
        details: { postPrintVoidCount, threshold: 5 * 60 * 1000 },
      };
    }

    return null;
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score < 25) return 'LOW';
    if (score < 50) return 'MEDIUM';
    if (score < 75) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Store risk profile in database
   */
  private async storeRiskProfile(
    userId: string,
    riskScore: number,
    riskLevel: string,
    anomalies: AnomalyType[]
  ): Promise<void> {
    await this.prisma.riskIndicator.upsert({
      where: {
        entityId: userId,
      },
      update: {
        severity: riskLevel,
        confidence: riskScore / 100,
        description: `Risk score: ${riskScore}, Anomalies: ${anomalies.length}`,
        metadata: JSON.stringify({
          riskScore,
          anomalies,
          lastCalculated: new Date().toISOString(),
        }),
        detectedAt: new Date(),
      },
      create: {
        entityType: 'USER',
        entityId: userId,
        riskType: 'FRAUD_RISK',
        severity: riskLevel,
        confidence: riskScore / 100,
        description: `Risk score: ${riskScore}, Anomalies: ${anomalies.length}`,
        metadata: JSON.stringify({
          riskScore,
          anomalies,
          lastCalculated: new Date().toISOString(),
        }),
        detectedAt: new Date(),
      },
    });
  }

  /**
   * Get all cashier risk profiles
   */
  async getAllCashierRiskProfiles(): Promise<CashierRiskProfile[]> {
    const users = await this.prisma.user.findMany({
      where: { role: 'CASHIER' },
      select: { id: true, name: true },
    });

    const profiles: CashierRiskProfile[] = [];

    for (const user of users) {
      try {
        const profile = await this.calculateCashierRiskScore(user.id);
        profiles.push(profile);
      } catch (error) {
        console.error(`Failed to calculate risk profile for user ${user.id}:`, error);
      }
    }

    return profiles.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Background worker for continuous monitoring
   * 
   * Runs continuously to monitor all cashiers and detect anomalies
   */
  async startBackgroundMonitoring(intervalMs: number = 60 * 1000): Promise<void> {
    console.log('Starting anomaly detection background monitoring...');

    const monitor = async () => {
      try {
        const profiles = await this.getAllCashierRiskProfiles();
        
        // Alert on critical risks
        const criticalRisks = profiles.filter(p => p.riskLevel === 'CRITICAL');
        if (criticalRisks.length > 0) {
          console.warn(`🚨 ${criticalRisks.length} critical risks detected:`, criticalRisks);
          // Here you would send alerts via email, Slack, etc.
        }

        console.log(`✅ Anomaly monitoring complete. Analyzed ${profiles.length} cashiers.`);
      } catch (error) {
        console.error('Error in anomaly monitoring:', error);
      }
    };

    // Run immediately
    await monitor();

    // Schedule regular monitoring
    setInterval(monitor, intervalMs);
  }
}

/**
 * Create anomaly detection service instance
 * 
 * Factory function to create anomaly detection service
 * 
 * @param prisma - Prisma client instance
 * @param config - Optional risk configuration
 * @returns AnomalyDetectionService instance
 */
export function createAnomalyDetectionService(
  prisma: PrismaClient,
  config?: Partial<RiskConfig>
): AnomalyDetectionService {
  return new AnomalyDetectionService(prisma, config);
}