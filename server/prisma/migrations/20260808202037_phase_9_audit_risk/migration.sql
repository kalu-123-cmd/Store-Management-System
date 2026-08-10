-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "changes" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "entityId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "entityType" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "newValue" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "oldValue" TEXT;

-- CreateTable
CREATE TABLE "RiskIndicator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "riskType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "description" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "confidence" REAL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "RiskIndicator_entityType_entityId_status_idx" ON "RiskIndicator"("entityType", "entityId", "status");

-- CreateIndex
CREATE INDEX "RiskIndicator_riskType_status_severity_idx" ON "RiskIndicator"("riskType", "status", "severity");

-- CreateIndex
CREATE INDEX "RiskIndicator_detectedAt_idx" ON "RiskIndicator"("detectedAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_createdAt_idx" ON "ActivityLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_action_createdAt_idx" ON "ActivityLog"("action", "createdAt");
