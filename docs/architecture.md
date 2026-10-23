# Arquitetura

## Contexto

O produto é uma plataforma de evidências práticas e avaliações para desenvolvedores em início de carreira. É uma aplicação nova, separada das páginas HTML e do script MySQL legados do repositório. A marca fica neutra e configurável.

## Componentes

- `apps/web`: React e TypeScript; interface acessível e responsiva.
- `apps/api`: API REST em Fastify, TypeScript, validação Zod, cabeçalhos de segurança, CORS restrito e limite básico de requisições.
- `packages/shared`: contratos e regras puras compartilhados entre os aplicativos.
- `prisma/`: esquema relacional PostgreSQL, migrações e seed de demonstração.
- `docs/`: modelo, riscos, privacidade e decisões.

A implantação inicial é um monólito modular: uma aplicação web, uma API e um banco PostgreSQL, sem filas ou microserviços prematuros. Arquivos enviados e integrações externas deverão ser encapsulados por interfaces quando essas fases forem implementadas.

## Fluxos principais pretendidos

1. Candidato cria conta pendente, confirma e-mail, autentica com cookie de sessão e configura o próprio perfil privado.
2. Candidato lê critérios e política de IA antes de iniciar um desafio, envia evidências e recebe feedback.
3. Avaliador autorizado usa uma rubrica versionada, registra contexto e permite revisão/contestação.
4. Empresa define uma vaga e requisitos; consulta somente candidatos que consentiram compartilhar as evidências pertinentes.
5. Administração publica competências e desafios versionados; ações sensíveis deixam trilha de auditoria.

Autenticação básica e edição do perfil próprio foram implementadas na Fase 2. Desafios, avaliações, compartilhamento, contratação e administração continuam sendo objetivos pendentes.

## Papéis e limites de autorização

Papéis globais: `candidate`, `reviewer`, `recruiter`, `organization_admin`, `platform_admin`. Um usuário pode ter mais de um papel. Os papéis são concedidos e verificados no servidor; nunca são confiados ao cliente.

Permissões também têm escopo:

- Candidato acessa seu próprio perfil, rascunhos e evidências privadas.
- Avaliador acessa avaliações explicitamente atribuídas e declara conflito de interesse.
- Membro de organização acessa apenas recursos dessa organização conforme o papel interno.
- Recrutador consulta dados de candidato apenas com compartilhamento válido e finalidade registrada.
- Administração usa permissões mínimas, com auditoria para ações sensíveis.

O servidor impõe sessão ativa e acesso ao próprio perfil nesta fase. Autorização para avaliações, recursos de organização, compartilhamento com recrutadores e ações administrativas ainda não existe; essas regras não podem ser presumidas a partir dos papéis armazenados.

## Decisões de implementação inicial

- Node.js 24 LTS, npm workspaces, TypeScript, React/Vite, Fastify, PostgreSQL/Prisma, Zod e Vitest.
- OpenAPI versionado fica disponível pela API e deve evoluir junto com os endpoints.
- PostgreSQL é a fonte de verdade; `localStorage`/dados de navegador não são armazenamento de conta.
- O endpoint de saúde ativo independe do banco; o endpoint de prontidão testa conectividade.
- Sem chave de provedor de IA, fluxos não dependentes de IA permanecem disponíveis. Nenhuma IA participa de decisões de seleção nesta fundação.

Veja o ADR-0001, o [modelo de dados](./data-model.md) e o [progresso](./implementation-status.md).
