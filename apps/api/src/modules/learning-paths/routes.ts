import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  learningPathSchema,
  learningPlanSchema,
  type LearningPath,
  type LearningPlan,
  type LearningStepStatus
} from "@platform/shared";
import {
  getAuthenticatedSession,
  requireSameOrigin,
  type AuthStore
} from "../auth/routes.js";

const selectPathSchema = z.object({ pathId: z.string().min(1).max(80) }).strict();
const updateStepSchema = z.object({
  status: z.enum(["in_progress", "studied"])
}).strict();
const stageIdSchema = z.object({ stageId: z.string().min(1).max(80) }).strict();

export interface LearningPathCatalogStage {
  id: string;
  position: number;
  competency: {
    slug: string;
    title: string;
    description: string;
  };
  whyThisStep: string;
  practiceTask: string;
  estimatedMinutes: number;
  resourceTitle: string | null;
  resourceUrl: string | null;
}

export interface LearningPathCatalogItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  targetRole: string;
  outcome: string;
  estimatedMinutes: number;
  stages: LearningPathCatalogStage[];
}

export interface LearningPlanRecord {
  id: string;
  status: "active" | "paused" | "completed";
  steps: Array<{
    id: string;
    learningPathCompetencyId: string;
    status: LearningStepStatus;
  }>;
  path: LearningPathCatalogItem;
}

export interface LearningPathStore {
  listPublishedPaths(): Promise<LearningPathCatalogItem[]>;
  getActivePlan(userId: string): Promise<LearningPlanRecord | null>;
  selectPath(userId: string, pathId: string): Promise<LearningPlanRecord | null>;
  updateActiveStep(
    userId: string,
    stageId: string,
    status: LearningStepStatus
  ): Promise<LearningPlanRecord | null>;
}

export interface LearningPathRouteOptions {
  authStore: AuthStore;
  pathStore: LearningPathStore;
  webOrigin: string;
}

function toLearningPath(
  record: LearningPathCatalogItem,
  statuses?: Map<string, LearningStepStatus>
): LearningPath {
  return learningPathSchema.parse({
    ...record,
    stages: record.stages.map((stage) => ({
      ...stage,
      status: statuses?.get(stage.id) ?? "not_started"
    }))
  });
}

export function buildLearningPlan(record: LearningPlanRecord): LearningPlan {
  const statuses = new Map(
    record.steps.map((step) => [step.learningPathCompetencyId, step.status])
  );
  const path = toLearningPath(record.path, statuses);
  const completedStages = path.stages.filter((stage) => stage.status === "studied").length;
  const totalStages = path.stages.length;
  const nextStage = path.stages.find((stage) => stage.status !== "studied");
  const progressPercent = totalStages === 0
    ? 0
    : Math.floor((completedStages / totalStages) * 100);
  const recommendationReason = nextStage
    ? nextStage.status === "in_progress"
      ? `Você já começou ${nextStage.competency.title}. Conclua esta etapa antes de avançar, pois ela prepara a próxima competência da trilha.`
      : nextStage.position === 1
        ? `Esta é a primeira etapa do objetivo “${path.targetRole}” e estabelece a base para as atividades seguintes.`
        : `Esta etapa vem agora porque as anteriores foram marcadas como estudadas e ela é o próximo pré-requisito do objetivo “${path.targetRole}”.`
    : `Você marcou todas as ${totalStages} etapas como estudadas. Isso mede conclusão de estudo nesta trilha, não uma avaliação independente de competência nem garantia de resultado profissional.`;

  return learningPlanSchema.parse({
    id: record.id,
    status: completedStages === totalStages && totalStages > 0
      ? "completed"
      : record.status,
    progressPercent,
    completedStages,
    totalStages,
    nextStageId: nextStage?.id ?? null,
    recommendationReason,
    path
  });
}

async function getCandidate(
  request: FastifyRequest,
  authStore: AuthStore
): Promise<
  | { error: null; userId: string }
  | { error: "Authentication required." | "Candidate role required."; userId: null }
> {
  const session = await getAuthenticatedSession(request, authStore);
  if (!session) {
    return { error: "Authentication required." as const, userId: null };
  }
  if (!session.user.roles.includes("candidate")) {
    return { error: "Candidate role required." as const, userId: null };
  }
  return { error: null, userId: session.user.id };
}

export async function registerLearningPathRoutes(
  app: FastifyInstance,
  options: LearningPathRouteOptions
): Promise<void> {
  const sameOrigin = requireSameOrigin(options.webOrigin);

  app.get("/api/v1/learning-paths", async () => {
    const paths = await options.pathStore.listPublishedPaths();
    return { paths: paths.map((path) => toLearningPath(path)) };
  });

  app.get("/api/v1/my-learning-plan", async (request, reply) => {
    const candidate = await getCandidate(request, options.authStore);
    if (candidate.error) {
      return reply.code(candidate.error === "Authentication required." ? 401 : 403)
        .send({ error: candidate.error });
    }

    const record = await options.pathStore.getActivePlan(candidate.userId);
    return { plan: record ? buildLearningPlan(record) : null };
  });

  app.post("/api/v1/my-learning-plan", { preHandler: sameOrigin }, async (request, reply) => {
    const candidate = await getCandidate(request, options.authStore);
    if (candidate.error) {
      return reply.code(candidate.error === "Authentication required." ? 401 : 403)
        .send({ error: candidate.error });
    }
    const { pathId } = selectPathSchema.parse(request.body);
    const record = await options.pathStore.selectPath(candidate.userId, pathId);
    if (!record) {
      return reply.code(404).send({ error: "Learning path not found." });
    }
    return { plan: buildLearningPlan(record) };
  });

  app.patch(
    "/api/v1/my-learning-plan/stages/:stageId",
    { preHandler: sameOrigin },
    async (request, reply) => {
      const candidate = await getCandidate(request, options.authStore);
      if (candidate.error) {
        return reply.code(candidate.error === "Authentication required." ? 401 : 403)
          .send({ error: candidate.error });
      }
      const { stageId } = stageIdSchema.parse(request.params);
      const { status } = updateStepSchema.parse(request.body);
      const currentPlan = await options.pathStore.getActivePlan(candidate.userId);
      if (!currentPlan) {
        return reply.code(404).send({ error: "Active learning plan not found." });
      }
      if (buildLearningPlan(currentPlan).nextStageId !== stageId) {
        return reply.code(409).send({
          error: "Complete the recommended stage before moving to a later step."
        });
      }
      const record = await options.pathStore.updateActiveStep(
        candidate.userId,
        stageId,
        status
      );
      if (!record) {
        return reply.code(404).send({ error: "Active plan stage not found." });
      }
      return { plan: buildLearningPlan(record) };
    }
  );
}
