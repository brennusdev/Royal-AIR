# Plataforma de evidências técnicas

Aplicação em desenvolvimento para candidatos, avaliadores e empresas registrarem e revisarem competências com base em evidências práticas. O produto não promete emprego nem trata uma pontuação como medida universal de capacidade.

## Estado atual

A especificação do produto está em `docs/implementation-status.md`. A interface HTML antiga em `Backend/` e o script MySQL em `BancoDeDados/banco.sql` são protótipos legados; a aplicação nova está sendo construída em `apps/web`, `apps/api`, `packages/shared` e `prisma/`.

Cadastro de candidato, confirmação de e-mail, login/logout, recuperação de senha por e-mail, edição do próprio perfil, trilhas autorrelatadas e desafios fictícios com rascunho/envio privado já têm uma implementação inicial. A plataforma continua em desenvolvimento: não oferece exportação/exclusão de conta, MFA, avaliação por avaliadores, perfis para recrutadores ou fluxos de contratação. Não use dados reais; consulte [o estado e os limites](docs/implementation-status.md).

## Trilhas de estudo

A área autenticada oferece duas trilhas demonstrativas: fundamentos de backend e frontend. Cada uma apresenta um objetivo, etapas ordenadas, justificativa, atividade prática e estimativa de tempo. A pessoa escolhe uma trilha, acompanha o progresso e marca as etapas conforme estuda. O progresso é autorrelatado: não mede domínio, não é uma avaliação profissional e não garante emprego ou qualquer resultado “100%”. O catálogo e a integração com PostgreSQL ainda precisam de validação em runtime.

O portfólio privado permite registrar práticas ou projetos em texto, opcionalmente com um link HTTP(S), e remover os próprios registros. Eles são identificados como autorrelatados e não são verificados por avaliadores. Desafios demonstrativos exibem critérios antes do início e aceitam abordagem em texto e link HTTP(S); rascunhos e envios ficam privados e ainda não são avaliados. Não inclua segredos, dados sensíveis, código confidencial ou conteúdo de terceiros. Revisão profissional e compartilhamento permanecem pendentes.

## Stack

- Node.js 24 LTS e npm workspaces.
- React, TypeScript e Vite no frontend.
- Fastify, TypeScript, Zod e REST no backend.
- PostgreSQL com Prisma.
- Vitest para testes.

As versões instaladas ficam fixadas no `package-lock.json`; as restrições de Node estão no `package.json`.

## Pré-requisitos

- Node.js 24.13 ou superior na linha 24.x e npm 11.
- Docker Desktop com Compose para executar o conjunto completo local. Sem Docker, configure PostgreSQL e SMTP acessíveis pela API no `.env`.

## Instalação e execução

1. Copie `.env.example` para `.env` e ajuste a URL do banco se necessário.
2. Instale as dependências: `npm ci`.
3. Inicie toda a aplicação: `docker compose up --build`.
4. Acesse `http://localhost:5173`; API em `http://localhost:3000`; caixa de e-mail de desenvolvimento em `http://localhost:8025`.

O Compose inicia PostgreSQL, aplica migrações pendentes e então inicia API e frontend. O Mailpit recebe os e-mails de confirmação e redefinição localmente; nenhuma mensagem é enviada a endereços externos. O banco mantém dados no volume `postgres_data`.

Para executar API e frontend pelo npm em vez de contêineres, inicie `db` e `mailpit` com `docker compose up -d db mailpit`, execute `npm run db:setup` e depois `npm run dev`.

O endpoint `GET /api/v1/health` verifica se a API está ativa; `GET /api/v1/health/ready` também testa o banco. A especificação OpenAPI está em `GET /api/v1/openapi.json`.

## Comandos de qualidade

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run db:validate`
- `npm run db:seed` (competências, trilhas e desafios fictícios identificados como conteúdo de demonstração)

## Docker

O Compose de desenvolvimento inclui PostgreSQL, Mailpit, API e frontend. Código-fonte é montado para edição com recarga automática; o serviço `migrate` aplica migrações antes de iniciar a API. As imagens são voltadas ao desenvolvimento e não representam uma configuração de produção. Requer Docker Desktop com Docker Compose.

## Conta e autenticação

- O cadastro cria somente usuários candidatos; papéis adicionais não podem ser enviados pelo cliente.
- A conta fica pendente até confirmar o endereço no Mailpit.
- Senhas são derivadas com scrypt; sessões usam cookie `HttpOnly`, `SameSite=Lax`, token aleatório e hash persistido no banco.
- Recuperação usa token de uso único e revoga as sessões existentes.
- `GET /api/v1/auth/me` e `PATCH /api/v1/profile` acessam apenas a conta autenticada; perfis começam privados.
- Os textos aceitos durante cadastro são rascunhos de desenvolvimento, não documentos jurídicos finais. Exportação e exclusão ainda não estão disponíveis.

## Documentação

- Arquitetura, entidades e papéis: `docs/architecture.md` e `docs/data-model.md`.
- Segurança e privacidade: `docs/security.md` e `docs/privacy-lgpd.md`.
- Avaliação responsável: `docs/evaluation-rubrics.md`.
- Decisão de stack: `docs/decisions/ADR-0001-modular-monolith.md`.
- Progresso real das fases: `docs/implementation-status.md`.

## Protótipo anterior

As páginas estáticas em `Backend/` ainda não fazem parte da nova aplicação e contêm uma identidade visual provisória. O SQL em `BancoDeDados/banco.sql` é específico para MySQL e **não** deve ser aplicado à base PostgreSQL da nova aplicação. A migração dos dados não foi iniciada.
