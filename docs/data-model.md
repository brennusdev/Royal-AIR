# Modelo de dados

## Decisões

IDs são strings UUID/CUID, datas são armazenadas em UTC e as tabelas incluem datas de criação/atualização. Chaves estrangeiras e unicidade são verificadas pelo PostgreSQL. Senhas, tokens de sessão e tokens de integração nunca são armazenados em texto simples. Avaliações mantêm referências às versões de critérios vigentes no momento da revisão.

## Núcleo relacional planejado

| Domínio | Entidades | Relações principais |
|---|---|---|
| Conta e privacidade | `User`, `UserRole`, `CandidateProfile`, `ConsentRecord`, `Session`, `EmailActionToken`, `Notification` | usuário tem papéis, no máximo um perfil candidato, consentimentos, sessões revogáveis e tokens de e-mail com uso/expiração controlados |
| Organizações | `Organization`, `OrganizationMember` | organização tem membros com papel interno; um usuário pode integrar várias organizações |
| Catálogo | `Competency`, `CompetencyVersion`, `LearningPath`, `LearningPathCompetency` | competência e critérios são versionados; trilhas ordenam competências |
| Desafios | `Challenge`, `ChallengeCompetency`, `Rubric`, `RubricCriterion`, `ChallengeAttempt` | desafio avalia competências e aponta para rubrica versionada |
| Entregas | `Submission`, `SubmissionArtifact`, `Evidence` | tentativa tem submissões versionadas, artefatos e evidências com origem e estado |
| Avaliações | `Assessment`, `AssessmentCriterionResult` | uma avaliação pertence a avaliador/tentativa, referencia rubrica e contém resultado por critério |
| Portfólio | `Project`, `ProjectMember`, `Team`, `TeamMember`, `Task`, `CodeReview` | projeto e equipe registram contribuições individuais sem equiparar volume de commits a qualidade |
| Contratação | `Job`, `JobCompetencyRequirement`, `Application`, `SavedCandidate`, `Invitation` | vaga pertence a organização; candidatura liga vaga e candidato autorizado |
| Governança | `AuditLog`, `AIUsageRecord` | eventos administrativos e metadados mínimos de IA, com acesso restrito e retenção definida |

## Estados relevantes

- Competência: `not_assessed`, `foundation`, `developing`, `demonstrated`, `strong_evidence`.
- Evidência: `self_reported`, `pending`, `reviewed`, `contested`, `revoked`.
- Desafio: `draft`, `published`, `archived`.
- Candidatura: `new`, `under_review`, `challenge_sent`, `interview`, `decision`, `offer`, `closed`.

Estados descrevem evidência em contexto e não certificam capacidade universal nem predizem contratação.

## Escopo do esquema implementado

A migração inicial cobre conta/perfis, organizações/membros, consentimentos e catálogo básico; a migração da Fase 2 adiciona sessões e tokens de verificação/recuperação. Autenticação básica e perfil próprio têm rotas, mas não há autorização organizacional nem contratação. Desafios, rubricas, submissões, evidências, avaliações, equipes, vagas, candidaturas, notificações e registros de IA continuam planejados para suas fases.

O script `BancoDeDados/banco.sql` pertence ao protótipo MySQL anterior. Não é uma migração PostgreSQL e não compartilha o esquema Prisma novo.
