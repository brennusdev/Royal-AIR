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
  },
  {
    slug: "web-foundations",
    title: "Fundamentos da web",
    description: "HTML semântico, CSS e funcionamento básico dos navegadores."
  },
  {
    slug: "react-fundamentals",
    title: "Fundamentos de React",
    description: "Componentes, propriedades, estado e interação com formulários."
  },
  {
    slug: "accessible-interfaces",
    title: "Interfaces acessíveis",
    description: "Semântica, teclado, foco e contraste em interfaces web."
  }
] as const;

const stageGuidance = {
  "web-apis": {
    whyThisStep: "Começamos por HTTP e APIs porque entender como clientes e servidores trocam dados é a base das etapas de persistência e testes.",
    practiceTask: "Desenhe e implemente uma API pequena com dois endpoints, validação de entrada e respostas de erro documentadas.",
    estimatedMinutes: 150
  },
  "relational-data": {
    whyThisStep: "Com o contrato da API definido, modele como os dados serão relacionados e persistidos sem duplicação desnecessária.",
    practiceTask: "Modele usuários e projetos em tabelas relacionais, defina chaves e restrições e conecte um endpoint à consulta.",
    estimatedMinutes: 120
  },
  "automated-testing": {
    whyThisStep: "Depois de ter comportamento e dados definidos, teste os casos de sucesso e falha para verificar se as decisões funcionam.",
    practiceTask: "Escreva testes para entradas válidas, entradas inválidas e um caso de erro de persistência; registre o que cada teste garante.",
    estimatedMinutes: 120
  },
  "web-foundations": {
    whyThisStep: "A estrutura semântica e o funcionamento do navegador são a base para construir interfaces e entender como elas se adaptam a diferentes telas.",
    practiceTask: "Crie uma página com HTML semântico e CSS responsivo; navegue por ela sem mouse e confira como o conteúdo se reorganiza em uma tela estreita.",
    estimatedMinutes: 120
  },
  "react-fundamentals": {
    whyThisStep: "Depois de entender HTML e o navegador, componentes ajudam a organizar a interface em partes reutilizáveis e interativas.",
    practiceTask: "Construa um formulário React com estado, validação simples e estados de carregamento e erro.",
    estimatedMinutes: 150
  },
  "accessible-interfaces": {
    whyThisStep: "Acessibilidade aplica a semântica e os componentes da interface para que mais pessoas possam perceber e operar a experiência.",
    practiceTask: "Revise o formulário com teclado, verifique foco visível e rótulos, e corrija problemas observados sem depender apenas de ferramentas automáticas.",
    estimatedMinutes: 90
  }
} as const;

const learningPaths = [
  {
    slug: "backend-foundations",
    title: "Fundamentos de backend",
    description: "Uma sequência prática para entender, construir e verificar uma API pequena.",
    targetRole: "Desenvolvedor backend júnior",
    outcome: "Construir uma API pequena, modelar seus dados e verificar seu comportamento com testes.",
    competencySlugs: ["web-apis", "relational-data", "automated-testing"]
  },
  {
    slug: "frontend-foundations",
    title: "Fundamentos de frontend",
    description: "Uma sequência prática para criar uma interface web responsiva e acessível.",
    targetRole: "Desenvolvedor frontend júnior",
    outcome: "Construir uma interface em React com HTML semântico, responsividade e verificações básicas de acessibilidade.",
    competencySlugs: ["web-foundations", "react-fundamentals", "accessible-interfaces"]
  }
] as const;

const challenges = [
  {
    slug: "documented-task-api",
    title: "API de tarefas com validação",
    context: "Uma equipe precisa de um serviço pequeno para organizar tarefas sem depender de uma interface visual.",
    description: "Descreva como implementaria uma API REST para criar e listar tarefas, incluindo validação e respostas de erro. Envie um link público opcional para a implementação.",
    difficulty: "fundamentos",
    estimatedMinutes: 120,
    version: 1,
    status: "published" as const,
    acceptanceCriteria: [
      "A proposta descreve endpoints e formatos de entrada/saída.",
      "A validação de dados e os erros esperados estão documentados.",
      "As decisões e limitações estão explicadas."
    ],
    rubricCriteria: [
      "Correção e clareza da solução proposta.",
      "Validação e tratamento de erros.",
      "Organização da explicação e justificativa das decisões."
    ]
  },
  {
    slug: "responsive-accessible-form",
    title: "Formulário acessível e responsivo",
    context: "Um formulário de cadastro precisa funcionar em telas pequenas e ser utilizável por teclado e leitor de tela.",
    description: "Explique a estrutura semântica e as validações que usaria. Se houver uma demonstração pública, inclua o link.",
    difficulty: "fundamentos",
    estimatedMinutes: 90,
    version: 1,
    status: "published" as const,
    acceptanceCriteria: [
      "Campos têm rótulos programáticos e mensagens de erro associadas.",
      "O fluxo pode ser operado por teclado com foco visível.",
      "O layout considera telas estreitas sem perda de conteúdo."
    ],
    rubricCriteria: [
      "Uso de semântica e acessibilidade.",
      "Comportamento responsivo.",
      "Validação e clareza das mensagens."
    ]
  }
] as const;

async function seed(): Promise<void> {
  const versions: Array<{ id: string; slug: keyof typeof stageGuidance }> = [];

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
    versions.push({ id: version.id, slug: competency.slug });
  }

  const versionBySlug = new Map(versions.map((version) => [version.slug, version.id]));

  for (const pathDefinition of learningPaths) {
    const path = await prisma.learningPath.upsert({
      where: { slug: pathDefinition.slug },
      create: {
        slug: pathDefinition.slug,
        title: pathDefinition.title,
        description: pathDefinition.description,
        targetRole: pathDefinition.targetRole,
        outcome: pathDefinition.outcome,
        status: "published"
      },
      update: {
        title: pathDefinition.title,
        description: pathDefinition.description,
        targetRole: pathDefinition.targetRole,
        outcome: pathDefinition.outcome,
        status: "published"
      }
    });

    for (const [index, slug] of pathDefinition.competencySlugs.entries()) {
      const competencyVersionId = versionBySlug.get(slug);
      if (!competencyVersionId) {
        throw new Error(`Missing seeded competency version: ${slug}`);
      }

      await prisma.learningPathCompetency.upsert({
        where: {
          learningPathId_competencyVersionId: {
            learningPathId: path.id,
            competencyVersionId
          }
        },
        create: {
          learningPathId: path.id,
          competencyVersionId,
          position: index + 1,
          ...stageGuidance[slug]
        },
        update: {
          position: index + 1,
          ...stageGuidance[slug]
        }
      });
    }
  }

  for (const challenge of challenges) {
    await prisma.challenge.upsert({
      where: { slug: challenge.slug },
      create: {
        ...challenge,
        acceptanceCriteria: [...challenge.acceptanceCriteria],
        rubricCriteria: [...challenge.rubricCriteria]
      },
      update: {
        ...challenge,
        acceptanceCriteria: [...challenge.acceptanceCriteria],
        rubricCriteria: [...challenge.rubricCriteria]
      }
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
