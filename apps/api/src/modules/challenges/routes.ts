import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  challengeAttemptSchema,
  challengeSchema,
  type Challenge,
  type ChallengeAttempt
} from "@platform/shared";
import { getAuthenticatedSession, requireSameOrigin, type AuthStore } from "../auth/routes.js";

const attemptIdSchema = z.object({ attemptId: z.string().min(1).max(80) }).strict();
const challengeIdSchema = z.object({ challengeId: z.string().min(1).max(80) }).strict();
const submissionSchema = z.object({
  approach: z.string().trim().min(20).max(6000),
  submissionUrl: z.string().trim().url().max(2048).nullable().optional()
}).strict().superRefine((value, context) => {
  if (!value.submissionUrl) {
    return;
  }
  const protocol = new URL(value.submissionUrl).protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    context.addIssue({
      code: "custom",
      path: ["submissionUrl"],
      message: "Submission links must use HTTP or HTTPS."
    });
  }
});

export interface ChallengeRecord extends Challenge {
  status: "draft" | "published" | "archived";
}

export type ChallengeAttemptRecord = ChallengeAttempt;

export interface ChallengeStore {
  listPublished(): Promise<ChallengeRecord[]>;
  listCandidateAttempts(userId: string): Promise<ChallengeAttemptRecord[]>;
  startAttempt(userId: string, challengeId: string): Promise<ChallengeAttemptRecord | null>;
  saveDraft(
    userId: string,
    attemptId: string,
    input: { approach: string; submissionUrl: string | null }
  ): Promise<ChallengeAttemptRecord | null>;
  submit(
    userId: string,
    attemptId: string
  ): Promise<ChallengeAttemptRecord | null>;
}

async function getCandidate(
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

function authError(
  candidate: Awaited<ReturnType<typeof getCandidate>>
): candidate is { error: "Authentication required." | "Candidate role required." } {
  return "error" in candidate;
}

export async function registerChallengeRoutes(
  app: FastifyInstance,
  options: { authStore: AuthStore; challengeStore: ChallengeStore; webOrigin: string }
): Promise<void> {
  const sameOrigin = requireSameOrigin(options.webOrigin);

  app.get("/api/v1/challenges", async (_request, reply) => {
    const challenges = await options.challengeStore.listPublished();
    reply.header("Cache-Control", "public, max-age=60");
    return {
      challenges: challenges.map((challenge) => challengeSchema.parse({
        id: challenge.id,
        slug: challenge.slug,
        title: challenge.title,
        context: challenge.context,
        description: challenge.description,
        difficulty: challenge.difficulty,
        estimatedMinutes: challenge.estimatedMinutes,
        version: challenge.version,
        acceptanceCriteria: challenge.acceptanceCriteria,
        rubricCriteria: challenge.rubricCriteria
      }))
    };
  });

  app.get("/api/v1/my/challenge-attempts", async (request, reply) => {
    const candidate = await getCandidate(request, options.authStore);
    if (authError(candidate)) {
      return reply.code(candidate.error === "Authentication required." ? 401 : 403)
        .send({ error: candidate.error });
    }
    reply.header("Cache-Control", "no-store");
    const attempts = await options.challengeStore.listCandidateAttempts(candidate.userId);
    return { attempts: attempts.map((attempt) => challengeAttemptSchema.parse(attempt)) };
  });

  app.post(
    "/api/v1/challenges/:challengeId/attempts",
    { preHandler: sameOrigin },
    async (request, reply) => {
      const candidate = await getCandidate(request, options.authStore);
      if (authError(candidate)) {
        return reply.code(candidate.error === "Authentication required." ? 401 : 403)
          .send({ error: candidate.error });
      }
      const { challengeId } = challengeIdSchema.parse(request.params);
      const attempt = await options.challengeStore.startAttempt(candidate.userId, challengeId);
      if (!attempt) {
        return reply.code(404).send({ error: "Published challenge not found." });
      }
      return { attempt: challengeAttemptSchema.parse(attempt) };
    }
  );

  app.patch(
    "/api/v1/my/challenge-attempts/:attemptId",
    { preHandler: sameOrigin },
    async (request, reply) => {
      const candidate = await getCandidate(request, options.authStore);
      if (authError(candidate)) {
        return reply.code(candidate.error === "Authentication required." ? 401 : 403)
          .send({ error: candidate.error });
      }
      const { attemptId } = attemptIdSchema.parse(request.params);
      const input = submissionSchema.parse(request.body);
      const attempt = await options.challengeStore.saveDraft(candidate.userId, attemptId, {
        approach: input.approach,
        submissionUrl: input.submissionUrl ?? null
      });
      if (!attempt) {
        return reply.code(404).send({ error: "In-progress challenge attempt not found." });
      }
      return { attempt: challengeAttemptSchema.parse(attempt) };
    }
  );

  app.post(
    "/api/v1/my/challenge-attempts/:attemptId/submit",
    { preHandler: sameOrigin },
    async (request, reply) => {
      const candidate = await getCandidate(request, options.authStore);
      if (authError(candidate)) {
        return reply.code(candidate.error === "Authentication required." ? 401 : 403)
          .send({ error: candidate.error });
      }
      const { attemptId } = attemptIdSchema.parse(request.params);
      const attempt = await options.challengeStore.submit(candidate.userId, attemptId);
      if (!attempt) {
        return reply.code(409).send({
          error: "Save a complete draft before submitting, or the attempt is no longer editable."
        });
      }
      return { attempt: challengeAttemptSchema.parse(attempt) };
    }
  );
}
