import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/api/src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the development database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl })
});

const competencies = [
  {
    slug: "web-apis",
    title: "APIs web",
    description: "Fundamentos de interfaces HTTP e serviços web."
  },
  {
    slug: "relational-data",
    title: "Dados relacionais",
    description: "Modelagem de entidades e relações em bancos relacionais."
  },
  {
    slug: "automated-testing",
    title: "Testes automatizados",
    description: "Princípios de verificação automatizada de software."
  }
] as const;

async function seed(): Promise<void> {
  const versions: Array<{ id: string }> = [];

  for (const competency of competencies) {
    const record = await prisma.competency.upsert({
      where: { slug: competency.slug },
      create: {
        ...competency,
        versions: {
          create: {
            version: 1,
            title: competency.title,
            description: competency.description
          }
        }
      },
      update: { title: competency.title, description: competency.description }
    });

    const version = await prisma.competencyVersion.upsert({
      where: {
        competencyId_version: { competencyId: record.id, version: 1 }
      },
      create: {
        competencyId: record.id,
        version: 1,
        title: competency.title,
        description: competency.description
      },
      update: {
        title: competency.title,
        description: competency.description
      }
    });
    versions.push(version);
  }

  const path = await prisma.learningPath.upsert({
    where: { slug: "backend-foundations" },
    create: {
      slug: "backend-foundations",
      title: "Fundamentos de backend",
      description: "Trilha fictícia de demonstração para o catálogo inicial.",
      status: "published"
    },
    update: {
      title: "Fundamentos de backend",
      description: "Trilha fictícia de demonstração para o catálogo inicial.",
      status: "published"
    }
  });

  for (const [index, version] of versions.entries()) {
    await prisma.learningPathCompetency.upsert({
      where: {
        learningPathId_competencyVersionId: {
          learningPathId: path.id,
          competencyVersionId: version.id
        }
      },
      create: {
        learningPathId: path.id,
        competencyVersionId: version.id,
        position: index + 1
      },
      update: { position: index + 1 }
    });
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Development seed failed", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
