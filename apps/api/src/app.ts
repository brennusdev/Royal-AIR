import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { healthResponseSchema } from "@platform/shared";
import { registerAuthRoutes, type AuthOptions } from "./modules/auth/routes.js";
import {
  registerLearningPathRoutes,
  type LearningPathStore
} from "./modules/learning-paths/routes.js";
import {
  registerPortfolioEvidenceRoutes,
  type PortfolioEvidenceStore
} from "./modules/portfolio-evidence/routes.js";
import { registerChallengeRoutes, type ChallengeStore } from "./modules/challenges/routes.js";

export interface AppOptions {
  webOrigin: string;
  checkDatabase: () => Promise<void>;
  auth?: AuthOptions;
  learningPaths?: LearningPathStore;
  portfolioEvidence?: PortfolioEvidenceStore;
  challenges?: ChallengeStore;
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
    if (options.learningPaths) {
      await registerLearningPathRoutes(app, {
        authStore: options.auth.store,
        pathStore: options.learningPaths,
        webOrigin: options.webOrigin
      });
    }
    if (options.portfolioEvidence) {
      await registerPortfolioEvidenceRoutes(app, {
        authStore: options.auth.store,
        evidenceStore: options.portfolioEvidence,
        webOrigin: options.webOrigin
      });
    }
    if (options.challenges) {
      await registerChallengeRoutes(app, {
        authStore: options.auth.store,
        challengeStore: options.challenges,
        webOrigin: options.webOrigin
      });
    }
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
      },
      "/api/v1/learning-paths": {
        get: {
          operationId: "listLearningPaths",
          summary: "List published, curated learning paths",
          responses: { "200": { description: "Available learning paths and ordered study stages." } }
        }
      },
      "/api/v1/my-learning-plan": {
        get: {
          operationId: "getCurrentLearningPlan",
          summary: "Get the authenticated candidate's active learning plan",
          responses: {
            "200": { description: "The active plan, or null when none is selected." },
            "401": { description: "Authentication is required." }
          }
        },
        post: {
          operationId: "selectLearningPlan",
          summary: "Select or resume a curated path as the active plan",
          responses: {
            "200": { description: "The selected learning plan and its progress." },
            "401": { description: "Authentication is required." },
            "404": { description: "The published learning path was not found." }
          }
        }
      },
      "/api/v1/my-learning-plan/stages/{stageId}": {
        patch: {
          operationId: "updateLearningStage",
          summary: "Mark the next recommended stage as in progress or studied",
          responses: {
            "200": { description: "Updated progress and next recommendation." },
            "401": { description: "Authentication is required." },
            "409": { description: "An earlier stage must be completed first." }
          }
        },
        },
        "/api/v1/challenges": {
          get: {
            operationId: "listPublishedChallenges",
            summary: "List published challenges with their acceptance and rubric criteria",
            responses: { "200": { description: "Published challenges available to candidates." } }
          }
        },
        "/api/v1/challenges/{challengeId}/attempts": {
          post: {
            operationId: "startChallengeAttempt",
            summary: "Start or resume the candidate's attempt for a published challenge",
            responses: {
              "200": { description: "The candidate's attempt." },
              "401": { description: "Authentication is required." },
              "404": { description: "The published challenge was not found." }
            }
          }
        },
        "/api/v1/my/challenge-attempts": {
          get: {
            operationId: "listMyChallengeAttempts",
            summary: "List attempts owned by the authenticated candidate",
            responses: {
              "200": { description: "Only the candidate's own attempts." },
              "401": { description: "Authentication is required." }
            }
          }
        },
        "/api/v1/my/challenge-attempts/{attemptId}": {
          patch: {
            operationId: "saveChallengeDraft",
            summary: "Save a draft for an in-progress candidate attempt",
            responses: {
              "200": { description: "The saved draft." },
              "401": { description: "Authentication is required." },
              "404": { description: "The editable attempt was not found for this candidate." }
            }
          }
        },
        "/api/v1/my/challenge-attempts/{attemptId}/submit": {
          post: {
            operationId: "submitChallengeAttempt",
            summary: "Submit a saved challenge draft",
            responses: {
              "200": { description: "The submitted attempt." },
              "401": { description: "Authentication is required." },
              "409": { description: "The draft is incomplete or the attempt is no longer editable." }
            }
          }
        },
        "/api/v1/my/evidence": {
          get: {
            operationId: "listMyEvidence",
            summary: "List the authenticated candidate's private, self-reported evidence",
            responses: {
              "200": { description: "Evidence belonging only to the authenticated candidate." },
              "401": { description: "Authentication is required." },
              "403": { description: "Candidate role is required." }
            }
          },
          post: {
            operationId: "createMyEvidence",
            summary: "Add a private, self-reported portfolio evidence entry",
            responses: {
              "201": { description: "The private evidence entry was created." },
              "400": { description: "The request is invalid." },
              "401": { description: "Authentication is required." }
            }
          }
        },
        "/api/v1/my/evidence/{evidenceId}": {
          delete: {
            operationId: "deleteMyEvidence",
            summary: "Delete one of the authenticated candidate's private evidence entries",
            responses: {
              "204": { description: "The evidence entry was deleted." },
              "401": { description: "Authentication is required." },
              "404": { description: "The evidence entry was not found for this candidate." }
            }
          }
        }
      }
    }
  ));

  return app;
}
