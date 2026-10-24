# Segurança — controles e limitações

## Controles da fundação

- Configuração de ambiente validada por esquema; falha sem imprimir valores de segredos.
- Entradas de autenticação e perfil são validadas por Zod; erros de validação não retornam valores recebidos.
- Cabeçalhos de segurança, CORS limitado à origem configurada e rate limiting básico.
- Contas públicas recebem apenas o papel `candidate`; papéis administrativos nunca são aceitos na entrada do cliente.
- Senhas usam scrypt com salt aleatório; tokens de sessão e de e-mail são aleatórios e persistidos somente como hash.
- Sessão em cookie `HttpOnly`, `SameSite=Lax`, duração limitada, `Secure` habilitado em `NODE_ENV=production`; mutações verificam a origem configurada.
- Verificação de e-mail ativa a conta; recuperação usa token de uso único, resposta que não confirma cadastro existente e revogação das sessões anteriores.
- Confirmação dos termos e aviso registra as versões configuradas; os documentos atuais são rascunhos, sem revisão jurídica.
- Perfil candidato só pode ser lido/editado pelo próprio usuário nesta fase e começa privado.
- Falhas na verificação do banco são registradas no log e retornam indisponibilidade sem detalhes de conexão.
- ORM com parâmetros; credenciais são parametrizadas pelo ambiente. Os valores de exemplo/Compose são apenas locais e não servem para produção.
- Arquivo `.env` ignorado pelo Git; `.env.example` contém valores locais fictícios.
- `/health/ready` testa o banco sem expor informações de conexão.

## Limitações que impedem uso em produção

- Não usar dados reais: não há exportação/exclusão de conta, MFA, retenção configurada nem resposta operacional a incidentes.
- Rotas de evidências permitem apenas que um candidato autenticado liste, crie ou remova registros próprios; links não são buscados pelo servidor e mutações validam a origem. Desafios publicados permitem rascunhos e envios privados; não há avaliação humana, recursos de empresa nem autorização de organizações.
- SMTP não está provisionado para produção; Mailpit é somente um coletor local. Rate limiting é em memória e por instância/IP, sem proteção distribuída ou limite por conta.
- A integração serverless preparada para Vercel não foi validada em deployment. Não há autorização de organização, revisão de auditoria independente, upload, integração OAuth do GitHub, IA, backup ou operação de produção.
- Não existe revisão jurídica, teste de invasão ou certificação de segurança.

Antes de armazenar dados reais, concluir os controles de privacidade, MFA conforme risco, recuperação e suporte operacional, autorização e isolamento de todos os recursos, rate limit distribuído, auditoria, gestão de segredos, backup/restauração, revisão jurídica e teste de segurança. Tratar código e anexos futuros como dados não confiáveis; limitar tamanho, tipo e acesso. Nunca executar código submetido.
