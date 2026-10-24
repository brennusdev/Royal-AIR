import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";

const apps: FastifyInstance[] = [];

async function createTestApp(checkDatabase: () => Promise<void>): Promise<FastifyInstance> {
  const app = await createApp({
    webOrigin: "http://localhost:5173",
    checkDatabase,
    logLevel: "silent"
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("API foundation routes", () => {
  it("returns a liveness response", async () => {
    const app = await createTestApp(async () => undefined);
    const response = await app.inject("/api/v1/health");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "api" });
  });

  it("checks database readiness", async () => {
    const app = await createTestApp(async () => undefined);
    const response = await app.inject("/api/v1/health/ready");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "api" });
  });

  it("returns unavailable and logs a failed dependency check", async () => {
    const app = await createTestApp(() => Promise.reject(new Error("database unavailable")));
    const response = await app.inject("/api/v1/health/ready");

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "unavailable", service: "database" });
  });

  it("publishes an OpenAPI document", async () => {
    const app = await createTestApp(async () => undefined);
    const response = await app.inject("/api/v1/openapi.json");

    expect(response.statusCode).toBe(200);
    expect(response.json().openapi).toBe("3.1.0");
    expect(response.json().paths["/api/v1/health/ready"]).toBeDefined();
    expect(response.json().paths["/api/v1/auth/login"]).toBeDefined();
    expect(response.json().paths["/api/v1/challenges"]).toBeDefined();
    expect(response.json().paths["/api/v1/my/challenge-attempts"]).toBeDefined();
  });
});
