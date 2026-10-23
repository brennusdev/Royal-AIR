import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  tokenHash,
  type AccountRecord,
  type AuthStore,
  type AuthenticatedSession
} from "../src/auth.js";
import type { PortfolioEvidenceStore } from "../src/portfolio-evidence.js";
import { createApp } from "../src/app.js";

const webOrigin = "http://localhost:5173";
const sessionToken = "portfolio-evidence-session-token-1234567890";
const secondSessionToken = "another-portfolio-session-token-1234567890";

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

class EvidenceAuthStore implements AuthStore {
  async findUserByEmail(): Promise<AccountRecord | null> { return null; }
  async createCandidate(): Promise<AccountRecord> { throw new Error("Not used in tests."); }
  async createEmailActionToken(): Promise<void> { throw new Error("Not used in tests."); }
  async consumeEmailActionToken(): Promise<boolean> { return false; }
  async createSession(): Promise<void> { throw new Error("Not used in tests."); }
  async revokeSession(): Promise<void> {}
  async updateProfile(): Promise<AccountRecord> { return makeAccount("candidate-1"); }

  async findSession(hash: string): Promise<AuthenticatedSession | null> {
    if (hash === tokenHash(sessionToken)) {
      return { id: "session-1", user: makeAccount("candidate-1") };
    }
    return hash === tokenHash(secondSessionToken)
      ? { id: "session-2", user: makeAccount("candidate-2") }
      : null;
  }
}

class MemoryEvidenceStore implements PortfolioEvidenceStore {
  private readonly entries = new Map<string, Array<{
    id: string;
    title: string;
    description: string;
    url: string | null;
    status: "self_reported";
    createdAt: string;
  }>>();
  private nextId = 1;

  async listForCandidate(userId: string) {
    return this.entries.get(userId) ?? [];
  }

  async createForCandidate(
    userId: string,
    input: { title: string; description: string; url: string | null }
  ) {
    const evidence = {
      id: `evidence-${this.nextId++}`,
      ...input,
      status: "self_reported" as const,
      createdAt: new Date().toISOString()
    };
    this.entries.set(userId, [...(this.entries.get(userId) ?? []), evidence]);
    return evidence;
  }

  async deleteForCandidate(userId: string, evidenceId: string) {
    const current = this.entries.get(userId) ?? [];
    const next = current.filter((item) => item.id !== evidenceId);
    this.entries.set(userId, next);
    return next.length !== current.length;
  }
}

const apps: FastifyInstance[] = [];

async function createEvidenceApp(): Promise<FastifyInstance> {
  const app = await createApp({
    webOrigin,
    logLevel: "silent",
    checkDatabase: async () => undefined,
    auth: {
      store: new EvidenceAuthStore(),
      webOrigin,
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
      cookieSecure: false
    },
    portfolioEvidence: new MemoryEvidenceStore()
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("private portfolio evidence", () => {
  it("requires a candidate session and stores only self-reported entries", async () => {
    const app = await createEvidenceApp();
    expect((await app.inject("/api/v1/my/evidence")).statusCode).toBe(401);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/my/evidence",
      headers: { origin: webOrigin, cookie: `platform_session=${sessionToken}` },
      payload: {
        title: "API de tarefas",
        description: "Implementei endpoints REST e aprendi a validar os dados recebidos.",
        url: "https://example.com/project"
      }
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().evidence.status).toBe("self_reported");

    const list = await app.inject({
      url: "/api/v1/my/evidence",
      headers: { cookie: `platform_session=${sessionToken}` }
    });
    expect(list.json().evidence).toHaveLength(1);
    expect(list.json().evidence[0].title).toBe("API de tarefas");
  });

  it("rejects non-web links and requests without the configured origin", async () => {
    const app = await createEvidenceApp();
    const headers = { origin: webOrigin, cookie: `platform_session=${sessionToken}` };
    const invalidUrl = await app.inject({
      method: "POST",
      url: "/api/v1/my/evidence",
      headers,
      payload: {
        title: "Registro de teste",
        description: "Descrição suficientemente longa para validar os critérios.",
        url: "javascript:alert(1)"
      }
    });
    expect(invalidUrl.statusCode).toBe(400);

    const wrongOrigin = await app.inject({
      method: "POST",
      url: "/api/v1/my/evidence",
      headers: { ...headers, origin: "https://attacker.example" },
      payload: {
        title: "Registro de teste",
        description: "Descrição suficientemente longa para validar os critérios."
      }
    });
    expect(wrongOrigin.statusCode).toBe(403);
  });

  it("does not let another candidate delete private evidence", async () => {
    const app = await createEvidenceApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/my/evidence",
      headers: { origin: webOrigin, cookie: `platform_session=${sessionToken}` },
      payload: {
        title: "Projeto de portfólio",
        description: "Documentei a implementação e o que aprendi com os testes."
      }
    });
    const evidenceId = created.json().evidence.id;
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/my/evidence/${evidenceId}`,
      headers: { origin: webOrigin, cookie: `platform_session=${secondSessionToken}` }
    });
    expect(response.statusCode).toBe(404);

    const stillOwned = await app.inject({
      url: "/api/v1/my/evidence",
      headers: { cookie: `platform_session=${sessionToken}` }
    });
    expect(stillOwned.json().evidence).toHaveLength(1);
  });
});
