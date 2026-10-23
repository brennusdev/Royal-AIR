# Estado de implementação

Última atualização: 2026-10-23.

## Fase 0 — Planejamento técnico

- [x] Escolher arquitetura inicial e registrar alternativas.
- [x] Mapear papéis, escopos de autorização e fluxos alvo.
- [x] Documentar entidades e estados principais.
- [x] Registrar riscos de segurança e privacidade.
- [x] Definir critérios e limitações.

## Fase 1 — Fundação

- [x] Workspaces React/web, API TypeScript e contratos compartilhados.
- [x] Esquema PostgreSQL/Prisma, migrações e seed fictício tipado.
- [x] Docker Compose de desenvolvimento para PostgreSQL, Mailpit, API e frontend, com migração antes da API.
- [x] Health/readiness e documento OpenAPI inicial.
- [x] Lint, checagem de tipos, testes, build e workflow de CI.
- [x] README com instruções de instalação e execução.

### Verificação da Fase 1

- `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`: concluídos com sucesso.
- `npm run db:validate` e `npm run db:generate`: concluídos com sucesso.
- Migração inicial gerada a partir do esquema Prisma e versionada em `prisma/migrations/`; a segunda migração foi adicionada para sessões e tokens de e-mail.
- Smoke test local: API de saúde e proxy do frontend responderam `200`; o navegador exibiu a aplicação e não apresentou overflow horizontal a 390 px.
- O Compose e o workflow CI foram analisados sintaticamente como YAML. O CLI/daemon Docker não está instalado neste ambiente; imagens, inicialização de todos os serviços, migrações e seed ainda não foram executados aqui. O CI agora aplica as migrações contra PostgreSQL.
- A máquina usa Node 26 Current; o alvo documentado é Node 24 LTS. Os comandos passaram em Node 26, mas devem também ser executados na linha Node 24 antes de considerar a plataforma operacional.

Esta fase entrega uma fundação técnica, não desafios, avaliação, contratação ou integração de IA. Não usar para armazenar dados reais.

## Fase 2 — Autenticação e autorização (em andamento)

- [x] Cadastro de candidato, login, logout, confirmação de e-mail e redefinição de senha.
- [x] Papel `candidate` atribuído no servidor; perfil próprio autenticado e privado por padrão.
- [x] Sessões/tokens revogáveis, cookies HttpOnly, rate limit por rota e validação de origem em mutações.
- [x] Aceite versionado dos documentos de desenvolvimento e testes de fluxos/autorização.
- [ ] Executar fluxos contra PostgreSQL e Mailpit reais; a ausência de Docker bloqueia esta verificação local.
- [ ] Concluir preferências de conta, exportação/exclusão e autorização de papéis/recursos de organização. Não há compartilhamento de perfil com recrutadores nesta fase.
- [ ] Substituir/revisar juridicamente os textos de termos e privacidade; os documentos atuais são rascunhos.

### Verificação da Fase 2

- `npm run lint`, `npm run typecheck` e `npm test`: validados após a implementação; 9 testes passam, incluindo cadastro/verificação, cookie, logout, recuperação de senha, revogação de sessão, origem e perfil.
- `npm run db:validate` e `npm run db:generate`: validados com o esquema atualizado.
- As novas rotas não foram testadas com PostgreSQL/SMTP executáveis neste ambiente. A CI está configurada para aplicar as migrações num PostgreSQL de serviço.
- A fase permanece em andamento até concluir as funcionalidades de conta pendentes e testar a integração de banco/e-mail.

## Fases seguintes

- [ ] Fase 3 — competências, trilhas, desafios, tentativas e rubricas.
- [ ] Fase 4 — avaliação, feedback, revisão, portfólio e evidências.
- [ ] Fase 5 — organizações, vagas, candidaturas e compartilhamento consentido.
- [ ] Fase 6 — colaboração e integrações.
- [ ] Fase 7 — IA assistiva com revisão humana e controles de privacidade.
- [ ] Fase 8 — endurecimento, acessibilidade, operação e lançamento.

## Critérios de aceite

Nenhum critério global de produto é considerado concluído nesta fase. A base só estará pronta para dados reais após autenticação, autorização por recurso, testes de isolamento, revisão de privacidade e segurança, backup e configuração operacional. Atualizar esta lista somente com evidência de execução.

## Verificação

Resultados de comandos e limitações do ambiente devem permanecer registrados aqui com evidência de execução. Não marcar fluxos de produto como concluídos por existirem apenas no modelo ou na documentação.
