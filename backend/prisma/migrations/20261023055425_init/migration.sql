-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SECURITY_ANALYST', 'API_CONSUMER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('SQLI_PROTECTION', 'XSS_PROTECTION', 'RATE_LIMITING', 'HMAC_INTEGRITY', 'PAYLOAD_VALIDATION', 'PATH_TRAVERSAL');

-- CreateEnum
CREATE TYPE "SeverityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PolicyAction" AS ENUM ('LOG_ONLY', 'THROTTLE', 'BLOCK', 'QUARANTINE_IP');

-- CreateEnum
CREATE TYPE "ThreatType" AS ENUM ('SQL_INJECTION', 'XSS', 'PATH_TRAVERSAL', 'RATE_LIMIT_EXCEEDED', 'HMAC_VERIFICATION_FAILED', 'MALFORMED_PAYLOAD', 'UNAUTHORIZED_ACCESS');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('DETECTED', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('IP_BLOCK', 'IP_THROTTLE', 'KEY_REVOCATION', 'NOTIFICATION_SENT', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'APPLIED', 'EXPIRED', 'REVOKED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SECURITY_ANALYST',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiEndpoint" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL DEFAULT 'GET',
    "description" TEXT,
    "requireHmac" BOOLEAN NOT NULL DEFAULT false,
    "requireAuth" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitWindowSec" INTEGER NOT NULL DEFAULT 60,
    "rateLimitMaxRequests" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityPolicy" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "policyType" "PolicyType" NOT NULL,
    "severity" "SeverityLevel" NOT NULL DEFAULT 'MEDIUM',
    "ruleConfig" JSONB NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "action" "PolicyAction" NOT NULL DEFAULT 'BLOCK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRequestLog" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT,
    "endpointId" TEXT,
    "requestId" TEXT NOT NULL,
    "clientIp" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "requestSize" INTEGER,
    "responseSize" INTEGER,
    "hasAuthHeader" BOOLEAN NOT NULL DEFAULT false,
    "authKeyPrefix" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "requestLogId" TEXT,
    "serviceId" TEXT,
    "endpointId" TEXT,
    "policyId" TEXT,
    "incidentId" TEXT,
    "threatType" "ThreatType" NOT NULL,
    "severity" "SeverityLevel" NOT NULL DEFAULT 'MEDIUM',
    "details" JSONB NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "clientIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "SeverityLevel" NOT NULL DEFAULT 'MEDIUM',
    "status" "IncidentStatus" NOT NULL DEFAULT 'DETECTED',
    "sourceIp" TEXT,
    "assignedToUserId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseAction" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT,
    "actionType" "ActionType" NOT NULL,
    "target" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,

    CONSTRAINT "ResponseAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrityRecord" (
    "id" TEXT NOT NULL,
    "requestLogId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'HMAC-SHA256',
    "keyId" TEXT NOT NULL,
    "signatureProvided" TEXT NOT NULL,
    "signatureCalculated" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "requestTimestamp" TIMESTAMP(3) NOT NULL,
    "timeDriftMs" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "clientIp" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_tokenHash_idx" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiService_name_key" ON "ApiService"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ApiService_slug_key" ON "ApiService"("slug");

-- CreateIndex
CREATE INDEX "ApiService_slug_idx" ON "ApiService"("slug");

-- CreateIndex
CREATE INDEX "ApiService_isActive_idx" ON "ApiService"("isActive");

-- CreateIndex
CREATE INDEX "ApiEndpoint_serviceId_idx" ON "ApiEndpoint"("serviceId");

-- CreateIndex
CREATE INDEX "ApiEndpoint_path_idx" ON "ApiEndpoint"("path");

-- CreateIndex
CREATE UNIQUE INDEX "ApiEndpoint_serviceId_method_path_key" ON "ApiEndpoint"("serviceId", "method", "path");

-- CreateIndex
CREATE INDEX "SecurityPolicy_serviceId_idx" ON "SecurityPolicy"("serviceId");

-- CreateIndex
CREATE INDEX "SecurityPolicy_policyType_idx" ON "SecurityPolicy"("policyType");

-- CreateIndex
CREATE INDEX "SecurityPolicy_isEnabled_idx" ON "SecurityPolicy"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ApiRequestLog_requestId_key" ON "ApiRequestLog"("requestId");

-- CreateIndex
CREATE INDEX "ApiRequestLog_clientIp_idx" ON "ApiRequestLog"("clientIp");

-- CreateIndex
CREATE INDEX "ApiRequestLog_timestamp_idx" ON "ApiRequestLog"("timestamp");

-- CreateIndex
CREATE INDEX "ApiRequestLog_statusCode_idx" ON "ApiRequestLog"("statusCode");

-- CreateIndex
CREATE INDEX "ApiRequestLog_serviceId_idx" ON "ApiRequestLog"("serviceId");

-- CreateIndex
CREATE INDEX "SecurityEvent_threatType_idx" ON "SecurityEvent"("threatType");

-- CreateIndex
CREATE INDEX "SecurityEvent_severity_idx" ON "SecurityEvent"("severity");

-- CreateIndex
CREATE INDEX "SecurityEvent_clientIp_idx" ON "SecurityEvent"("clientIp");

-- CreateIndex
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_incidentId_idx" ON "SecurityEvent"("incidentId");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Incident_severity_idx" ON "Incident"("severity");

-- CreateIndex
CREATE INDEX "Incident_sourceIp_idx" ON "Incident"("sourceIp");

-- CreateIndex
CREATE INDEX "Incident_detectedAt_idx" ON "Incident"("detectedAt");

-- CreateIndex
CREATE INDEX "ResponseAction_actionType_idx" ON "ResponseAction"("actionType");

-- CreateIndex
CREATE INDEX "ResponseAction_target_idx" ON "ResponseAction"("target");

-- CreateIndex
CREATE INDEX "ResponseAction_status_idx" ON "ResponseAction"("status");

-- CreateIndex
CREATE INDEX "ResponseAction_expiresAt_idx" ON "ResponseAction"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrityRecord_requestLogId_key" ON "IntegrityRecord"("requestLogId");

-- CreateIndex
CREATE INDEX "IntegrityRecord_keyId_idx" ON "IntegrityRecord"("keyId");

-- CreateIndex
CREATE INDEX "IntegrityRecord_isValid_idx" ON "IntegrityRecord"("isValid");

-- CreateIndex
CREATE INDEX "IntegrityRecord_verifiedAt_idx" ON "IntegrityRecord"("verifiedAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiEndpoint" ADD CONSTRAINT "ApiEndpoint_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ApiService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityPolicy" ADD CONSTRAINT "SecurityPolicy_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ApiService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ApiService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiRequestLog" ADD CONSTRAINT "ApiRequestLog_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ApiEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_requestLogId_fkey" FOREIGN KEY ("requestLogId") REFERENCES "ApiRequestLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ApiService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "ApiEndpoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "SecurityPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ApiService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseAction" ADD CONSTRAINT "ResponseAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrityRecord" ADD CONSTRAINT "IntegrityRecord_requestLogId_fkey" FOREIGN KEY ("requestLogId") REFERENCES "ApiRequestLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
