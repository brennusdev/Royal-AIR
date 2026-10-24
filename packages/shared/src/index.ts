import { z } from "zod";

export const userRoleSchema = z.enum([
  "candidate",
  "reviewer",
  "recruiter",
  "organization_admin",
  "platform_admin"
]);

export const competencyLevelSchema = z.enum([
  "not_assessed",
  "foundation",
  "developing",
  "demonstrated",
  "strong_evidence"
]);

export const evidenceStatusSchema = z.enum([
  "self_reported",
  "pending",
  "reviewed",
  "contested",
  "revoked"
]);

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api")
});

export const accountSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  roles: z.array(userRoleSchema),
  status: z.enum(["active", "pending", "suspended", "deleted"]),
  profile: z.object({
    headline: z.string().nullable(),
    region: z.string().nullable(),
    isDiscoverable: z.boolean()
  }).nullable()
});

export const learningPathStageSchema = z.object({
  id: z.string(),
  position: z.number().int().positive(),
  competency: z.object({
    slug: z.string(),
    title: z.string(),
    description: z.string()
  }),
  whyThisStep: z.string(),
  practiceTask: z.string(),
  estimatedMinutes: z.number().int().positive(),
  resourceTitle: z.string().nullable(),
  resourceUrl: z.string().url().nullable(),
  status: z.enum(["not_started", "in_progress", "studied"])
});

export const learningPathSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  targetRole: z.string(),
  outcome: z.string(),
  estimatedMinutes: z.number().int().nonnegative(),
  stages: z.array(learningPathStageSchema)
});

export const learningPlanSchema = z.object({
  id: z.string(),
  status: z.enum(["active", "paused", "completed"]),
  progressPercent: z.number().int().min(0).max(100),
  completedStages: z.number().int().nonnegative(),
  totalStages: z.number().int().nonnegative(),
  nextStageId: z.string().nullable(),
  recommendationReason: z.string(),
  path: learningPathSchema
});

export const portfolioEvidenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  url: z.string().url().nullable(),
  status: evidenceStatusSchema,
  createdAt: z.string().datetime()
});

export const challengeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  context: z.string(),
  description: z.string(),
  difficulty: z.string(),
  estimatedMinutes: z.number().int().positive(),
  version: z.number().int().positive(),
  acceptanceCriteria: z.array(z.string()),
  rubricCriteria: z.array(z.string())
});

export const challengeAttemptSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  challengeTitle: z.string(),
  challengeVersion: z.number().int().positive(),
  status: z.enum(["in_progress", "submitted"]),
  approach: z.string().nullable(),
  submissionUrl: z.string().url().nullable(),
  startedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime()
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type CompetencyLevel = z.infer<typeof competencyLevelSchema>;
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;
export type AccountSummary = z.infer<typeof accountSummarySchema>;
export type LearningPath = z.infer<typeof learningPathSchema>;
export type LearningPlan = z.infer<typeof learningPlanSchema>;
export type LearningStepStatus = z.infer<typeof learningPathStageSchema>["status"];
export type PortfolioEvidence = z.infer<typeof portfolioEvidenceSchema>;
export type Challenge = z.infer<typeof challengeSchema>;
export type ChallengeAttempt = z.infer<typeof challengeAttemptSchema>;

export interface CompetencyEvidence {
  slug: string;
  status: EvidenceStatus;
  level: CompetencyLevel;
}

export interface CompetencyMatchResult {
  demonstrated: string[];
  notDemonstrated: string[];
  note: string;
}

export function compareCompetencyEvidence(
  requiredCompetencies: readonly string[],
  evidence: readonly CompetencyEvidence[]
): CompetencyMatchResult {
  const assessed = new Map(
    evidence
      .filter((item) => item.status === "reviewed")
      .map((item) => [item.slug, item.level])
  );
  const uniqueRequirements = [...new Set(requiredCompetencies)];
  const demonstrated = uniqueRequirements.filter((slug) => {
    const level = assessed.get(slug);
    return level === "demonstrated" || level === "strong_evidence";
  });

  return {
    demonstrated,
    notDemonstrated: uniqueRequirements.filter((slug) => !demonstrated.includes(slug)),
    note: "Correspondência explicável de evidências revisadas; itens sem evidência não indicam falta de capacidade."
  };
}
