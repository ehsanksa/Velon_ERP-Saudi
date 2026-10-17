-- Qiwa Contract Management register: establishment file, contracts, and authentication history.

DO $$ BEGIN CREATE TYPE "QiwaEstablishmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QiwaNitaqatBand" AS ENUM ('PLATINUM', 'HIGH_GREEN', 'MID_GREEN', 'LOW_GREEN', 'YELLOW', 'RED', 'UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QiwaIdentityType" AS ENUM ('NATIONAL_ID', 'IQAMA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QiwaContractType" AS ENUM ('FIXED_TERM', 'INDEFINITE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QiwaWageBasis" AS ENUM ('MONTHLY', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QiwaContractStatus" AS ENUM ('DRAFT', 'READY', 'PENDING_EMPLOYEE', 'AMENDMENT_REQUESTED', 'REJECTED', 'DOCUMENTED', 'ENFORCEABLE', 'UPDATE_PENDING', 'TERMINATED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "QiwaContractEventType" AS ENUM ('CREATED', 'UPDATED', 'VALIDATED', 'SENT_TO_EMPLOYEE', 'EMPLOYEE_APPROVED', 'EMPLOYEE_REJECTED', 'AMENDMENT_REQUESTED', 'DOCUMENTED', 'EXECUTION_RECORDED', 'UPDATE_SUBMITTED', 'TERMINATED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "HrEmployee" ADD COLUMN IF NOT EXISTS "identityType" "QiwaIdentityType";
ALTER TABLE "HrEmployee" ADD COLUMN IF NOT EXISTS "nationalId" TEXT;
ALTER TABLE "HrEmployee" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
CREATE INDEX IF NOT EXISTS "HrEmployee_tenantId_nationalId_idx" ON "HrEmployee"("tenantId", "nationalId");

CREATE TABLE IF NOT EXISTS "HrQiwaEstablishment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameEn" TEXT NOT NULL,
    "laborOfficeId" TEXT,
    "sequenceNumber" TEXT,
    "commercialRegistrationNumber" TEXT,
    "unifiedNumber" TEXT,
    "economicActivity" TEXT,
    "status" "QiwaEstablishmentStatus" NOT NULL DEFAULT 'DRAFT',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "nitaqatBand" "QiwaNitaqatBand" NOT NULL DEFAULT 'UNKNOWN',
    "saudiCount" INTEGER,
    "nonSaudiCount" INTEGER,
    "saudizationPercent" DECIMAL(5,2),
    "nitaqatRecordedAt" TIMESTAMP(3),
    "saudizationCertificateExpiresAt" DATE,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HrQiwaEstablishment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HrQiwaEstablishment_tenantId_idx" ON "HrQiwaEstablishment"("tenantId");
CREATE INDEX IF NOT EXISTS "HrQiwaEstablishment_tenantId_isPrimary_idx" ON "HrQiwaEstablishment"("tenantId", "isPrimary");

CREATE TABLE IF NOT EXISTS "HrQiwaContract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "qiwaContractNumber" TEXT,
    "status" "QiwaContractStatus" NOT NULL DEFAULT 'DRAFT',
    "contractType" "QiwaContractType" NOT NULL,
    "identityType" "QiwaIdentityType" NOT NULL,
    "nationalId" TEXT NOT NULL,
    "employeeNameEn" TEXT NOT NULL,
    "employeeNameAr" TEXT,
    "nationality" TEXT NOT NULL,
    "occupationTitle" TEXT NOT NULL,
    "jobTitle" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "probationDays" INTEGER NOT NULL DEFAULT 90,
    "dailyHours" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "weeklyHours" DECIMAL(4,2) NOT NULL DEFAULT 48,
    "workLocation" TEXT,
    "wageBasis" "QiwaWageBasis" NOT NULL DEFAULT 'MONTHLY',
    "basicWage" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "housingAllowance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transportAllowance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherAllowances" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalWage" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "noticePeriodDays" INTEGER NOT NULL DEFAULT 60,
    "additionalTerms" TEXT,
    "gosiRegistered" BOOLEAN NOT NULL DEFAULT false,
    "listedOnQiwa" BOOLEAN NOT NULL DEFAULT false,
    "amendmentNote" TEXT,
    "executionNumber" TEXT,
    "terminationReason" TEXT,
    "sentToEmployeeAt" TIMESTAMP(3),
    "documentedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HrQiwaContract_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HrQiwaContract_tenantId_referenceCode_key" ON "HrQiwaContract"("tenantId", "referenceCode");
CREATE INDEX IF NOT EXISTS "HrQiwaContract_tenantId_idx" ON "HrQiwaContract"("tenantId");
CREATE INDEX IF NOT EXISTS "HrQiwaContract_tenantId_employeeId_idx" ON "HrQiwaContract"("tenantId", "employeeId");
CREATE INDEX IF NOT EXISTS "HrQiwaContract_tenantId_status_idx" ON "HrQiwaContract"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "HrQiwaContract_tenantId_establishmentId_idx" ON "HrQiwaContract"("tenantId", "establishmentId");

CREATE TABLE IF NOT EXISTS "HrQiwaContractEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "QiwaContractEventType" NOT NULL,
    "fromStatus" "QiwaContractStatus",
    "toStatus" "QiwaContractStatus",
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HrQiwaContractEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HrQiwaContractEvent_tenantId_idx" ON "HrQiwaContractEvent"("tenantId");
CREATE INDEX IF NOT EXISTS "HrQiwaContractEvent_tenantId_contractId_idx" ON "HrQiwaContractEvent"("tenantId", "contractId");

DO $$ BEGIN ALTER TABLE "HrQiwaEstablishment" ADD CONSTRAINT "HrQiwaEstablishment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HrQiwaEstablishment" ADD CONSTRAINT "HrQiwaEstablishment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HrQiwaEstablishment" ADD CONSTRAINT "HrQiwaEstablishment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HrQiwaContract" ADD CONSTRAINT "HrQiwaContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HrQiwaContract" ADD CONSTRAINT "HrQiwaContract_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "HrQiwaEstablishment"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HrQiwaContract" ADD CONSTRAINT "HrQiwaContract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "HrEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HrQiwaContract" ADD CONSTRAINT "HrQiwaContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HrQiwaContract" ADD CONSTRAINT "HrQiwaContract_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HrQiwaContractEvent" ADD CONSTRAINT "HrQiwaContractEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HrQiwaContractEvent" ADD CONSTRAINT "HrQiwaContractEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "HrQiwaContract"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HrQiwaContractEvent" ADD CONSTRAINT "HrQiwaContractEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
