import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { portfolioEvidenceSchema, type PortfolioEvidence } from "@platform/shared";
import { getAuthenticatedSession, requireSameOrigin, type AuthStore } from "./auth.js";

const createEvidenceSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(4000),
  url: z.string().trim().url().max(2048).nullable().optional()
}).strict().superRefine((value, context) => {
  if (!value.url) {
    return;
  }
  const protocol = new URL(value.url).protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    context.addIssue({
      code: "custom",
      path: ["url"],
      message: "Evidence links must use HTTP or HTTPS."
    });
  }
});

export interface PortfolioEvidenceStore {
  listForCandidate(userId: string): Promise<PortfolioEvidence[]>;
  createForCandidate(
    userId: string,
    input: Omit<PortfolioEvidence, "id" | "status" | "createdAt">
  ): Promise<PortfolioEvidence>;
  deleteForCandidate(userId: string, evidenceId: string): Promise<boolean>;
}

async function getCandidateId(
  request: FastifyRequest,
  authStore: AuthStore
): Promise<{ userId: string } | { error: "Authentication required." | "Candidate role required." }> {
  const session = await getAuthenticatedSession(request, authStore);
  if (!session) {
    return { error: "Authentication required." };
  }
  if (!session.user.roles.includes("candidate")) {
    return { error: "Candidate role required." };
  }
  return { userId: session.user.id };
}

function isAuthError(
  candidate: Awaited<ReturnType<typeof getCandidateId>>
): candidate is { error: "Authentication required." | "Candidate role required." } {
  return "error" in candidate;
}

function parseEvidence(value: PortfolioEvidence): PortfolioEvidence {
  return portfolioEvidenceSchema.parse(value);
}

export async function registerPortfolioEvidenceRoutes(
  app: FastifyInstance,
  options: {
    authStore: AuthStore;
    evidenceStore: PortfolioEvidenceStore;
    webOrigin: string;
  }
): Promise<void> {
  const sameOrigin = requireSameOrigin(options.webOrigin);

  app.get("/api/v1/my/evidence", async (request, reply) => {
    const candidate = await getCandidateId(request, options.authStore);
    if (isAuthError(candidate)) {
      return reply.code(candidate.error === "Authentication required." ? 401 : 403)
        .send({ error: candidate.error });
    }
    reply.header("Cache-Control", "no-store");
    const evidence = await options.evidenceStore.listForCandidate(candidate.userId);
    return { evidence: evidence.map(parseEvidence) };
  });

  app.post("/api/v1/my/evidence", { preHandler: sameOrigin }, async (request, reply) => {
    const candidate = await getCandidateId(request, options.authStore);
    if (isAuthError(candidate)) {
      return reply.code(candidate.error === "Authentication required." ? 401 : 403)
        .send({ error: candidate.error });
    }
    const input = createEvidenceSchema.parse(request.body);
    const evidence = await options.evidenceStore.createForCandidate(candidate.userId, {
      title: input.title,
      description: input.description,
      url: input.url ?? null
    });
    return reply.code(201).send({ evidence: parseEvidence(evidence) });
  });

  app.delete(
    "/api/v1/my/evidence/:evidenceId",
    { preHandler: sameOrigin },
    async (request, reply) => {
      const candidate = await getCandidateId(request, options.authStore);
      if (isAuthError(candidate)) {
        return reply.code(candidate.error === "Authentication required." ? 401 : 403)
          .send({ error: candidate.error });
      }
      const { evidenceId } = z.object({
        evidenceId: z.string().min(1).max(80)
      }).strict().parse(request.params);
      const deleted = await options.evidenceStore.deleteForCandidate(candidate.userId, evidenceId);
      if (!deleted) {
        return reply.code(404).send({ error: "Evidence not found." });
      }
      return reply.code(204).send();
    }
  );
}
