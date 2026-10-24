import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../src/config.js";

const localDatabaseUrl = "postgresql://app:local_dev_password@localhost:5432/appdb?schema=public";

describe("environment configuration", () => {
  it("uses Vercel's deployment hostname as the preview origin when not overridden", () => {
    const environment = loadEnvironment({
      DATABASE_URL: localDatabaseUrl,
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      VERCEL_URL: "preview-platform.vercel.app",
      SMTP_URL: "smtp://mail.example:587",
      EMAIL_FROM: "preview@example.com"
    });
    expect(environment.WEB_ORIGIN).toBe("https://preview-platform.vercel.app");
    expect(environment.SESSION_COOKIE_SECURE).toBe(true);
  });

  it("rejects production settings with draft legal documents or missing email/origin", () => {
    expect(() => loadEnvironment({
      DATABASE_URL: localDatabaseUrl,
      NODE_ENV: "production"
    })).toThrow(/WEB_ORIGIN|SMTP_URL|EMAIL_FROM|TERMS_VERSION/);
  });

  it("keeps local development defaults usable without production services", () => {
    const environment = loadEnvironment({ DATABASE_URL: localDatabaseUrl });
    expect(environment.WEB_ORIGIN).toBe("http://localhost:5173");
    expect(environment.SESSION_COOKIE_SECURE).toBe(false);
  });
});
