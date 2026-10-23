-- CreateEnum
CREATE TYPE "LearningPlanStatus" AS ENUM ('active', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "LearningStepStatus" AS ENUM ('not_started', 'in_progress', 'studied');

-- AlterTable
ALTER TABLE "learning_paths"
ADD COLUMN "targetRole" TEXT NOT NULL DEFAULT 'Desenvolvimento backend júnior',
ADD COLUMN "outcome" TEXT NOT NULL DEFAULT 'Concluir atividades de estudo e prática com progresso explicado.';

ALTER TABLE "learning_paths"
ALTER COLUMN "targetRole" DROP DEFAULT,
ALTER COLUMN "outcome" DROP DEFAULT;

-- AlterTable
ALTER TABLE "learning_path_competencies"
ADD COLUMN "whyThisStep" TEXT NOT NULL DEFAULT 'Esta competência faz parte da sequência da trilha.',
ADD COLUMN "practiceTask" TEXT NOT NULL DEFAULT 'Faça uma atividade prática e registre o que aprendeu.',
ADD COLUMN "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN "resourceTitle" TEXT,
ADD COLUMN "resourceUrl" TEXT;

ALTER TABLE "learning_path_competencies"
ALTER COLUMN "whyThisStep" DROP DEFAULT,
ALTER COLUMN "practiceTask" DROP DEFAULT,
ALTER COLUMN "estimatedMinutes" DROP DEFAULT;

-- CreateTable
CREATE TABLE "candidate_learning_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "learningPathId" TEXT NOT NULL,
    "status" "LearningPlanStatus" NOT NULL DEFAULT 'active',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_learning_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_learning_steps" (
    "id" TEXT NOT NULL,
    "learningPlanId" TEXT NOT NULL,
    "learningPathCompetencyId" TEXT NOT NULL,
    "status" "LearningStepStatus" NOT NULL DEFAULT 'not_started',
    "startedAt" TIMESTAMP(3),
    "studiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_learning_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_learning_plans_userId_learningPathId_key"
ON "candidate_learning_plans"("userId", "learningPathId");

-- CreateIndex
CREATE INDEX "candidate_learning_plans_userId_isActive_status_idx"
ON "candidate_learning_plans"("userId", "isActive", "status");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_learning_steps_learningPlanId_learningPathCompete_key"
ON "candidate_learning_steps"("learningPlanId", "learningPathCompetencyId");

-- CreateIndex
CREATE INDEX "candidate_learning_steps_learningPlanId_status_idx"
ON "candidate_learning_steps"("learningPlanId", "status");

-- AddForeignKey
ALTER TABLE "candidate_learning_plans"
ADD CONSTRAINT "candidate_learning_plans_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_learning_plans"
ADD CONSTRAINT "candidate_learning_plans_learningPathId_fkey"
FOREIGN KEY ("learningPathId") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_learning_steps"
ADD CONSTRAINT "candidate_learning_steps_learningPlanId_fkey"
FOREIGN KEY ("learningPlanId") REFERENCES "candidate_learning_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_learning_steps"
ADD CONSTRAINT "candidate_learning_steps_learningPathCompetencyId_fkey"
FOREIGN KEY ("learningPathCompetencyId") REFERENCES "learning_path_competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
