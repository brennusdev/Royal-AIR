import type { PrismaClient } from "./generated/prisma/client.js";
import type {
  LearningPathCatalogItem,
  LearningPlanRecord,
  LearningPathStore
} from "./learning-paths.js";
import type { LearningStepStatus } from "@platform/shared";

const pathInclude = {
  competencies: {
    orderBy: { position: "asc" as const },
    include: {
      competencyVersion: {
        include: {
          competency: {
            select: { slug: true, title: true, description: true }
          }
        }
      }
    }
  }
} as const;

function toCatalogPath(path: {
  id: string;
  slug: string;
  title: string;
  description: string;
  targetRole: string;
  outcome: string;
  competencies: Array<{
    id: string;
    position: number;
    whyThisStep: string;
    practiceTask: string;
    estimatedMinutes: number;
    resourceTitle: string | null;
    resourceUrl: string | null;
    competencyVersion: {
      competency: { slug: string; title: string; description: string };
    };
  }>;
}): LearningPathCatalogItem {
  return {
    id: path.id,
    slug: path.slug,
    title: path.title,
    description: path.description,
    targetRole: path.targetRole,
    outcome: path.outcome,
    estimatedMinutes: path.competencies.reduce((total, stage) => total + stage.estimatedMinutes, 0),
    stages: path.competencies.map((stage) => ({
      id: stage.id,
      position: stage.position,
      competency: stage.competencyVersion.competency,
      whyThisStep: stage.whyThisStep,
      practiceTask: stage.practiceTask,
      estimatedMinutes: stage.estimatedMinutes,
      resourceTitle: stage.resourceTitle,
      resourceUrl: stage.resourceUrl
    }))
  };
}

function toPlanRecord(plan: {
  id: string;
  status: "active" | "paused" | "completed";
  learningPath: Parameters<typeof toCatalogPath>[0];
  steps: Array<{
    id: string;
    learningPathCompetencyId: string;
    status: LearningStepStatus;
  }>;
}): LearningPlanRecord {
  return {
    id: plan.id,
    status: plan.status,
    path: toCatalogPath(plan.learningPath),
    steps: plan.steps
  };
}

export function createPrismaLearningPathStore(prisma: PrismaClient): LearningPathStore {
  async function findActivePlan(userId: string): Promise<LearningPlanRecord | null> {
    const plan = await prisma.candidateLearningPlan.findFirst({
      where: { userId, isActive: true },
      include: {
        learningPath: { include: pathInclude },
        steps: { orderBy: { learningPathCompetency: { position: "asc" } } }
      }
    });
    return plan ? toPlanRecord(plan) : null;
  }

  return {
    async listPublishedPaths() {
      const paths = await prisma.learningPath.findMany({
        where: { status: "published" },
        include: pathInclude,
        orderBy: { title: "asc" }
      });
      return paths.map(toCatalogPath);
    },

    getActivePlan: findActivePlan,

    async selectPath(userId, pathId) {
      const path = await prisma.learningPath.findFirst({
        where: { id: pathId, status: "published" },
        include: pathInclude
      });
      if (!path) {
        return null;
      }

      await prisma.$transaction(async (transaction) => {
        // Serialize switches for the same candidate to preserve one active plan.
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
        await transaction.candidateLearningPlan.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false, status: "paused" }
        });

        await transaction.candidateLearningPlan.upsert({
          where: { userId_learningPathId: { userId, learningPathId: pathId } },
          create: {
            userId,
            learningPathId: pathId,
            status: "active",
            isActive: true,
            steps: {
              create: path.competencies.map(({ id }) => ({
                learningPathCompetencyId: id
              }))
            }
          },
          update: { status: "active", isActive: true }
        });
      });

      return findActivePlan(userId);
    },

    async updateActiveStep(userId, stageId, status) {
      const plan = await prisma.candidateLearningPlan.findFirst({
        where: { userId, isActive: true },
        include: { steps: true }
      });
      if (!plan) {
        return null;
      }

      const pathStage = await prisma.learningPathCompetency.findFirst({
        where: { id: stageId, learningPathId: plan.learningPathId },
        select: { id: true }
      });
      if (!pathStage) {
        return null;
      }

      const previous = plan.steps.find((step) => step.learningPathCompetencyId === stageId);
      const now = new Date();
      const stepData = {
        status,
        startedAt: status === "not_started" ? null : previous?.startedAt ?? now,
        studiedAt: status === "studied" ? now : null
      };

      await prisma.$transaction(async (transaction) => {
        await transaction.candidateLearningStep.upsert({
          where: {
            learningPlanId_learningPathCompetencyId: {
              learningPlanId: plan.id,
              learningPathCompetencyId: stageId
            }
          },
          create: {
            learningPlanId: plan.id,
            learningPathCompetencyId: stageId,
            ...stepData
          },
          update: stepData
        });

        const [total, studied] = await Promise.all([
          transaction.candidateLearningStep.count({ where: { learningPlanId: plan.id } }),
          transaction.candidateLearningStep.count({
            where: { learningPlanId: plan.id, status: "studied" }
          })
        ]);
        const completed = total > 0 && total === studied;
        await transaction.candidateLearningPlan.update({
          where: { id: plan.id },
          data: {
            status: completed ? "completed" : "active",
            completedAt: completed ? now : null
          }
        });
      });

      return findActivePlan(userId);
    }
  };
}
