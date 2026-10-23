import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  tokenHash,
  type AccountRecord,
  type AuthStore,
  type Mailer
} from "../src/auth.js";
import { createApp } from "../src/app.js";

class MemoryAuthStore implements AuthStore {
  private readonly users = new Map<string, AccountRecord>();
  private readonly actionTokens = new Map<string, {
    userId: string;
    purpose: "verify_email" | "reset_password";
    expiresAt: Date;
    consumed: boolean;
  }>();
  private readonly sessions = new Map<string, {
    id: string;
    userId: string;
    expiresAt: Date;
    revoked: boolean;
  }>();
  private nextId = 1;

  async findUserByEmail(email: string): Promise<AccountRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async createCandidate(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<AccountRecord> {
    const user: AccountRecord = {
      id: String(this.nextId++),
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      status: "pending",
      roles: ["candidate"],
      profile: { headline: null, region: null, isDiscoverable: false }
    };
    this.users.set(user.id, user);
    return user;
  }

  async createEmailActionToken(input: {
    userId: string;
    tokenHash: string;
    purpose: "verify_email" | "reset_password";
    expiresAt: Date;
  }): Promise<void> {
    this.actionTokens.set(input.tokenHash, { ...input, consumed: false });
  }

  async consumeEmailActionToken(input: {
    tokenHash: string;
    purpose: "verify_email" | "reset_password";
    passwordHash?: string;
  }): Promise<boolean> {
    const action = this.actionTokens.get(input.tokenHash);
    if (!action || action.consumed || action.purpose !== input.purpose || action.expiresAt <= new Date()) {
      return false;
    }
    action.consumed = true;
    const user = this.users.get(action.userId);
    if (!user) {
      return false;
    }
    if (input.purpose === "verify_email") {
      user.status = "active";
    } else if (input.passwordHash) {
      user.passwordHash = input.passwordHash;
      for (const session of this.sessions.values()) {
        if (session.userId === user.id) {
          session.revoked = true;
        }
      }
    }
    return true;
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    this.sessions.set(input.tokenHash, {
      id: String(this.nextId++),
      userId: input.userId,
      expiresAt: input.expiresAt,
      revoked: false
    });
  }

  async findSession(tokenHashValue: string) {
    const session = this.sessions.get(tokenHashValue);
    const user = session ? this.users.get(session.userId) : null;
    if (!session || !user || session.revoked || session.expiresAt <= new Date() || user.status !== "active") {
      return null;
    }
    return { id: session.id, user };
  }

  async revokeSession(id: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.id === id) {
        session.revoked = true;
      }
    }
  }

  async updateProfile(
    userId: string,
    changes: { displayName?: string; headline?: string | null; region?: string | null; isDiscoverable?: boolean }
  ): Promise<AccountRecord> {
    const user = this.users.get(userId);
    if (!user || !user.profile) {
      throw new Error("Candidate not found");
    }
    if (changes.displayName !== undefined) {
      user.displayName = changes.displayName;
    }
    user.profile = {
      headline: changes.headline === undefined ? user.profile.headline : changes.headline,
      region: changes.region === undefined ? user.profile.region : changes.region,
      isDiscoverable: changes.isDiscoverable ?? user.profile.isDiscoverable
    };
    return user;
  }
}

const origin = "http://localhost:5173";
const apps: FastifyInstance[] = [];
const sentMessages: Array<{ to: string; subject: string; text: string }> = [];

