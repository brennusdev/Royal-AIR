import type { PrismaClient } from "./generated/prisma/client.js";
import type {
  AccountRecord,
  AuthStore,
  AuthenticatedSession
} from "./auth.js";

const accountInclude = {
  roles: { select: { role: true } },
  candidateProfile: {
    select: {
      headline: true,
      region: true,
      isDiscoverable: true
    }
  }
} as const;

function toAccount(user: {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  status: "active" | "pending" | "suspended" | "deleted";
  roles: Array<{ role: string }>;
  candidateProfile: AccountRecord["profile"];
}): AccountRecord {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    passwordHash: user.passwordHash,
    status: user.status,
    roles: user.roles.map(({ role }) => role),
    profile: user.candidateProfile
  };
}

type ProfileChanges = {
  displayName?: string;
  headline?: string | null;
  region?: string | null;
  isDiscoverable?: boolean;
};

export function createPrismaAuthStore(prisma: PrismaClient): AuthStore {
  return {
    async findUserByEmail(email) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: accountInclude
      });
      return user ? toAccount(user) : null;
    },

    async createCandidate(input) {
      const user = await prisma.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash: input.passwordHash,
          status: "pending",
          roles: { create: { role: "candidate" } },
          candidateProfile: { create: {} },
          consentRecords: {
            create: [
              { type: "terms_of_service", version: input.termsVersion },
              { type: "privacy_notice", version: input.privacyVersion }
            ]
          }
        },
        include: accountInclude
      });
      return toAccount(user);
    },

    async createEmailActionToken(input) {
      await prisma.$transaction(async (transaction) => {
        await transaction.emailActionToken.updateMany({
          where: {
            userId: input.userId,
            purpose: input.purpose,
            consumedAt: null
          },
          data: { consumedAt: new Date() }
        });
        await transaction.emailActionToken.create({ data: input });
      });
    },

    async consumeEmailActionToken(input) {
      return prisma.$transaction(async (transaction) => {
        const now = new Date();
        const action = await transaction.emailActionToken.findFirst({
          where: {
            tokenHash: input.tokenHash,
            purpose: input.purpose,
            consumedAt: null,
            expiresAt: { gt: now }
          }
        });
        if (!action) {
          return false;
        }

        const consumed = await transaction.emailActionToken.updateMany({
          where: {
            id: action.id,
            consumedAt: null,
            expiresAt: { gt: now }
          },
          data: { consumedAt: now }
        });
        if (consumed.count !== 1) {
          return false;
        }

        if (input.purpose === "verify_email") {
          const verified = await transaction.user.updateMany({
            where: { id: action.userId, status: "pending" },
            data: { status: "active" }
          });
          if (verified.count !== 1) {
            return false;
          }
        } else if (input.passwordHash) {
          await transaction.user.update({
            where: { id: action.userId },
            data: { passwordHash: input.passwordHash }
          });
          await transaction.session.updateMany({
            where: { userId: action.userId, revokedAt: null },
            data: { revokedAt: now }
          });
        } else {
          throw new Error("Password hash is required for a password reset.");
        }

        return true;
      });
    },

    async createSession(input) {
      await prisma.session.deleteMany({
        where: { userId: input.userId, expiresAt: { lte: new Date() } }
      });
      await prisma.session.create({ data: input });
    },

    async findSession(sessionTokenHash): Promise<AuthenticatedSession | null> {
      const session = await prisma.session.findFirst({
        where: {
          tokenHash: sessionTokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: { status: "active" }
        },
        include: { user: { include: accountInclude } }
      });

      return session
        ? { id: session.id, user: toAccount(session.user) }
        : null;
    },

    async revokeSession(id) {
      await prisma.session.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    },

    async updateProfile(userId, changes: ProfileChanges) {
      const { displayName, ...profileChanges } = changes;
      const user = await prisma.$transaction(async (transaction) => {
        if (displayName !== undefined) {
          await transaction.user.update({
            where: { id: userId },
            data: { displayName }
          });
        }
        if (Object.keys(profileChanges).length > 0) {
          await transaction.candidateProfile.update({
            where: { userId },
            data: profileChanges
          });
        }

        return transaction.user.findUniqueOrThrow({
          where: { id: userId },
          include: accountInclude
        });
      });

      return toAccount(user);
    }
  };
}
