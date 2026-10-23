import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { healthResponseSchema } from "@platform/shared";
import { registerAuthRoutes, type AuthOptions } from "./auth.js";

export interface AppOptions {
  webOrigin: string;
  checkDatabase: () => Promise<void>;
  auth?: AuthOptions;
  logLevel?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
}

export async function createApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: options.logLevel ?? "info" } });

  await app.register(helmet);
  await app.register(cors, { origin: options.webOrigin, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "Request validation failed." });
    }

    request.log.error({ err: error }, "Unhandled API error");
    return reply.code(500).send({ error: "Internal server error." });
  });

  if (options.auth) {
    await registerAuthRoutes(app, options.auth);
  }

  app.get("/api/v1/health", async () =>
    healthResponseSchema.parse({ status: "ok", service: "api" })
  );

  app.get("/api/v1/health/ready", async (request, reply) => {
    try {
      await options.checkDatabase();
    } catch (error) {
      request.log.error({ err: error }, "Database readiness check failed");
      return reply.code(503).send({ status: "unavailable", service: "database" });
    }

    return healthResponseSchema.parse({ status: "ok", service: "api" });
  });

  app.get("/api/v1/openapi.json", async () => ({
    openapi: "3.1.0",
    info: {
      title: "Skills Evidence Platform API",
      version: "0.1.0",
      description: "API for the skills evidence platform."
    },
    paths: {
      "/api/v1/health": {
        get: {
          operationId: "getHealth",
          summary: "Check API liveness",
          responses: {
            "200": {
              description: "The API process is responding.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["status", "service"],
                    properties: {
                      status: { const: "ok" },
                      service: { const: "api" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/v1/health/ready": {
        get: {
          operationId: "getReadiness",
          summary: "Check API and database readiness",
          responses: {
            "200": { description: "The API and database are ready." },
            "503": { description: "A required dependency is unavailable." }
          }
        }
      },
      "/api/v1/auth/register": {
        post: {
          operationId: "registerCandidate",
          summary: "Create a pending candidate account and send email verification",
          responses: {
            "202": { description: "A generic verification response." },
            "400": { description: "The request is invalid." }
          }
        }
      },
      "/api/v1/auth/verify-email": {
        post: {
          operationId: "verifyEmail",
          summary: "Verify an account email address",
          responses: {
            "200": { description: "The email address was verified." },
            "400": { description: "The token is invalid or expired." }
          }
        }
      },
      "/api/v1/auth/login": {
        post: {
          operationId: "login",
          summary: "Create an authenticated session",
          responses: {
            "200": { description: "The session cookie was set." },
            "401": { description: "Credentials are invalid or the account is not active." }
          }
        }
      },
      "/api/v1/auth/logout": {
        post: {
          operationId: "logout",
          summary: "Revoke the current session",
          responses: { "204": { description: "The session was revoked." } }
        }
      },
      "/api/v1/auth/me": {
        get: {
          operationId: "getCurrentAccount",
          summary: "Get the authenticated account and private profile",
          responses: {
            "200": { description: "The current account." },
            "401": { description: "Authentication is required." }
          }
        }
      },
      "/api/v1/auth/password/forgot": {
        post: {
          operationId: "requestPasswordReset",
          summary: "Request password reset instructions",
          responses: { "202": { description: "A generic response that does not reveal account existence." } }
        }
      },
      "/api/v1/auth/password/reset": {
        post: {
          operationId: "resetPassword",
          summary: "Reset a password using a one-time email token",
          responses: {
            "200": { description: "The password was updated and sessions revoked." },
            "400": { description: "The token is invalid or expired." }
          }
        }
      },
      "/api/v1/profile": {
        patch: {
          operationId: "updateCandidateProfile",
          summary: "Update the authenticated candidate's private profile",
          responses: {
            "200": { description: "The candidate profile was updated." },
            "401": { description: "Authentication is required." },
            "403": { description: "Candidate role is required." }
          }
        }
      }
    }
  }));

  return app;
}
