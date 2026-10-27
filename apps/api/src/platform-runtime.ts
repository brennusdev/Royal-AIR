import { PrismaPg } from "@prisma/adapter-pg";
import { createTransport } from "nodemailer";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "./generated/prisma/client.js";
import { PrismaClient as PrismaClientConstructor } from "./generated/prisma/client.js";
import { createApp } from "./app.js";
import type { Environment } from "./config.js";
import { createPrismaAuthStore } from "./modules/auth/prisma-store.js";
import { createPrismaLearningPathStore } from "./modules/learning-paths/prisma-store.js";
import { createPrismaPortfolioEvidenceStore } from "./modules/portfolio-evidence/prisma-store.js";
import { createPrismaChallengeStore } from "./modules/challenges/prisma-store.js";

export interface PlatformRuntime {
  app: FastifyInstance;
  prisma: PrismaClient;
}

export async function createPlatformRuntime(environment: Environment): Promise<PlatformRuntime> {
  const adapter = new PrismaPg({ connectionString: environment.DATABASE_URL });
  const prisma = new PrismaClientConstructor({ adapter });
  const transport = environment.SMTP_URL
    ? createTransport(environment.SMTP_URL)
    : undefined;
  const app = await createApp({
    webOrigin: environment.WEB_ORIGIN,
    logLevel: environment.LOG_LEVEL,
    auth: {
      store: createPrismaAuthStore(prisma),
      ...(transport
        ? {
            mailer: {
              send: async (message: { to: string; subject: string; text: string }) => {
                await transport.sendMail({ from: environment.EMAIL_FROM, ...message });
              }
            }
          }
        : {}),
      webOrigin: environment.WEB_ORIGIN,
      termsVersion: environment.TERMS_VERSION,
      privacyVersion: environment.PRIVACY_VERSION,
      cookieSecure: environment.SESSION_COOKIE_SECURE
    },
    learningPaths: createPrismaLearningPathStore(prisma),
    portfolioEvidence: createPrismaPortfolioEvidenceStore(prisma),
    challenges: createPrismaChallengeStore(prisma),
    checkDatabase: async () => {
      await prisma.$queryRaw`SELECT 1`;
    }
  });
  await app.ready();
  return { app, prisma };
}
