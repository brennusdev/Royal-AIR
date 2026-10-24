import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const prismaCli = resolve(repositoryRoot, "node_modules/prisma/build/index.js");
const environment = { ...process.env };

if (!environment.DATABASE_URL) {
  environment.DATABASE_URL = "postgresql://generate:generate@127.0.0.1:5432/generate?schema=public";
}

const result = spawnSync(process.execPath, [prismaCli, "generate"], {
  cwd: repositoryRoot,
  env: environment,
  stdio: "inherit"
});

if (result.error) {
  console.error("Failed to start Prisma Client generation.", result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
