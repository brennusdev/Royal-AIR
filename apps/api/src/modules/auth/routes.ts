import cookie from "@fastify/cookie";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const sessionCookieName = "platform_session";
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const verificationLifetimeMs = 24 * 60 * 60 * 1000;
const passwordResetLifetimeMs = 60 * 60 * 1000;
const scryptParameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, scryptParameters, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const registrationSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(2).max(80),
  password: z.string().min(12).max(128),
  acceptedTerms: z.literal(true),
  acceptedPrivacy: z.literal(true)
}).strict();
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128)
}).strict();
const tokenSchema = z.object({ token: z.string().min(32).max(256) }).strict();
const passwordResetSchema = tokenSchema.extend({ password: z.string().min(12).max(128) });
const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  headline: z.string().trim().max(240).nullable().optional(),
  region: z.string().trim().max(100).nullable().optional(),
  isDiscoverable: z.boolean().optional()
}).strict().refine((data) => Object.keys(data).length > 0);

export interface AccountRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  status: "active" | "pending" | "suspended" | "deleted";
  roles: string[];
  profile: {
    headline: string | null;
    region: string | null;
    isDiscoverable: boolean;
  } | null;
}

export interface AuthenticatedSession {
  id: string;
  user: AccountRecord;
}

export interface AuthStore {
  findUserByEmail(email: string): Promise<AccountRecord | null>;
  createCandidate(input: {
    email: string;
    displayName: string;
    passwordHash: string;
    termsVersion: string;
    privacyVersion: string;
  }): Promise<AccountRecord>;
  createEmailActionToken(input: {
    userId: string;
    tokenHash: string;
    purpose: "verify_email" | "reset_password";
    expiresAt: Date;
  }): Promise<void>;
  consumeEmailActionToken(input: {
    tokenHash: string;
    purpose: "verify_email" | "reset_password";
    passwordHash?: string;
  }): Promise<boolean>;
  createSession(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findSession(tokenHash: string): Promise<AuthenticatedSession | null>;
  revokeSession(id: string): Promise<void>;
  updateProfile(userId: string, changes: z.infer<typeof profileSchema>): Promise<AccountRecord>;
}

export interface Mailer {
  send(input: { to: string; subject: string; text: string }): Promise<void>;
}

export interface AuthOptions {
  store: AuthStore;
  mailer?: Mailer;
  webOrigin: string;
  termsVersion: string;
  privacyVersion: string;
  cookieSecure: boolean;
}

const sessionToken = (): string => randomBytes(32).toString("base64url");
const tokenHash = (value: string): string => createHash("sha256").update(value).digest("hex");

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, 64);
  return `scrypt$${scryptParameters.N}$${scryptParameters.r}$${scryptParameters.p}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, nValue, rValue, pValue, saltValue, keyValue] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    nValue !== String(scryptParameters.N) ||
    rValue !== String(scryptParameters.r) ||
    pValue !== String(scryptParameters.p) ||
    !saltValue ||
    !keyValue
  ) {
    return false;
  }

  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(keyValue, "base64url");
  if (salt.length !== 16 || expected.length !== 64) {
    return false;
  }

  const actual = await deriveKey(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

const dummyPasswordHash = hashPassword(randomBytes(32).toString("hex"));

function accountResponse(account: AccountRecord) {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    roles: account.roles,
    status: account.status,
    profile: account.profile
  };
}

export function requireSameOrigin(webOrigin: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (request.headers.origin !== webOrigin) {
      await reply.code(403).send({ error: "Request origin is not allowed." });
    }
  };
}

export async function getAuthenticatedSession(
  request: FastifyRequest,
  store: AuthStore
): Promise<AuthenticatedSession | null> {
  const token = request.cookies[sessionCookieName];
  if (!token) {
    return null;
  }

  return store.findSession(tokenHash(token));
}

function setSessionCookie(
  reply: FastifyReply,
  token: string,
  secure: boolean
): void {
  reply.setCookie(sessionCookieName, token, {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: Math.floor(sessionLifetimeMs / 1000)
  });
}

function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.clearCookie(sessionCookieName, {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax"
  });
}

export async function registerAuthRoutes(app: FastifyInstance, options: AuthOptions): Promise<void> {
  await app.register(cookie);
  const sameOrigin = requireSameOrigin(options.webOrigin);

  app.post("/api/v1/auth/register", {
    preHandler: sameOrigin,
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const input = registrationSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const existing = await options.store.findUserByEmail(input.email);
    const account = existing ?? await options.store.createCandidate({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
      termsVersion: options.termsVersion,
      privacyVersion: options.privacyVersion
    });

    if (account.status === "pending") {
      const token = sessionToken();
      await options.store.createEmailActionToken({
        userId: account.id,
        tokenHash: tokenHash(token),
        purpose: "verify_email",
        expiresAt: new Date(Date.now() + verificationLifetimeMs)
      });

      if (!options.mailer) {
        request.log.error("Email verification requested but SMTP is not configured");
      } else {
        try {
          await options.mailer.send({
            to: account.email,
            subject: "Confirme seu e-mail",
            text: `Use este link para confirmar sua conta: ${options.webOrigin}/?action=verify&token=${encodeURIComponent(token)}`
          });
        } catch (error) {
          request.log.error({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Verification email delivery failed");
        }
      }
    }

    return reply.code(202).send({
      message: "Se o cadastro puder prosseguir, enviaremos instruções para o e-mail informado."
    });
  });

  app.post("/api/v1/auth/verify-email", {
    preHandler: sameOrigin,
    config: { rateLimit: { max: 10, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const { token } = tokenSchema.parse(request.body);
    const verified = await options.store.consumeEmailActionToken({
      tokenHash: tokenHash(token),
      purpose: "verify_email"
    });
    if (!verified) {
      return reply.code(400).send({ error: "Verification link is invalid or expired." });
    }

    return reply.code(200).send({ message: "E-mail confirmado. Você já pode entrar." });
  });

  app.post("/api/v1/auth/login", {
    preHandler: sameOrigin,
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const account = await options.store.findUserByEmail(input.email);
    const storedHash = account?.passwordHash ?? await dummyPasswordHash;
    const passwordMatches = await verifyPassword(input.password, storedHash);

    if (
      !account ||
      account.status !== "active" ||
      !account.passwordHash ||
      !passwordMatches
    ) {
      return reply.code(401).send({ error: "E-mail ou senha inválidos." });
    }

    const token = sessionToken();
    await options.store.createSession({
      userId: account.id,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + sessionLifetimeMs)
    });
    setSessionCookie(reply, token, options.cookieSecure);
    return reply.code(200).send({ user: accountResponse(account) });
  });

  app.post("/api/v1/auth/logout", {
    preHandler: sameOrigin
  }, async (request, reply) => {
    const session = await getAuthenticatedSession(request, options.store);
    if (session) {
      await options.store.revokeSession(session.id);
    }
    clearSessionCookie(reply, options.cookieSecure);
    return reply.code(204).send();
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    const session = await getAuthenticatedSession(request, options.store);
    if (!session) {
      return reply.code(401).send({ error: "Authentication required." });
    }

    return reply.code(200).send({ user: accountResponse(session.user) });
  });

  app.patch("/api/v1/profile", {
    preHandler: sameOrigin
  }, async (request, reply) => {
    const session = await getAuthenticatedSession(request, options.store);
    if (!session) {
      return reply.code(401).send({ error: "Authentication required." });
    }
    if (!session.user.roles.includes("candidate")) {
      return reply.code(403).send({ error: "Candidate role required." });
    }

    const changes = profileSchema.parse(request.body);
    const account = await options.store.updateProfile(session.user.id, changes);
    return reply.code(200).send({ user: accountResponse(account) });
  });

  app.post("/api/v1/auth/password/forgot", {
    preHandler: sameOrigin,
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const { email } = z.object({ email: emailSchema }).strict().parse(request.body);
    const account = await options.store.findUserByEmail(email);

    if (account?.status === "active" && account.passwordHash && options.mailer) {
      const token = sessionToken();
      await options.store.createEmailActionToken({
        userId: account.id,
        tokenHash: tokenHash(token),
        purpose: "reset_password",
        expiresAt: new Date(Date.now() + passwordResetLifetimeMs)
      });

      try {
        await options.mailer.send({
          to: account.email,
          subject: "Redefina sua senha",
          text: `Use este link para redefinir sua senha: ${options.webOrigin}/?action=reset-password&token=${encodeURIComponent(token)}`
        });
      } catch (error) {
        request.log.error({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Password reset email delivery failed");
      }
    } else if (account?.status === "active" && !options.mailer) {
      request.log.error("Password reset requested but SMTP is not configured");
    }

    return reply.code(202).send({
      message: "Se houver uma conta elegível para esse endereço, enviaremos instruções."
    });
  });

  app.post("/api/v1/auth/password/reset", {
    preHandler: sameOrigin,
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } }
  }, async (request, reply) => {
    const input = passwordResetSchema.parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const reset = await options.store.consumeEmailActionToken({
      tokenHash: tokenHash(input.token),
      purpose: "reset_password",
      passwordHash
    });
    if (!reset) {
      return reply.code(400).send({ error: "Password reset link is invalid or expired." });
    }

    return reply.code(200).send({ message: "Senha atualizada. Entre novamente." });
  });
}

export { hashPassword, tokenHash, verifyPassword };
