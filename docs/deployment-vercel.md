# Preparação de deploy na Vercel

Esta configuração publica o frontend Vite como conteúdo estático e encaminha `/api/*` para uma Vercel Function Node.js 24 que adapta as requisições ao Fastify. O PostgreSQL e o provedor de e-mail continuam sendo serviços externos e devem ser provisionados separadamente.

> **Limite de uso:** a plataforma ainda está em desenvolvimento. Termos e aviso de privacidade são rascunhos, não há avaliação humana nem exportação/exclusão de conta. Não habilite cadastro público com dados reais, nem trate a implantação inicial como lançamento de produção.

## Configuração do projeto Vercel

1. Importe o repositório como um projeto Vercel usando a raiz do repositório (não configure `apps/web` como Root Directory).
2. Mantenha o framework Vite e use a versão Node 24 indicada pelo `engines` no `package.json` raiz.
3. O arquivo `vercel.json` define `npm run build`, o diretório estático `apps/web/dist` e a reescrita das rotas `/api/*` para a Function compartilhada em `api/index.ts`.
4. Configure variáveis distintas para Preview e Production. Preview deve usar um banco separado e dados fictícios. Ative proteção de acesso a previews no painel Vercel.
5. Production exige `WEB_ORIGIN` explícito. Em Preview, a aplicação usa `VERCEL_URL` se `WEB_ORIGIN` não for definido, limitando operações ao host daquele deployment.

## Variáveis

Configure os valores diretamente no painel de variáveis da Vercel. Não os inclua no repositório, em logs ou em mensagens.

| Variável | Obrigatória | Observação |
|---|---:|---|
| `DATABASE_URL` | Sim em runtime e em comandos de banco | URL PostgreSQL do ambiente correspondente, com TLS e pooler/limite de conexões compatível com funções serverless. O build e a geração do client não se conectam ao banco. |
| `WEB_ORIGIN` | Sim em Production | Origem HTTPS exata, por exemplo `https://plataforma.example`; sem barra no final. |
| `SMTP_URL` | Sim em Preview e Production | SMTP autenticado, com TLS; Vercel bloqueia saída pela porta 25. A aplicação aguarda o envio do e-mail antes de responder. |
| `EMAIL_FROM` | Sim em Preview e Production | Remetente verificado pelo provedor. |
| `TERMS_VERSION` | Sim em Production | Versão aprovada dos termos; valores iniciados por `draft` são recusados em Production. Preview pode usar os rascunhos de desenvolvimento. |
| `PRIVACY_VERSION` | Sim em Production | Versão aprovada do aviso; valores iniciados por `draft` são recusados em Production. Preview pode usar os rascunhos de desenvolvimento. |
| `LOG_LEVEL` | Recomendado | Usar `info` ou `warn`; nunca registrar tokens ou conteúdo sensível. |
| `SESSION_COOKIE_SECURE` | Automática | Em Production deve permanecer `true`; a API recusa `false`. |

Use `DATABASE_URL` de runtime/comandos de banco com privilégio mínimo; nunca copie uma senha local ou de produção para o Git. Se a variável não existir, o script de geração do Prisma injeta um endereço descartável apenas no processo `prisma generate`; ele não é usado para conectar nem para executar migrações.

## Banco, migrações e seed

- Crie um banco PostgreSQL independente para cada ambiente.
- Aplique migrações em um job controlado antes de ativar o deployment, usando `npm run db:migrate:deploy` em um runner confiável com a URL daquele ambiente.
- Se o ambiente for de demonstração, carregue os dados fictícios com `npm run db:seed` apenas após confirmar a URL de destino. O seed contém exemplos, não contas de acesso.
- Não aplique migrações durante importação de módulo ou no início de cada Function.
- Configure backup, retenção, restauração testada, limites de conexão e região do banco compatível com a Function antes de aceitar usuários reais.

## Validação antes de liberar tráfego

1. Execute `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run db:validate`.
2. Confirme no deployment Preview os endpoints `GET /api/v1/health`, `GET /api/v1/health/ready` e `GET /api/v1/openapi.json`.
3. Teste cadastro, recebimento de verificação, confirmação, login, logout, redefinição de senha e cookie `Secure` pelo domínio HTTPS.
4. Teste migração e seed no banco Preview e confirme isolamento entre contas.
5. Verifique logs e limites de duração/recursos da Function; não registre tokens, senhas nem corpos de requisição.
6. Só promova um deployment depois de aprovar documentos legais, retenção, exclusão/exportação, segurança, backups e atendimento operacional.

## Limitações conhecidas

- A infraestrutura serverless não foi exercitada neste workspace e precisa ser verificada num Preview Vercel antes de produção.
- O ambiente de execução e build locais não têm Vercel CLI nem projeto associado; nenhum deployment foi criado ou publicado.
- O rate limit atual é em memória por instância; não substitui limitação distribuída para tráfego público.
- PostgreSQL, SMTP, domínio, segredos, proteção de Preview, backup e monitoramento não estão provisionados pelo repositório.
- A interface/rotas atuais não implementam avaliação por avaliador, compartilhamento com empresas nem exclusão/exportação de conta.
- O build e os testes locais não significam que houve deploy. Registre URL, ambiente e evidências somente depois de validar um deployment real.
