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

A fundação ainda não armazena perfis em API nem implementa consentimento, exportação ou exclusão. Há uma tela/protótipo legado com `localStorage`; não usar esse dado como cadastro seguro, não compartilhá-lo com recrutadores e apagá-lo apenas pela ação local do navegador. A avaliação de finalidade, base legal, retenção, operadores e direitos do titular requer validação jurídica e de privacidade antes de qualquer lançamento.
