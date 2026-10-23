import { PrismaPg } from "@prisma/adapter-pg";
import { createTransport } from "nodemailer";
import { resolve } from "node:path";
import { config as loadEnvironmentFile } from "dotenv";
import { PrismaClient } from "./generated/prisma/client.js";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config.js";
import { createPrismaAuthStore } from "./prisma-auth-store.js";

loadEnvironmentFile({ path: resolve(process.cwd(), "../../.env") });

async function start(): Promise<void> {
  const environment = loadEnvironment();
  const adapter = new PrismaPg({ connectionString: environment.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
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
    checkDatabase: async () => {
      await prisma.$queryRaw`SELECT 1`;
    }
  });

  try {
    await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
  } catch (error) {
    app.log.error({ err: error }, "API failed to start");
    await app.close();
    await prisma.$disconnect();
    throw error;
  }

  const shutdown = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, "Shutting down API");
    void app.close()
      .then(() => prisma.$disconnect())
      .catch((error: unknown) => {
        app.log.error({ err: error }, "API shutdown failed");
        process.exitCode = 1;
      });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void start().catch((error: unknown) => {
  console.error("API startup failed", error);
  process.exitCode = 1;
});
