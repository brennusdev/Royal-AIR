import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  tokenHash,
  type AccountRecord,
  type AuthStore,
  type AuthenticatedSession
} from "../src/auth.js";
import {
  type ChallengeAttemptRecord,
  type ChallengeRecord,
  type ChallengeStore
} from "../src/challenges.js";
import { createApp } from "../src/app.js";

const webOrigin = "http://localhost:5173";
const candidateToken = "challenge-session-token-1234567890";
const otherToken = "other-challenge-session-token-1234567890";

function makeAccount(id: string, roles = ["candidate"]): AccountRecord {
  return {
    id,
    email: `${id}@example.com`,
    displayName: id,
    passwordHash: null,
    status: "active",
    roles,
    profile: { headline: null, region: null, isDiscoverable: false }
  };
}

class ChallengeAuthStore implements AuthStore {
  async findUserByEmail(): Promise<AccountRecord | null> { return null; }
  async createCandidate(): Promise<AccountRecord> { throw new Error("Not used in tests."); }
  async createEmailActionToken(): Promise<void> { throw new Error("Not used in tests."); }
  async consumeEmailActionToken(): Promise<boolean> { return false; }
  async createSession(): Promise<void> { throw new Error("Not used in tests."); }
  async revokeSession(): Promise<void> {}
  async updateProfile(): Promise<AccountRecord> { return makeAccount("candidate-1"); }

  async findSession(hash: string): Promise<AuthenticatedSession | null> {
    if (hash === tokenHash(candidateToken)) {
      return { id: "session-1", user: makeAccount("candidate-1") };
    }
    if (hash === tokenHash(otherToken)) {
      return { id: "session-2", user: makeAccount("candidate-2") };
    }
    return null;
  }
}

const challenge: ChallengeRecord = {
  id: "challenge-1",
  slug: "api-validation",
  title: "API com validação",
  context: "Contexto fictício de um desafio.",
  description: "Descreva uma solução e suas decisões.",
  difficulty: "fundamentos",
  estimatedMinutes: 60,
  version: 1,
  status: "published",
  acceptanceCriteria: ["Documentar a entrada.", "Explicar erros."],
  rubricCriteria: ["Clareza.", "Validação."]
};

class MemoryChallengeStore implements ChallengeStore {
  readonly attempts = new Map<string, ChallengeAttemptRecord>();

  async listPublished(): Promise<ChallengeRecord[]> {
    return [challenge];
  }

  async listCandidateAttempts(userId: string): Promise<ChallengeAttemptRecord[]> {
    return [...this.attempts.values()].filter((attempt) => attempt.id.startsWith(`${userId}-`));
  }

  async startAttempt(userId: string, challengeId: string): Promise<ChallengeAttemptRecord | null> {
    if (challengeId !== challenge.id) {
      return null;
    }
    const id = `${userId}-${challengeId}`;
    const existing = this.attempts.get(id);
    if (existing) {
      return existing;
    }
    const now = new Date().toISOString();
    const attempt: ChallengeAttemptRecord = {
      id,
      challengeId,
      challengeTitle: challenge.title,
      challengeVersion: challenge.version,
      acceptanceCriteria: challenge.acceptanceCriteria,
      rubricCriteria: challenge.rubricCriteria,
      status: "in_progress",
      approach: null,
      submissionUrl: null,
      startedAt: now,
      submittedAt: null,
      updatedAt: now
    };
    this.attempts.set(id, attempt);
    return attempt;
  }

  async saveDraft(
    userId: string,
    attemptId: string,
    input: { approach: string; submissionUrl: string | null }
  ): Promise<ChallengeAttemptRecord | null> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || !attemptId.startsWith(`${userId}-`) || attempt.status !== "in_progress") {
      return null;
    }
    const updated = { ...attempt, ...input, updatedAt: new Date().toISOString() };
    this.attempts.set(attemptId, updated);
    return updated;
  }

  async submit(userId: string, attemptId: string): Promise<ChallengeAttemptRecord | null> {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || !attemptId.startsWith(`${userId}-`) || attempt.status !== "in_progress" || !attempt.approach) {
      return null;
    }
    const now = new Date().toISOString();
    const submitted = { ...attempt, status: "submitted" as const, submittedAt: now, updatedAt: now };
    this.attempts.set(attemptId, submitted);
    return submitted;
  }
}

