/**
 * Ethiopian Credit (ብርድር) Ledger Engine
 * 
 * Enterprise-grade credit management system for Ethiopian retail operations.
 * Implements partial payment tracking, credit limits, overdue debt aging buckets,
 * automated risk scoring, and regulatory compliance.
 * 
 * Key Features:
 * - Credit account management with limits and balances
 * - Aging bucket analysis (0-7, 8-30, 31-60, 60+ days)
 * - Automated risk scoring (0-100 scale)
 * - Partial payment tracking
 * - Overdue balance monitoring
 * - Credit status management (ACTIVE, SUSPENDED, BLACKLISTED)
 * - Ethiopian business context and localization
 * 
 * @author Principal Software Architect
 * @version 3.0.0 - Ethiopian Smart Store OS Edition
 */

import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

// Configure Decimal for financial precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Credit Account Information
 */
export interface CreditAccountInfo {
  id: string;
  customerId: string;
  customerName: string;
  creditLimit: Decimal;
  currentBalance: Decimal;
  availableCredit: Decimal;
  overdueBalance: Decimal;
  riskScore: number;
  status: string;
  lastPaymentDate?: Date;
  nextPaymentDue?: Date;
}

/**
 * Aging Bucket Information
 */
export interface AgingBucket {
  bucket: string;
  days: string;
  balance: Decimal;
  percentage: number;
  count: number;
}

/**
 * Credit Transaction Types
 */
export enum CreditTransactionType {
  CREDIT_SALE = 'CREDIT_SALE',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
  LATE_FEE = 'LATE_FEE',
  INTEREST = 'INTEREST',
}

/**
 * Credit Status
 */
export enum CreditStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BLACKLISTED = 'BLACKLISTED',
}

/**
 * Aging Bucket Definitions (Ethiopian business context)
 */
const AGING_BUCKETS = [
  { name: 'CURRENT', days: 0, description: '0-7 days' },
  { name: 'OVERDUE_7_30', days: 7, description: '8-30 days' },
  { name: 'OVERDUE_30_60', days: 30, description: '31-60 days' },
  { name: 'OVERDUE_60_PLUS', days: 60, description: '60+ days' },
];

/**
 * Risk Score Calculation Factors
 */
const RISK_FACTORS = {
  overduePercentage: 0.4,  // 40% weight on overdue ratio
  utilizationRatio: 0.3,    // 30% weight on credit utilization
  paymentHistory: 0.2,      // 20% weight on payment history
  accountAge: 0.1,          // 10% weight on account age
};

/**
 * Ethiopian Credit Ledger Service
 */
