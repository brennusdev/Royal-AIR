# Estado de implementação

Última atualização: 2026-10-24.

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

Esta fase entrega uma fundação técnica, não avaliação profissional, contratação ou integração de IA. Não usar para armazenar dados reais.

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

## Fase 3 — Competências e trilhas (implementação concluída; validação runtime pendente)

- [x] Publicar duas trilhas de demonstração: fundamentos de backend e frontend.
- [x] Registrar objetivo, resultado esperado, ordem, justificativa por etapa, prática sugerida e estimativa.
- [x] Permitir que candidatos autenticados escolham um objetivo, retomem a trilha, marquem a próxima etapa em andamento/estudada e acompanhem percentagem.
- [x] Explicar a próxima recomendação e impedir pular etapas.
- [x] Persistir planos e progresso por candidato, com isolamento no backend.
- [x] Serializar trocas de trilha concorrentes por candidato no PostgreSQL.
- [ ] Executar catálogo, seed e acompanhamento num PostgreSQL em runtime; Docker ainda indisponível neste ambiente.
- [ ] Ampliar o catálogo e curar recursos de aprendizagem como trabalho evolutivo posterior.

### Limites desta primeira entrega de trilhas

O sistema recomenda a próxima etapa da sequência escolhida com base no progresso autorrelatado. Ainda não diagnostica conhecimento prévio nem adapta conteúdo com base em evidências revisadas (que ainda não existem). O percentual mede apenas etapas que a pessoa marcou como estudadas; não comprova competência nem promete resultado “100%”.

### Verificação da Fase 3

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run db:validate`: concluídos com sucesso; 11 testes passam.
- O diff Prisma foi usado para conferir os nomes esperados de índices; o índice composto longo na migração foi ajustado ao nome truncado esperado pelo Prisma/PostgreSQL.
- Seed e migrações ainda não foram aplicados num PostgreSQL em runtime neste ambiente. A serialização de troca usa lock consultivo PostgreSQL e também aguarda validação de integração.

## Fase 4 — Evidências e avaliação (em andamento)

- [x] Permitir que candidatos autenticados registrem, consultem e removam evidências privadas com texto e link opcional HTTP(S).
- [x] Isolar registros pelo proprietário no backend e rotular os registros como autorrelatados, sem convertê-los em avaliações.
- [x] Exibir o portfólio privado na área autenticada e alertar para não incluir segredos ou dados sensíveis.
- [x] Exibir desafios fictícios publicados com critérios de aceitação e critérios de avaliação antes de iniciar.
- [x] Permitir iniciar/retomar uma tentativa por desafio, salvar rascunho e enviar abordagem/link HTTP(S).
- [x] Isolar tentativas por candidato, validar origem em alterações e impedir alteração após envio.
- [x] Copiar versão e critérios para a tentativa, preservando o contexto da entrega.
- [ ] Implementar atribuição e autorização de avaliadores, feedback, revisão/contestação e trilha de auditoria.
- [ ] Criar avaliação por rubrica, resultados por critério e evidência verificada; submissão não é avaliação.
- [ ] Executar migrações, seed e fluxo de tentativas contra PostgreSQL em runtime.

### Limites da primeira entrega de evidências

O portfólio e as tentativas aceitam declarações e links fornecidos pela própria pessoa. Não validam autoria ou qualidade; ainda não há avaliadores nem compartilhamento com empresas. As tentativas enviadas são rotuladas como não avaliadas e não elevam níveis de competência. Registros não devem conter credenciais, dados sensíveis, código confidencial ou conteúdo de terceiros.

### Verificação da Fase 4

- Rotas de consulta/criação/remoção exigem sessão de candidato; criação e remoção validam a origem.
- Testes cobrem entrada HTTP(S), classificação autorrelatada, origem e isolamento entre contas.
- `npm run lint`: concluído com sucesso após a implementação de desafios.
- `npm test`: 18 testes passaram após a implementação de desafios; cobertura inclui listagem de critérios, sessão/origem, início, envio, URL e isolamento entre candidatos.
- `npm run typecheck`, `npm run build`, `npm run db:validate` e `npm run db:generate`: concluídos com sucesso usando uma URL local de exemplo para validação/geração.
- A migração `20261024120000_challenges_and_attempts` e o seed ainda precisam ser executados em PostgreSQL; Docker e psql não estão instalados neste ambiente.

## Fases seguintes

- [ ] Fase 5 — organizações, vagas, candidaturas e compartilhamento consentido.
- [ ] Fase 6 — colaboração e integrações.
- [ ] Fase 7 — IA assistiva com revisão humana e controles de privacidade.
- [ ] Fase 8 — endurecimento, acessibilidade, operação e lançamento.

## Critérios de aceite

Nenhum critério global de produto é considerado concluído nesta fase. A base só estará pronta para dados reais após autenticação, autorização por recurso, testes de isolamento, revisão de privacidade e segurança, backup e configuração operacional. Atualizar esta lista somente com evidência de execução.

## Verificação

Resultados de comandos e limitações do ambiente devem permanecer registrados aqui com evidência de execução. Não marcar fluxos de produto como concluídos por existirem apenas no modelo ou na documentação.
