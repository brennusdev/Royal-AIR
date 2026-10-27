import type { PortfolioEvidence } from "@platform/shared";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { PortfolioEvidenceStore } from "./routes.js";

function toPortfolioEvidence(record: {
  id: string;
  title: string;
  description: string;
  url: string | null;
  status: PortfolioEvidence["status"];
  createdAt: Date;
}): PortfolioEvidence {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    url: record.url,
    status: record.status,
    createdAt: record.createdAt.toISOString()
  };
}

export function createPrismaPortfolioEvidenceStore(
  prisma: PrismaClient
): PortfolioEvidenceStore {
  return {
    async listForCandidate(userId) {
      const records = await prisma.portfolioEvidence.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      });
      return records.map(toPortfolioEvidence);
    },

    async createForCandidate(userId, input) {
      const record = await prisma.portfolioEvidence.create({
        data: { ...input, userId, status: "self_reported" }
      });
      return toPortfolioEvidence(record);
    },

    async deleteForCandidate(userId, evidenceId) {
      const result = await prisma.portfolioEvidence.deleteMany({
        where: { id: evidenceId, userId }
      });
      return result.count === 1;
    }
  };
}
