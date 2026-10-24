import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  SMTP_URL: z.string().url().optional(),
  EMAIL_FROM: z.string().email().optional(),
  TERMS_VERSION: z.string().min(1).default("draft-v1"),
  PRIVACY_VERSION: z.string().min(1).default("draft-v1"),
  SESSION_COOKIE_SECURE: z.stringbool().optional()
}).superRefine((environment, context) => {
  const isProductionDeployment = environment.VERCEL_ENV
    ? environment.VERCEL_ENV === "production"
    : environment.NODE_ENV === "production";
  if (environment.NODE_ENV === "production" && !environment.SMTP_URL) {
    context.addIssue({
      code: "custom",
      path: ["SMTP_URL"],
      message: "SMTP_URL must be configured for deployment account verification and recovery."
    });
  }
  if (
    environment.NODE_ENV === "production" &&
    (!environment.EMAIL_FROM || environment.EMAIL_FROM.endsWith(".invalid"))
  ) {
    context.addIssue({
      code: "custom",
      path: ["EMAIL_FROM"],
      message: "EMAIL_FROM must be a verified sender address for deployments."
    });
  }
  if (isProductionDeployment) {
    if (!environment.WEB_ORIGIN) {
      context.addIssue({
        code: "custom",
        path: ["WEB_ORIGIN"],
        message: "WEB_ORIGIN must be explicitly configured for production."
      });
    }
    if (environment.TERMS_VERSION.startsWith("draft") || environment.PRIVACY_VERSION.startsWith("draft")) {
      context.addIssue({
        code: "custom",
        path: ["TERMS_VERSION"],
        message: "Production requires reviewed terms and privacy notice versions."
      });
    }
  }
  if (environment.NODE_ENV === "production" && environment.SESSION_COOKIE_SECURE === false) {
    context.addIssue({
      code: "custom",
      path: ["SESSION_COOKIE_SECURE"],
      message: "Session cookies must use Secure in deployments."
    });
  }
}).transform((environment) => ({
  ...environment,
  API_HOST: environment.API_HOST ?? "127.0.0.1",
  WEB_ORIGIN: environment.WEB_ORIGIN
    ?? (environment.VERCEL_URL ? `https://${environment.VERCEL_URL}` : "http://localhost:5173"),
  LOG_LEVEL: environment.LOG_LEVEL ?? "info",
  EMAIL_FROM: environment.EMAIL_FROM ?? "no-reply@example.invalid",
  SESSION_COOKIE_SECURE: environment.SESSION_COOKIE_SECURE ?? environment.NODE_ENV === "production"
}));

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(environment: NodeJS.ProcessEnv = process.env): Environment {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}
