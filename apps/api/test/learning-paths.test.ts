import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AuthStore, AccountRecord, AuthenticatedSession } from "../src/modules/auth/routes.js";
import { tokenHash } from "../src/modules/auth/routes.js";
import {
  buildLearningPlan,
  type LearningPathCatalogItem,
  type LearningPathStore,
  type LearningPlanRecord
} from "../src/modules/learning-paths/routes.js";
import { createApp } from "../src/app.js";

const webOrigin = "http://localhost:5173";
const rawSessionToken = "test-learning-session-token-1234567890";
const account: AccountRecord = {
  id: "candidate-1",
  email: "candidate@example.com",
  displayName: "Candidata",
  passwordHash: null,
  status: "active",
  roles: ["candidate"],
  profile: { headline: null, region: null, isDiscoverable: false }
};

const path: LearningPathCatalogItem = {
  id: "backend-path",
  slug: "backend-foundations",
  title: "Fundamentos de backend",
  description: "Uma sequência para construir uma API.",
  targetRole: "Desenvolvedor backend júnior",
  outcome: "Construir uma API e testar seu comportamento.",
  estimatedMinutes: 270,
  stages: [
    {
      id: "http-stage",
      position: 1,
      competency: { slug: "web-apis", title: "APIs web", description: "HTTP e APIs." },
      whyThisStep: "Estabelece a base do serviço.",
      practiceTask: "Desenhe dois endpoints e valide as entradas.",
      estimatedMinutes: 150,
      resourceTitle: null,
      resourceUrl: null
    },
    {
      id: "testing-stage",
      position: 2,
      competency: { slug: "automated-testing", title: "Testes automatizados", description: "Testes." },
      whyThisStep: "Verifica o comportamento desenvolvido.",
      practiceTask: "Teste os casos válidos e inválidos.",
      estimatedMinutes: 120,
      resourceTitle: null,
      resourceUrl: null
    }
  ]
};

class LearningMemoryStore implements LearningPathStore {
  private plan: LearningPlanRecord | null = null;

  async listPublishedPaths(): Promise<LearningPathCatalogItem[]> {
    return [path];
  }

  async getActivePlan(userId: string): Promise<LearningPlanRecord | null> {
    return userId === account.id ? this.plan : null;
  }

  async selectPath(userId: string, pathId: string): Promise<LearningPlanRecord | null> {
    if (userId !== account.id || pathId !== path.id) {
      return null;
    }
    this.plan ??= {
      id: "plan-1",
      status: "active",
      path,
      steps: path.stages.map((stage) => ({
        id: `progress-${stage.id}`,
        learningPathCompetencyId: stage.id,
        status: "not_started"
      }))
    };
    return this.plan;
  }

  async updateActiveStep(userId: string, stageId: string, status: "not_started" | "in_progress" | "studied") {
    if (userId !== account.id || !this.plan) {
      return null;
    }
    const step = this.plan.steps.find((item) => item.learningPathCompetencyId === stageId);
    if (!step) {
      return null;
    }
    step.status = status;
    if (this.plan.steps.every((item) => item.status === "studied")) {
      this.plan.status = "completed";
    }
    return this.plan;
  }
}

class LearningAuthStore implements AuthStore {
  async findUserByEmail(): Promise<AccountRecord | null> {
    return null;
  }

  async createCandidate(): Promise<AccountRecord> {
    throw new Error("Not needed for learning path route tests.");
  }

  async createEmailActionToken(): Promise<void> {
    throw new Error("Not needed for learning path route tests.");
  }

  async consumeEmailActionToken(): Promise<boolean> {
    return false;
  }

  async createSession(): Promise<void> {
    throw new Error("Not needed for learning path route tests.");
  }

  async findSession(sessionTokenHash: string): Promise<AuthenticatedSession | null> {
    return sessionTokenHash === tokenHash(rawSessionToken)
      ? { id: "session-1", user: account }
      : null;
  }

  async revokeSession(): Promise<void> {}

  async updateProfile(): Promise<AccountRecord> {
    return account;
  }
}

const apps: FastifyInstance[] = [];

async function createLearningApp(): Promise<FastifyInstance> {
  const app = await createApp({
    webOrigin,
    logLevel: "silent",
    checkDatabase: async () => undefined,
    auth: {
      store: new LearningAuthStore(),
      webOrigin,
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
      cookieSecure: false
    },
    learningPaths: new LearningMemoryStore()
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("structured learning paths", () => {
  it("explains an ordered recommendation and computes study-only progress", () => {
    const result = buildLearningPlan({
      id: "plan-1",
      status: "active",
      path,
      steps: [
        { id: "progress-1", learningPathCompetencyId: "http-stage", status: "studied" },
        { id: "progress-2", learningPathCompetencyId: "testing-stage", status: "in_progress" }
      ]
    });

    expect(result.progressPercent).toBe(50);
    expect(result.nextStageId).toBe("testing-stage");
    expect(result.recommendationReason).toContain("já começou Testes automatizados");
    expect(result.recommendationReason).toContain("prepara a próxima competência");
  });

  it("requires an authenticated candidate, prevents skipping, and updates the next step", async () => {
    const app = await createLearningApp();
    const cookie = `platform_session=${rawSessionToken}`;
    const catalog = await app.inject("/api/v1/learning-paths");
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json().paths).toHaveLength(1);
    expect((await app.inject("/api/v1/my-learning-plan")).statusCode).toBe(401);

    const start = await app.inject({
      method: "POST",
      url: "/api/v1/my-learning-plan",
      headers: { origin: webOrigin, cookie },
      payload: { pathId: path.id }
    });
    expect(start.statusCode).toBe(200);
    expect(start.json().plan.progressPercent).toBe(0);
    expect(start.json().plan.recommendationReason).toContain("primeira etapa");

    const skipped = await app.inject({
      method: "PATCH",
      url: "/api/v1/my-learning-plan/stages/testing-stage",
      headers: { origin: webOrigin, cookie },
      payload: { status: "studied" }
    });
    expect(skipped.statusCode).toBe(409);

    const started = await app.inject({
      method: "PATCH",
      url: "/api/v1/my-learning-plan/stages/http-stage",
      headers: { origin: webOrigin, cookie },
      payload: { status: "in_progress" }
    });
    expect(started.statusCode).toBe(200);
    expect(started.json().plan.progressPercent).toBe(0);

    const completedStage = await app.inject({
      method: "PATCH",
      url: "/api/v1/my-learning-plan/stages/http-stage",
      headers: { origin: webOrigin, cookie },
      payload: { status: "studied" }
    });
    expect(completedStage.json().plan.progressPercent).toBe(50);
    expect(completedStage.json().plan.nextStageId).toBe("testing-stage");

    const completedPlan = await app.inject({
      method: "PATCH",
      url: "/api/v1/my-learning-plan/stages/testing-stage",
      headers: { origin: webOrigin, cookie },
      payload: { status: "studied" }
    });
    expect(completedPlan.json().plan.status).toBe("completed");
    expect(completedPlan.json().plan.progressPercent).toBe(100);
    expect(completedPlan.json().plan.recommendationReason).toContain("não uma avaliação independente");
  });
});
