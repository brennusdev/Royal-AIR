import type { ChallengeAttempt } from "@platform/shared";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ChallengeAttemptRecord, ChallengeRecord, ChallengeStore } from "./routes.js";

function toChallenge(record: {
  id: string;
  slug: string;
  title: string;
  context: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
  version: number;
  status: "draft" | "published" | "archived";
  acceptanceCriteria: string[];
  rubricCriteria: string[];
}): ChallengeRecord {
  return { ...record };
}

function toAttempt(record: {
  id: string;
  challengeId: string;
  challengeVersion: number;
  acceptanceCriteria: string[];
  rubricCriteria: string[];
  status: "in_progress" | "submitted";
  approach: string | null;
  submissionUrl: string | null;
  startedAt: Date;
  submittedAt: Date | null;
  updatedAt: Date;
  challenge: { title: string };
}): ChallengeAttemptRecord {
  const attempt: ChallengeAttempt = {
    id: record.id,
    challengeId: record.challengeId,
    challengeTitle: record.challenge.title,
    challengeVersion: record.challengeVersion,
    acceptanceCriteria: record.acceptanceCriteria,
    rubricCriteria: record.rubricCriteria,
    status: record.status,
    approach: record.approach,
    submissionUrl: record.submissionUrl,
    startedAt: record.startedAt.toISOString(),
    submittedAt: record.submittedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString()
  };
  return attempt;
}

const attemptInclude = { challenge: { select: { title: true } } } as const;

export function createPrismaChallengeStore(prisma: PrismaClient): ChallengeStore {
  return {
    async listPublished() {
      const challenges = await prisma.challenge.findMany({
        where: { status: "published" },
        orderBy: { title: "asc" }
      });
      return challenges.map(toChallenge);
    },

    async listCandidateAttempts(userId) {
      const attempts = await prisma.challengeAttempt.findMany({
        where: { userId },
        include: attemptInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
      });
      return attempts.map(toAttempt);
    },

    async startAttempt(userId, challengeId) {
      const challenge = await prisma.challenge.findFirst({
        where: { id: challengeId, status: "published" },
        select: {
          id: true,
          version: true,
          acceptanceCriteria: true,
          rubricCriteria: true
        }
      });
      if (!challenge) {
        return null;
      }

      const attempt = await prisma.challengeAttempt.upsert({
        where: { userId_challengeId: { userId, challengeId } },
        create: {
          userId,
          challengeId,
          challengeVersion: challenge.version,
          acceptanceCriteria: challenge.acceptanceCriteria,
          rubricCriteria: challenge.rubricCriteria
        },
        update: {},
        include: attemptInclude
      });
      return toAttempt(attempt);
    },

    async saveDraft(userId, attemptId, input) {
      const updated = await prisma.challengeAttempt.updateMany({
        where: { id: attemptId, userId, status: "in_progress" },
        data: input
      });
      if (updated.count !== 1) {
        return null;
      }
      const attempt = await prisma.challengeAttempt.findUnique({
        where: { id: attemptId },
        include: attemptInclude
      });
      return attempt ? toAttempt(attempt) : null;
    },

    async submit(userId, attemptId) {
      const updated = await prisma.challengeAttempt.updateMany({
        where: {
          id: attemptId,
          userId,
          status: "in_progress",
          approach: { not: null }
        },
        data: { status: "submitted", submittedAt: new Date() }
      });
      if (updated.count !== 1) {
        return null;
      }
      const attempt = await prisma.challengeAttempt.findUnique({
        where: { id: attemptId },
        include: attemptInclude
      });
      return attempt ? toAttempt(attempt) : null;
    }
  };
}
