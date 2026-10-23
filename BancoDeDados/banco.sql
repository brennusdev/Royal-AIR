-- =====================================================================
-- ROYAL AIR - roteiro de configuração do banco (MySQL 8.0+)
-- =====================================================================
-- O que é o SGBD?
-- SGBD significa Sistema Gerenciador de Banco de Dados. Neste projeto,
-- o MySQL é o programa que armazena e organiza os dados; este arquivo
-- contém instruções SQL que o MySQL executa para criar essa estrutura.
--
-- SEQUÊNCIA DE CONFIGURAÇÃO
-- 1. Instale e inicie o servidor MySQL 8.0+ no computador/servidor.
--    MySQL Workbench é opcional: ele oferece uma interface visual.
-- 2. Abra o terminal na pasta raiz do projeto e execute:
--       cmd.exe /c "mysql -u root -p < BancoDeDados\banco.sql"
--    Esse exemplo usa cmd.exe para redirecionar o arquivo ao cliente MySQL.
--    Digite a senha do administrador quando o MySQL pedir. No Workbench, abra
--    este arquivo e use o botão de executar (raio) conectado ao servidor local.
-- 3. O bloco abaixo cria o banco e seleciona-o. Os CREATE TABLE seguintes
--    criam as tabelas e relações. IF NOT EXISTS evita erro se já existirem;
--    este script não apaga nem migra tabelas existentes.
-- 4. No fim, consultas de conferência mostram tabelas e relações criadas.
-- 5. Para a aplicação, crie um usuário MySQL separado e com permissões
--    limitadas. Não conecte a aplicação como root, não coloque senhas neste
--    arquivo e guarde credenciais em variáveis de ambiente/secret manager.
--
-- IMPORTANTE: este script cria somente a estrutura. Ele não conecta o site
-- nem implementa a autenticação. O servidor da aplicação deve validar login,
-- gerar hashes de senha e controlar sessões. Nunca confie só no navegador.

CREATE DATABASE IF NOT EXISTS royal_air
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

-- USE escolhe o banco que receberá os comandos CREATE TABLE abaixo.
USE royal_air;

-- 1) usuarios: cadastro principal e estado da conta.
-- O e-mail pode ficar NULL até ser informado; UNIQUE impede duplicatas.
-- A aplicação deve normalizar o e-mail antes de gravá-lo.
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome VARCHAR(160) NOT NULL,
    email VARCHAR(254) NULL,
    email_verificado_em DATETIME(3) NULL,
    status ENUM('pendente', 'ativo', 'suspenso', 'excluido') NOT NULL DEFAULT 'pendente',
    criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_email (email),
    KEY idx_usuarios_status_criado (status, criado_em)
) ENGINE=InnoDB;

-- 2) credenciais: senha de contas locais.
-- usuario_id é também a chave primária: cada conta tem no máximo uma credencial.
-- Guarde somente um hash moderno produzido no servidor (ex.: Argon2id), nunca
-- a senha original nem uma senha criptografada que possa ser revertida.
CREATE TABLE IF NOT EXISTS credenciais (
    usuario_id BIGINT UNSIGNED NOT NULL,
    hash_senha VARCHAR(255) NOT NULL,
    senha_alterada_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (usuario_id),
    CONSTRAINT fk_credenciais_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3) identidades_externas: associação opcional com login de terceiros via OIDC
-- (por exemplo, Keycloak, Auth0 ou Cognito).
-- O par provedor + identificador_do_provedor deve ser único; não vincule contas
-- automaticamente apenas porque dois provedores retornaram o mesmo e-mail.
CREATE TABLE IF NOT EXISTS identidades_externas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id BIGINT UNSIGNED NOT NULL,
    provedor VARCHAR(50) NOT NULL,
    identificador_do_provedor VARCHAR(255) NOT NULL,
    criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_identidade_provedor_usuario (provedor, identificador_do_provedor),
    KEY idx_identidades_usuario (usuario_id),
    CONSTRAINT fk_identidades_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4) sessoes: sessões criadas após autenticação.
-- A aplicação gera um token aleatório para o navegador, mas grava aqui apenas
-- o SHA-256 (32 bytes) desse token. Assim, um vazamento da tabela não revela
-- diretamente um token de sessão utilizável. expira_em limita sua validade;
-- revogado_em permite encerrar uma sessão antes do vencimento.
CREATE TABLE IF NOT EXISTS sessoes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id BIGINT UNSIGNED NOT NULL,
    token_hash BINARY(32) NOT NULL,
    criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expira_em DATETIME(3) NOT NULL,
    revogado_em DATETIME(3) NULL,
    endereco_ip VARBINARY(16) NULL,
    agente_usuario VARCHAR(512) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_sessoes_token_hash (token_hash),
    KEY idx_sessoes_usuario_expiracao (usuario_id, expira_em),
    KEY idx_sessoes_expiracao (expira_em),
    CONSTRAINT fk_sessoes_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5) tokens_conta: tokens temporários e de uso único para confirmar e-mail
-- ou redefinir senha.
-- Armazene apenas o hash do token; o valor original é mostrado uma única vez
-- ao usuário e nunca deve aparecer em logs.
CREATE TABLE IF NOT EXISTS tokens_conta (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id BIGINT UNSIGNED NOT NULL,
    finalidade ENUM('verificar_email', 'redefinir_senha') NOT NULL,
    token_hash BINARY(32) NOT NULL,
    criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expira_em DATETIME(3) NOT NULL,
    utilizado_em DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tokens_conta_hash (token_hash),
    KEY idx_tokens_usuario_finalidade (usuario_id, finalidade, expira_em),
    KEY idx_tokens_expiracao (expira_em),
    CONSTRAINT fk_tokens_conta_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6) eventos_autenticacao: trilha para investigar sucessos, recusas e erros.
-- Não grave senhas, tokens, cookies ou cabeçalhos de autorização nesta tabela.
CREATE TABLE IF NOT EXISTS eventos_autenticacao (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id BIGINT UNSIGNED NULL,
    tipo_evento VARCHAR(64) NOT NULL,
    resultado ENUM('sucesso', 'negado', 'erro') NOT NULL,
    -- Hash HMAC do identificador (com chave mantida fora do banco), para
    -- investigar tentativas sem armazenar o e-mail em texto puro.
    identificador_hmac BINARY(32) NULL,
    endereco_ip VARBINARY(16) NULL,
    agente_usuario VARCHAR(512) NULL,
    criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_eventos_usuario_data (usuario_id, criado_em),
    KEY idx_eventos_identificador_data (identificador_hmac, criado_em),
    KEY idx_eventos_data (criado_em),
    CONSTRAINT fk_eventos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- A aplicação deve aplicar limite de tentativas e limpeza periódica de sessões,
-- tokens expirados e auditoria. Faça isso por serviço/job, não durante o login.

-- CONFERÊNCIA: ao executar o arquivo, estas consultas listam as tabelas
-- criadas neste banco e as chaves estrangeiras que ligam os registros.
SHOW TABLES;

SELECT
    TABLE_NAME AS tabela,
    ENGINE AS mecanismo
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

SELECT
    TABLE_NAME AS tabela,
    COLUMN_NAME AS coluna,
    REFERENCED_TABLE_NAME AS tabela_referenciada,
    REFERENCED_COLUMN_NAME AS coluna_referenciada
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;
