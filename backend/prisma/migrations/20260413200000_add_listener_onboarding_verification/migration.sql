CREATE TYPE "ListenerVerificationStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED');

ALTER TABLE "ListenerProfile"
ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "verificationStatus" "ListenerVerificationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "verificationNote" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedBy" TEXT,
ADD COLUMN "onboardingData" JSONB,
ADD COLUMN "profileImageRef" TEXT,
ADD COLUMN "governmentIdType" TEXT,
ADD COLUMN "governmentIdImageRef" TEXT;

UPDATE "ListenerProfile"
SET "verificationStatus" = 'APPROVED',
    "onboardingCompleted" = true
WHERE "verificationStatus" = 'DRAFT';

CREATE INDEX "ListenerProfile_verificationStatus_submittedAt_idx"
ON "ListenerProfile"("verificationStatus", "submittedAt");