const apps: FastifyInstance[] = [];
const challengeStore = new MemoryChallengeStore();

async function createChallengeApp(): Promise<FastifyInstance> {
  const app = await createApp({
    webOrigin,
    logLevel: "silent",
    checkDatabase: async () => undefined,
    auth: {
      store: new ChallengeAuthStore(),
      webOrigin,
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
      cookieSecure: false
    },
    challenges: challengeStore
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  challengeStore.attempts.clear();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("challenge attempts", () => {
  it("lists only the published challenge and exposes its criteria", async () => {
    const app = await createChallengeApp();
    const response = await app.inject("/api/v1/challenges");
    expect(response.statusCode).toBe(200);
    expect(response.json().challenges[0].acceptanceCriteria).toEqual(challenge.acceptanceCriteria);
    expect(response.json().challenges[0].rubricCriteria).toEqual(challenge.rubricCriteria);
  });

  it("requires a candidate session and same-origin writes", async () => {
    const app = await createChallengeApp();
    expect((await app.inject("/api/v1/my/challenge-attempts")).statusCode).toBe(401);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/challenges/${challenge.id}/attempts`,
      headers: { cookie: `platform_session=${candidateToken}`, origin: "https://attacker.example" },
      payload: {}
    });
    expect(response.statusCode).toBe(403);
  });

  it("starts, saves, submits, and isolates a candidate's attempt", async () => {
    const app = await createChallengeApp();
    const candidateHeaders = {
      cookie: `platform_session=${candidateToken}`,
      origin: webOrigin
    };
    const started = await app.inject({
      method: "POST",
      url: `/api/v1/challenges/${challenge.id}/attempts`,
      headers: candidateHeaders,
      payload: {}
    });
    expect(started.statusCode).toBe(200);
    const attemptId = started.json().attempt.id;

    const saved = await app.inject({
      method: "PATCH",
      url: `/api/v1/my/challenge-attempts/${attemptId}`,
      headers: candidateHeaders,
      payload: {
        approach: "Vou validar os dados e documentar os erros que a API pode responder.",
        submissionUrl: "https://example.com/repo"
      }
    });
    expect(saved.statusCode).toBe(200);
    const submitted = await app.inject({
      method: "POST",
      url: `/api/v1/my/challenge-attempts/${attemptId}/submit`,
      headers: candidateHeaders,
      payload: {}
    });
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json().attempt.status).toBe("submitted");

    const otherCandidateAttempts = await app.inject({
      url: "/api/v1/my/challenge-attempts",
      headers: { cookie: `platform_session=${otherToken}` }
    });
    expect(otherCandidateAttempts.json().attempts).toHaveLength(0);
    const crossAccountEdit = await app.inject({
      method: "PATCH",
      url: `/api/v1/my/challenge-attempts/${attemptId}`,
      headers: { ...candidateHeaders, cookie: `platform_session=${otherToken}` },
      payload: { approach: "Outra conta não deve poder alterar esta tentativa.", submissionUrl: null }
    });
    expect(crossAccountEdit.statusCode).toBe(404);
  });

  it("rejects non-HTTP submission links and incomplete submissions", async () => {
    const app = await createChallengeApp();
    const headers = { cookie: `platform_session=${candidateToken}`, origin: webOrigin };
    const started = await app.inject({
      method: "POST",
      url: `/api/v1/challenges/${challenge.id}/attempts`,
      headers,
      payload: {}
    });
    const attemptId = started.json().attempt.id;
    const invalidLink = await app.inject({
      method: "PATCH",
      url: `/api/v1/my/challenge-attempts/${attemptId}`,
      headers,
      payload: { approach: "Uma descrição suficientemente longa para ser válida.", submissionUrl: "javascript:alert(1)" }
    });
    expect(invalidLink.statusCode).toBe(400);
    const incomplete = await app.inject({
      method: "POST",
      url: `/api/v1/my/challenge-attempts/${attemptId}/submit`,
      headers,
      payload: {}
    });
    expect(incomplete.statusCode).toBe(409);
  });
});
