-- =============================================================================
-- ESQUEMA DE BANCO DE DADOS - MULTI-TENANT E DASHBOARDS
-- ARQUITETURA OTIMIZADA PARA SUPABASE
-- =============================================================================

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

-- Substitui a tabela 'usuario' customizada pela integracao com Supabase Auth
-- O 'id' deve apontar para auth.users(id) quando criado via painel/API do Supabase
CREATE TABLE public.usuario_perfil (
    id UUID PRIMARY KEY, -- FK para auth.users (gerenciado pelo Supabase)
    nome VARCHAR(100) NOT NULL,
    sobrenome VARCHAR(100),
    departamento VARCHAR(100),
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
    descricao TEXT,
    departamento VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Ativo', -- 'Ativo', 'Inativo', 'Em Manutenção'
    regras TEXT,
    riscos TEXT,
    observacoes TEXT,
    
    -- Nova coluna baseada na tela de "Configurar Alertas"
    emails_alerta TEXT[], 
    
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. TABELAS DE EXECUCAO DO ROBO (Tasks e Subtasks)
-- -----------------------------------------------------------------------------

CREATE TABLE public.rpa_sja_001_task (
    id UUID PRIMARY KEY, -- Gerado via Hash no Java (Idempotencia)
    id_cadastro_rpa UUID REFERENCES public.cadastro_rpa(id), -- Vinculo Multi-Tenant
    nome VARCHAR(255) NOT NULL, -- nome_arquivo
    caminho_json_disco VARCHAR(512),
    timestamp_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timestamp_fim TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'Processando',
    msg_erro TEXT,
    
    -- Sugestao: Manter contadores para agilizar as metricas do Dashboard!
    total_linhas INT DEFAULT 0,
    linhas_sucesso INT DEFAULT 0,
    linhas_erro INT DEFAULT 0,
    
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.rpa_sja_001_subtask (
    id UUID PRIMARY KEY, -- Gerado via Hash no Java (Idempotencia)
    id_task UUID REFERENCES public.rpa_sja_001_task(id) ON DELETE CASCADE,
    nome VARCHAR(255), -- Ex: Linha 1, Linha 2
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

-- -----------------------------------------------------------------------------
-- 4. INDICES ESTRATEGICOS PARA O DASHBOARD (Rapidez)
-- -----------------------------------------------------------------------------
CREATE INDEX idx_cadastro_rpa_cliente ON public.cadastro_rpa(id_cliente);
CREATE INDEX idx_task_rpa ON public.rpa_sja_001_task(id_cadastro_rpa);
CREATE INDEX idx_subtask_task ON public.rpa_sja_001_subtask(id_task);
