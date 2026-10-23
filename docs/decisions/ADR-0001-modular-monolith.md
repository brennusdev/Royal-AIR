# ADR-0001: Monólito modular com PostgreSQL

- **Status:** aceito para a fundação.
- **Data:** 2026-10-23.

## Contexto

O repositório contém páginas HTML/CSS e um script MySQL, sem API, framework frontend, suíte de testes ou ambiente de execução de banco configurado. A especificação pede uma plataforma com papéis e dados privados, então um frontend estático não é suficiente.

## Decisão

Iniciar uma aplicação nova em monólito modular: React/Vite/TypeScript, Fastify/TypeScript com API REST, Zod, PostgreSQL com Prisma e workspaces npm. Contratos puros ficam em um pacote compartilhado. A API expõe OpenAPI e health/readiness. PostgreSQL é a única base para a aplicação nova; `BancoDeDados/banco.sql` é mantido como legado, sem execução automática.

Usar Node 24 LTS como base compatível e versões estáveis compatíveis, registradas no lockfile. O ambiente inspecionado tem Node 26 Current; essa execução local serve para validação, mas a documentação exige a linha LTS 24.x.

## Alternativas

- Manter HTML estático: rejeitado para as exigências de autorização, persistência e fluxos por papel.
- Microserviços: rejeitados por custo operacional sem benefício no estágio atual.
- MySQL existente: rejeitado para a aplicação nova porque a especificação define PostgreSQL e a base anterior não está conectada à aplicação.

## Consequências e riscos

- A interface antiga e os dados MySQL não são migrados nesta fundação.
- Docker Compose permite o serviço PostgreSQL local; o Docker não está disponível no ambiente verificado, portanto não se poderá confirmar execução local do container aqui.
- Sem autenticação ainda, nenhum dado real pode ser armazenado.
- Novas funcionalidades devem ser separadas por domínio e testar autorização no servidor.
