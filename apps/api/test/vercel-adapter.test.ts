import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";
import {
  handleVercelApiRequest,
  resolveVercelApiPath
} from "../src/vercel-adapter.js";

const apps: FastifyInstance[] = [];

async function createTestApp(): Promise<FastifyInstance> {
  const app = await createApp({
    webOrigin: "https://platform.example",
    logLevel: "silent",
    checkDatabase: async () => undefined
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Vercel API adapter", () => {
  it("resolves only rewritten API paths and preserves their query strings", () => {
    expect(resolveVercelApiPath(
      "https://platform.example/api?__api_path=%2Fapi%2Fv1%2Fhealth&check=1"
    )).toBe("/api/v1/health?check=1");
    expect(resolveVercelApiPath("https://platform.example/api")).toBeNull();
    expect(resolveVercelApiPath(
      "https://platform.example/api?__api_path=%2Fprivate%2Fdata"
    )).toBeNull();
  });

  it("forwards health requests and API response headers through Fastify", async () => {
    const app = await createTestApp();
    const apiPath = resolveVercelApiPath(
      "https://platform.example/api?__api_path=%2Fapi%2Fv1%2Fhealth"
    );
    expect(apiPath).not.toBeNull();
    const response = await handleVercelApiRequest(
      app,
      new Request("https://platform.example/api?__api_path=%2Fapi%2Fv1%2Fhealth"),
      apiPath!
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok", service: "api" });
  });

  it("rejects oversized request bodies before invoking application routes", async () => {
    const app = await createTestApp();
    const response = await handleVercelApiRequest(
      app,
      new Request("https://platform.example/api", {
        method: "POST",
        headers: { "content-length": "1048577" },
        body: "{}"
      }),
      "/api/v1/health"
    );
    expect(response.status).toBe(413);
  });
});