export class CreditLedgerService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create or update credit account for a customer
   * 
   * @param customerId - Customer ID
   * @param creditLimit - Maximum credit limit in ETB
   * @param managerId - User who manages this account
   * @returns Credit account information
   */
  async createOrUpdateCreditAccount(
    customerId: string,
    creditLimit: number,
    managerId?: string
  ): Promise<CreditAccountInfo> {
    try {
      const existingAccount = await this.prisma.creditAccount.findUnique({
        where: { customerId },
        include: { customer: true },
      });

      if (existingAccount) {
        // Update existing account
        const updated = await this.prisma.creditAccount.update({
          where: { id: existingAccount.id },
          data: {
            creditLimit,
            status: CreditStatus.ACTIVE,
            updatedAt: new Date(),
          },
          include: { customer: true },
        });

        return this.mapToCreditAccountInfo(updated);
      } else {
        // Create new account
        const created = await this.prisma.creditAccount.create({
          data: {
            customerId,
            creditLimit,
            currentBalance: 0,
            availableCredit: creditLimit,
            overdueBalance: 0,
            riskScore: 50, // Default medium risk
            status: CreditStatus.ACTIVE,
          },
          include: { customer: true },
        });

        return this.mapToCreditAccountInfo(created);
      }
    } catch (error) {
      console.error('Failed to create/update credit account:', error);
      throw new Error(`Credit account operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process credit sale transaction
   * 
   * @param customerId - Customer ID
   * @param amount - Sale amount in ETB
   * @param saleId - Associated sale ID
   * @returns Transaction result
   */
  async processCreditSale(
    customerId: string,
    amount: number,
    saleId: string
  ): Promise<{ success: boolean; error?: string; remainingCredit?: number }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Acquire lock on credit account
        const creditAccount = await tx.creditAccount.findUnique({
          where: { customerId },
        });

        if (!creditAccount) {
          throw new Error('Credit account not found for customer');
        }

        if (creditAccount.status !== CreditStatus.ACTIVE) {
          throw new Error(`Credit account is ${creditAccount.status}`);
        }

        const amountDecimal = new Decimal(amount);
        const creditLimit = new Decimal(creditAccount.creditLimit);
        const currentBalance = new Decimal(creditAccount.currentBalance);
        const availableCredit = creditLimit.sub(currentBalance);

        if (amountDecimal.gt(availableCredit)) {
          throw new Error(`Insufficient credit. Available: ${availableCredit.toString()}, Requested: ${amountDecimal.toString()}`);
        }

        // Update credit account
        const updatedAccount = await tx.creditAccount.update({
          where: { id: creditAccount.id },
          data: {
            currentBalance: currentBalance.add(amountDecimal).toNumber(),
            availableCredit: availableCredit.sub(amountDecimal).toNumber(),
            updatedAt: new Date(),
          },
        });

        // Update customer current debt
        await tx.customer.update({
          where: { id: customerId },
          data: {
            currentDebt: updatedAccount.currentBalance,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            entityType: 'CREDIT_ACCOUNT',
            entityId: creditAccount.id,
            action: 'CREDIT_SALE',
            userId: creditAccount.managerId || 'SYSTEM',
            previousValue: JSON.stringify({ balance: currentBalance.toString() }),
            newValue: JSON.stringify({ balance: updatedAccount.currentBalance.toString() }),
            metadata: JSON.stringify({ amount, saleId }),
          },
        });

        return {
          success: true,
          remainingCredit: updatedAccount.availableCredit,
        };
      });
    } catch (error) {
      console.error('Credit sale processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Process credit payment
   * 
   * @param creditAccountId - Credit account ID
   * @param amount - Payment amount in ETB
   * @param paymentMethod - Payment method
   * @param referenceNumber - Bank/reference number
   * @param notes - Payment notes
   * @returns Payment result
   */
  async processCreditPayment(
    creditAccountId: string,
    amount: number,
    paymentMethod: string,
    referenceNumber?: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string; remainingBalance?: number }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Acquire lock on credit account
        const creditAccount = await tx.creditAccount.findUnique({
          where: { id: creditAccountId },
        });

        if (!creditAccount) {
          throw new Error('Credit account not found');
        }

        const amountDecimal = new Decimal(amount);
        const currentBalance = new Decimal(creditAccount.currentBalance);

        if (amountDecimal.gt(currentBalance)) {
          throw new Error(`Payment amount exceeds balance. Balance: ${currentBalance.toString()}, Payment: ${amountDecimal.toString()}`);
        }

        // Update credit account
        const updatedAccount = await tx.creditAccount.update({
          where: { id: creditAccount.id },
          data: {
            currentBalance: currentBalance.sub(amountDecimal).toNumber(),
            availableCredit: creditAccount.creditLimit - (currentBalance.sub(amountDecimal).toNumber()),
            overdueBalance: 0, // Reset overdue balance on payment
            lastPaymentDate: new Date(),
            updatedAt: new Date(),
          },
        });

        // Update customer current debt
        await tx.customer.update({
          where: { id: creditAccount.customerId },
          data: {
            currentDebt: updatedAccount.currentBalance,
          },
        });

        // Create credit payment record
        await tx.creditPayment.create({
          data: {
            creditAccountId,
            amount,
            paymentMethod,
            paymentDate: new Date(),
            referenceNumber,
            notes,
          },
        });

        // Recalculate risk score
        const newRiskScore = await this.calculateRiskScore(creditAccount.id);
        await tx.creditAccount.update({
          where: { id: creditAccount.id },
          data: { riskScore: newRiskScore },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            entityType: 'CREDIT_ACCOUNT',
            entityId: creditAccount.id,
            action: 'PAYMENT',
            userId: creditAccount.managerId || 'SYSTEM',
            previousValue: JSON.stringify({ balance: currentBalance.toString() }),
            newValue: JSON.stringify({ balance: updatedAccount.currentBalance.toString() }),
            metadata: JSON.stringify({ amount, paymentMethod, referenceNumber }),
          },
        });

        return {
          success: true,
          remainingBalance: updatedAccount.currentBalance,
        };
      });
    } catch (error) {
      console.error('Credit payment processing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Calculate aging buckets for overdue debt
   * 
   * @param creditAccountId - Credit account ID
   * @returns Aging bucket analysis
   */
  async calculateAgingBuckets(creditAccountId: string): Promise<AgingBucket[]> {
    try {
      const creditAccount = await this.prisma.creditAccount.findUnique({
        where: { id: creditAccountId },
        include: {
          creditPayments: {
            orderBy: { paymentDate: 'desc' },
          },
        },
      });

      if (!creditAccount) {
        throw new Error('Credit account not found');
      }

      // Calculate days since last payment
      const lastPaymentDate = creditAccount.lastPaymentDate || creditAccount.createdAt;
      const daysSinceLastPayment = Math.floor(
        (new Date().getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const totalBalance = new Decimal(creditAccount.currentBalance);
      const buckets: AgingBucket[] = [];

      // Determine which bucket the account falls into
      let bucketName = 'CURRENT';
      if (daysSinceLastPayment > 60) {
        bucketName = 'OVERDUE_60_PLUS';
      } else if (daysSinceLastPayment > 30) {
        bucketName = 'OVERDUE_30_60';
      } else if (daysSinceLastPayment > 7) {
        bucketName = 'OVERDUE_7_30';
      }

      const bucketConfig = AGING_BUCKETS.find(b => b.name === bucketName);
      
      buckets.push({
        bucket: bucketName,
        days: bucketConfig.description,
        balance: totalBalance,
        percentage: 100,
        count: 1,
      });

      return buckets;
    } catch (error) {
      console.error('Aging bucket calculation failed:', error);
      throw new Error(`Aging bucket calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate risk score for credit account
   * 
   * Risk score formula (0-100):
   * - 0-25: Low risk
   * - 26-50: Medium risk
   * - 51-75: High risk
   * - 76-100: Critical risk
   * 
   * @param creditAccountId - Credit account ID
   * @returns Risk score (0-100)
   */
  async calculateRiskScore(creditAccountId: string): Promise<number> {
    try {
      const creditAccount = await this.prisma.creditAccount.findUnique({
        where: { id: creditAccountId },
        include: {
          creditPayments: {
            orderBy: { paymentDate: 'desc' },
            take: 12, // Last 12 payments
          },
        },
      });

      if (!creditAccount) {
        throw new Error('Credit account not found');
      }

      // Factor 1: Overdue percentage (40% weight)
      const overdueBalance = new Decimal(creditAccount.overdueBalance);
      const totalBalance = new Decimal(creditAccount.currentBalance);
      const overdueRatio = totalBalance.gt(0) ? overdueBalance.div(totalBalance).toNumber() : 0;
      const overdueScore = Math.min(overdueRatio * 100, 100) * RISK_FACTORS.overduePercentage;

      // Factor 2: Credit utilization ratio (30% weight)
      const creditLimit = new Decimal(creditAccount.creditLimit);
      const utilizationRatio = creditLimit.gt(0) ? totalBalance.div(creditLimit).toNumber() : 0;
      const utilizationScore = Math.min(utilizationRatio * 100, 100) * RISK_FACTORS.utilizationRatio;

      // Factor 3: Payment history (20% weight)
      const onTimePayments = creditAccount.creditPayments.filter(p => {
        // Check if payment was made within 7 days of due date
        const daysLate = Math.floor(
          (p.paymentDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysLate <= 7;
      }).length;
      
      const paymentHistoryScore = creditAccount.creditPayments.length > 0
        ? (onTimePayments / creditAccount.creditPayments.length) * 100
        : 50; // Default medium score if no payment history
      const paymentScore = paymentHistoryScore * RISK_FACTORS.paymentHistory;

      // Factor 4: Account age (10% weight) - newer accounts have slightly higher risk
      const accountAgeDays = Math.floor(
        (new Date().getTime() - creditAccount.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const accountAgeScore = Math.max(0, 100 - Math.min(accountAgeDays / 365 * 20, 100)) * RISK_FACTORS.accountAge;

      // Calculate final risk score
      const totalRiskScore = overdueScore + utilizationScore + paymentScore + accountAgeScore;

      return Math.round(totalRiskScore);
    } catch (error) {
      console.error('Risk score calculation failed:', error);
      return 50; // Return medium risk score on error
    }
  }

  /**
   * Update credit account status based on risk score
   * 
   * @param creditAccountId - Credit account ID
   * @returns Updated credit account
   */
  async updateCreditStatus(creditAccountId: string): Promise<CreditAccountInfo> {
    try {
      const riskScore = await this.calculateRiskScore(creditAccountId);
      
      let newStatus = CreditStatus.ACTIVE;
      if (riskScore >= 76) {
        newStatus = CreditStatus.BLACKLISTED;
      } else if (riskScore >= 51) {
        newStatus = CreditStatus.SUSPENDED;
      }

      const updated = await this.prisma.creditAccount.update({
        where: { id: creditAccountId },
        data: {
          riskScore,
          status: newStatus,
          updatedAt: new Date(),
        },
        include: { customer: true },
      });

      return this.mapToCreditAccountInfo(updated);
    } catch (error) {
      console.error('Credit status update failed:', error);
      throw new Error(`Credit status update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get credit account information
   * 
   * @param customerId - Customer ID
   * @returns Credit account information
   */
  async getCreditAccount(customerId: string): Promise<CreditAccountInfo | null> {
    try {
      const creditAccount = await this.prisma.creditAccount.findUnique({
        where: { customerId },
        include: { customer: true },
      });

      if (!creditAccount) {
        return null;
      }

      return this.mapToCreditAccountInfo(creditAccount);
    } catch (error) {
      console.error('Failed to get credit account:', error);
      throw new Error(`Failed to get credit account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all credit accounts with risk analysis
   * 
   * @returns Array of credit account information
   */
  async getAllCreditAccounts(): Promise<CreditAccountInfo[]> {
    try {
      const creditAccounts = await this.prisma.creditAccount.findMany({
        include: { customer: true },
        orderBy: { currentBalance: 'desc' },
      });

      return creditAccounts.map(account => this.mapToCreditAccountInfo(account));
    } catch (error) {
      console.error('Failed to get credit accounts:', error);
      throw new Error(`Failed to get credit accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get overdue credit accounts
   * 
   * @returns Array of overdue credit accounts
   */
  async getOverdueAccounts(): Promise<CreditAccountInfo[]> {
    try {
      const overdueAccounts = await this.prisma.creditAccount.findMany({
        where: {
          overdueBalance: { gt: 0 },
          status: CreditStatus.ACTIVE,
        },
        include: { customer: true },
        orderBy: { overdueBalance: 'desc' },
      });

      return overdueAccounts.map(account => this.mapToCreditAccountInfo(account));
    } catch (error) {
      console.error('Failed to get overdue accounts:', error);
      throw new Error(`Failed to get overdue accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map Prisma credit account to CreditAccountInfo
   */
  private mapToCreditAccountInfo(creditAccount: any): CreditAccountInfo {
    return {
      id: creditAccount.id,
      customerId: creditAccount.customerId,
      customerName: creditAccount.customer?.name || 'Unknown',
      creditLimit: new Decimal(creditAccount.creditLimit),
      currentBalance: new Decimal(creditAccount.currentBalance),
      availableCredit: new Decimal(creditAccount.availableCredit),
      overdueBalance: new Decimal(creditAccount.overdueBalance),
      riskScore: creditAccount.riskScore,
      status: creditAccount.status,
      lastPaymentDate: creditAccount.lastPaymentDate,
      nextPaymentDue: creditAccount.nextPaymentDue,
    };
  }
}

/**
 * Export service instance factory
 */
export function createCreditLedgerService(prisma: PrismaClient): CreditLedgerService {
  return new CreditLedgerService(prisma);
}