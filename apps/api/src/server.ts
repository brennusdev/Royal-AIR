import { resolve } from "node:path";
import { config as loadEnvironmentFile } from "dotenv";
import { loadEnvironment } from "./config.js";
import { createPlatformRuntime } from "./platform-runtime.js";

loadEnvironmentFile({ path: resolve(process.cwd(), "../../.env") });

async function start(): Promise<void> {
  const environment = loadEnvironment();
  const { app, prisma } = await createPlatformRuntime(environment);

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
