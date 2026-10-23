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

export type UserRole = z.infer<typeof userRoleSchema>;
export type CompetencyLevel = z.infer<typeof competencyLevelSchema>;
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;
export type AccountSummary = z.infer<typeof accountSummarySchema>;

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
