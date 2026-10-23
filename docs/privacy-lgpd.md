# Privacidade e LGPD — decisões iniciais

Este documento registra decisões técnicas iniciais, não constitui parecer jurídico nem declara conformidade legal.

## Princípios

- Minimizar dados pessoais e pedir localização somente em nível amplo e opcional.
- Manter perfil/evidências privados por padrão; compartilhamento com empresa requer consentimento específico, revogável e associado a uma finalidade.
- Registrar versão, finalidade, escopo e data de consentimentos.
- Separar conteúdo privado do candidato de observações internas de organização.
- Permitir correção, exportação e solicitação de exclusão, preservando somente registros que tenham base/obrigação documentada.
- Definir retenção por categoria antes do lançamento e permitir revisão jurídica.
- Registrar acessos relevantes a perfis compartilhados sem copiar conteúdo sensível para logs.

## Limitações atuais

A API armazena contas/perfis privados e registros de portfólio autorrelatados, que o próprio candidato pode remover individualmente. Ainda não há exportação nem exclusão de conta, e não há compartilhamento desses registros com recrutadores. A interface/protótipo legado com `localStorage` permanece separada e não é cadastro seguro. A avaliação de finalidade, base legal, retenção, operadores e direitos do titular requer validação jurídica e de privacidade antes de qualquer lançamento.
