-- =============================================================================
-- ESQUEMA DE BANCO DE DADOS - MULTI-TENANT E DASHBOARDS
-- ARQUITETURA OTIMIZADA PARA SUPABASE (PRODUÇÃO / HOMOLOGAÇÃO)
-- =============================================================================

-- Limpeza preventiva para reconstrução do banco (Rebuild)
DROP TABLE IF EXISTS public.rpa_sja_001_subtask CASCADE;
DROP TABLE IF EXISTS public.rpa_sja_001_task CASCADE;
DROP TABLE IF EXISTS public.cadastro_rpa_emails_alerta CASCADE;
DROP TABLE IF EXISTS public.cadastro_rpa CASCADE;
DROP TABLE IF EXISTS public.vinculo_cliente_usuario CASCADE;
DROP TABLE IF EXISTS public.usuario_perfil CASCADE;
DROP TABLE IF EXISTS public.cliente CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. TABELAS DE GOVERNANCA E MULTI-TENANT
-- -----------------------------------------------------------------------------

CREATE TABLE public.cliente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    razao_social VARCHAR(255),
    cnpj VARCHAR(20) UNIQUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de perfil integrada com o Supabase Auth (auth.users)
CREATE TABLE public.usuario_perfil (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    sobrenome VARCHAR(100),
    departamento VARCHAR(100),
    username VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'admin' ou 'client'
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.vinculo_cliente_usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_cliente UUID REFERENCES public.cliente(id) ON DELETE CASCADE,
    id_usuario UUID REFERENCES public.usuario_perfil(id) ON DELETE CASCADE,
    UNIQUE(id_cliente, id_usuario)
);

-- -----------------------------------------------------------------------------
-- 2. TABELA DE CATALOGO E CONFIGURACAO DO RPA
-- -----------------------------------------------------------------------------

CREATE TABLE public.cadastro_rpa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_cliente UUID REFERENCES public.cliente(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    identificador_rpa VARCHAR(255),
    descricao TEXT,
    departamento VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Ativo', -- 'Ativo', 'Inativo', 'Em Manutenção'
    regras TEXT,
    riscos TEXT,
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de coleção de e-mails para alertas do RPA (mapeamento @ElementCollection no JPA)
CREATE TABLE public.cadastro_rpa_emails_alerta (
    id_cadastro_rpa UUID NOT NULL REFERENCES public.cadastro_rpa(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    PRIMARY KEY (id_cadastro_rpa, email)
);

-- -----------------------------------------------------------------------------
-- 3. TABELAS DE EXECUÇÃO DO ROBO (Tasks e Subtasks)
-- -----------------------------------------------------------------------------

CREATE TABLE public.rpa_sja_001_task (
    id UUID PRIMARY KEY, -- Gerado via Hash no Java (Idempotencia)
    id_cadastro_rpa UUID REFERENCES public.cadastro_rpa(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL, -- nome_arquivo
    caminho_json_disco VARCHAR(512),
    timestamp_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timestamp_fim TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'Processando',
    msg_erro TEXT,
    total_linhas INT DEFAULT 0,
    linhas_sucesso INT DEFAULT 0,
    linhas_erro INT DEFAULT 0,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.rpa_sja_001_subtask (
    id UUID PRIMARY KEY, -- Gerado via Hash no Java (Idempotencia)
    id_task UUID REFERENCES public.rpa_sja_001_task(id) ON DELETE CASCADE,
    nome VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    msg_erro TEXT,
    msg_sefaz VARCHAR(255),

    -- Dados de Negocio (ERP)
    numero_documento VARCHAR(50),
    serie_documento VARCHAR(20),
    data_emissao DATE,
    valor_total_documento NUMERIC(15, 2),
    codigo_fornecedor VARCHAR(50),
    nome_fornecedor VARCHAR(255),

    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para otimização de consultas e velocidade dos dashboards
CREATE INDEX idx_cadastro_rpa_cliente ON public.cadastro_rpa(id_cliente);
CREATE INDEX idx_task_rpa ON public.rpa_sja_001_task(id_cadastro_rpa);
CREATE INDEX idx_subtask_task ON public.rpa_sja_001_subtask(id_task);

-- -----------------------------------------------------------------------------
-- 4. SEMEADURA DE DADOS DE ADMINISTRADOR (oneprocess / op2025)
-- -----------------------------------------------------------------------------

-- 4.1 Inserir credenciais na tabela auth.users do Supabase
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '71872f92-bf1c-4e31-9716-e58a3426dc7c', -- UUID Fixo para o Admin
    'authenticated',
    'authenticated',
    'admin@oneprocess.com',
    '$2a$10$YcY4JMt4y/GbT9tR2seD6.1uqLOxIxQnsE66QSIrNUwsqWAvPXFz6', -- Hash BCrypt de 'op2025'
    NOW(),
    NULL,
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- 4.2 Inserir o perfil do usuário administrador
INSERT INTO public.usuario_perfil (
    id,
    nome,
    sobrenome,
    departamento,
    username,
    role,
    criado_em
) VALUES (
    '71872f92-bf1c-4e31-9716-e58a3426dc7c',
    'OneProcess',
    'Admin',
    'TI',
    'oneprocess',
    'admin',
    NOW()
) ON CONFLICT (id) DO NOTHING;
