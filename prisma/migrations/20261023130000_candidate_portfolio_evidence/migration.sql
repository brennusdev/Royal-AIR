-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('self_reported', 'pending', 'reviewed', 'contested', 'revoked');

-- CreateTable
CREATE TABLE "portfolio_evidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'self_reported',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_evidence_userId_createdAt_idx" ON "portfolio_evidence"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "portfolio_evidence"
ADD CONSTRAINT "portfolio_evidence_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
