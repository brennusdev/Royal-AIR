import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SMTP_URL: z.string().url().optional(),
  EMAIL_FROM: z.string().email().default("no-reply@example.invalid"),
  TERMS_VERSION: z.string().min(1).default("draft-v1"),
  PRIVACY_VERSION: z.string().min(1).default("draft-v1"),
  SESSION_COOKIE_SECURE: z.stringbool().optional()
}).transform((environment) => ({
  ...environment,
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