async function createAuthApp(store = new MemoryAuthStore()): Promise<FastifyInstance> {
  const mailer: Mailer = {
    async send(message) {
      sentMessages.push(message);
    }
  };
  const app = await createApp({
    webOrigin: origin,
    checkDatabase: async () => undefined,
    logLevel: "silent",
    auth: {
      store,
      mailer,
      webOrigin: origin,
      termsVersion: "test-terms-v1",
      privacyVersion: "test-privacy-v1",
      cookieSecure: false
    }
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  sentMessages.length = 0;
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("authentication and candidate profile", () => {
  it("verifies email, logs in with an HTTP-only cookie, and logs out", async () => {
    const app = await createAuthApp();
    const registration = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin },
      payload: {
        email: "Candidate@Example.com",
        displayName: "Candidate",
        password: "correct-horse-battery",
        acceptedTerms: true,
        acceptedPrivacy: true,
        roles: ["platform_admin"]
      }
    });

    expect(registration.statusCode).toBe(400);
    expect(sentMessages).toHaveLength(0);

    const accepted = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin },
      payload: {
        email: "Candidate@Example.com",
        displayName: "Candidate",
        password: "correct-horse-battery",
        acceptedTerms: true,
        acceptedPrivacy: true
      }
    });
    expect(accepted.statusCode).toBe(202);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]?.text).not.toContain("correct-horse-battery");

    const pendingLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin },
      payload: { email: "candidate@example.com", password: "correct-horse-battery" }
    });
    expect(pendingLogin.statusCode).toBe(401);

    const verifyUrl = sentMessages[0]!.text.match(/https?:\/\/\S+/)?.[0];
    expect(verifyUrl).toBeTruthy();
    const verifyToken = new URL(verifyUrl!).searchParams.get("token");
    expect(verifyToken).toBeTruthy();
    const verified = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email",
      headers: { origin },
      payload: { token: verifyToken }
    });
    expect(verified.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin },
      payload: { email: "candidate@example.com", password: "correct-horse-battery" }
    });
    expect(login.statusCode).toBe(200);
    expect(login.headers["set-cookie"]).toContain("HttpOnly");
    const cookie = String(login.headers["set-cookie"]).split(";")[0];

    const currentUser = await app.inject({
      url: "/api/v1/auth/me",
      headers: { cookie }
    });
    expect(currentUser.statusCode).toBe(200);
    expect(currentUser.json().user.roles).toEqual(["candidate"]);

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { origin, cookie }
    });
    expect(logout.statusCode).toBe(204);
    const afterLogout = await app.inject({
      url: "/api/v1/auth/me",
      headers: { cookie }
    });
    expect(afterLogout.statusCode).toBe(401);

    const secondLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin },
      payload: { email: "candidate@example.com", password: "correct-horse-battery" }
    });
    const secondCookie = String(secondLogin.headers["set-cookie"]).split(";")[0];

    const unknownForgot = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password/forgot",
      headers: { origin },
      payload: { email: "unknown@example.com" }
    });
    const forgot = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password/forgot",
      headers: { origin },
      payload: { email: "candidate@example.com" }
    });
    expect(forgot.statusCode).toBe(202);
    expect(forgot.json()).toEqual(unknownForgot.json());
    const resetUrl = sentMessages[1]?.text.match(/https?:\/\/\S+/)?.[0];
    expect(resetUrl).toBeTruthy();
    const resetToken = new URL(resetUrl!).searchParams.get("token");

    const reset = await app.inject({
      method: "POST",
      url: "/api/v1/auth/password/reset",
      headers: { origin },
      payload: { token: resetToken, password: "a-new-safe-password-123" }
    });
    expect(reset.statusCode).toBe(200);
    const revokedSession = await app.inject({
      url: "/api/v1/auth/me",
      headers: { cookie: secondCookie }
    });
    expect(revokedSession.statusCode).toBe(401);

    const oldPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin },
      payload: { email: "candidate@example.com", password: "correct-horse-battery" }
    });
    expect(oldPassword.statusCode).toBe(401);
    const newPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin },
      payload: { email: "candidate@example.com", password: "a-new-safe-password-123" }
    });
    expect(newPassword.statusCode).toBe(200);
  });

  it("rejects login before verification and rejects cross-origin mutations", async () => {
    const app = await createAuthApp();
    const crossOrigin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { origin: "https://attacker.example" },
      payload: {
        email: "candidate@example.com",
        displayName: "Candidate",
        password: "correct-horse-battery",
        acceptedTerms: true,
        acceptedPrivacy: true
      }
    });
    expect(crossOrigin.statusCode).toBe(403);

    const rejected = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { origin },
      payload: { email: "unknown@example.com", password: "correct-horse-battery" }
    });
    expect(rejected.statusCode).toBe(401);
    expect(rejected.json()).toEqual({ error: "E-mail ou senha inválidos." });
  });

  it("updates only the authenticated candidate's private profile", async () => {
    const store = new MemoryAuthStore();
    const app = await createAuthApp(store);
    const user = await store.createCandidate({
      email: "candidate@example.com",
      displayName: "Candidate",
      passwordHash: "unused"
    });
    user.status = "active";
    const sessionToken = "test-session-token-that-is-long-enough-123";
    await store.createSession({
      userId: user.id,
      tokenHash: tokenHash(sessionToken),
      expiresAt: new Date(Date.now() + 60_000)
    });

    const updated = await app.inject({
      method: "PATCH",
      url: "/api/v1/profile",
      headers: { origin, cookie: `platform_session=${sessionToken}` },
      payload: { headline: "Desenvolvedor em formação", isDiscoverable: false }
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().user.profile.headline).toBe("Desenvolvedor em formação");
    expect(updated.json().user.profile.isDiscoverable).toBe(false);
    expect(updated.json().user.passwordHash).toBeUndefined();
  });
});
