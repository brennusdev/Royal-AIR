-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ChallengeAttemptStatus" AS ENUM ('in_progress', 'submitted');

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'draft',
    "acceptanceCriteria" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rubricCriteria" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "challengeVersion" INTEGER NOT NULL,
    "acceptanceCriteria" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rubricCriteria" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "ChallengeAttemptStatus" NOT NULL DEFAULT 'in_progress',
    "approach" TEXT,
    "submissionUrl" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "challenges_slug_key" ON "challenges"("slug");

-- CreateIndex
CREATE INDEX "challenges_status_title_idx" ON "challenges"("status", "title");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_attempts_userId_challengeId_key" ON "challenge_attempts"("userId", "challengeId");

-- CreateIndex
CREATE INDEX "challenge_attempts_userId_status_updatedAt_idx" ON "challenge_attempts"("userId", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "challenge_attempts"
ADD CONSTRAINT "challenge_attempts_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_attempts"
ADD CONSTRAINT "challenge_attempts_challengeId_fkey"
FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
