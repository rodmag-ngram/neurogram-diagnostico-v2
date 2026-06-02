-- Neurogram Diagnóstico V2 — Supabase Schema
-- Execute no SQL Editor do Supabase

-- Remove tabela antiga se existir
DROP TABLE IF EXISTS diagnostics;

CREATE TABLE diagnostics (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  slug            TEXT        UNIQUE NOT NULL,

  -- ── Perfil ──────────────────────────────────────────
  nome            TEXT,
  email           TEXT,
  whatsapp        TEXT,
  funcao          TEXT,
  instituicao     TEXT,
  estado          TEXT,
  volume_mensal   TEXT,
  objetivo        TEXT,

  -- ── Scores por pilar (0–100) ────────────────────────
  score_seguranca          INTEGER DEFAULT 0,
  score_processos          INTEGER DEFAULT 0,
  score_interoperabilidade INTEGER DEFAULT 0,
  score_inteligencia       INTEGER DEFAULT 0,
  score_geral              NUMERIC(5,2) DEFAULT 0,

  -- ── Resultado ───────────────────────────────────────
  persona         TEXT,
  persona_tier    TEXT,   -- 'elite' | 'dominancia' | 'equilibrio'

  -- ── SWOT — separado por quadrante ───────────────────
  swot_forcas        JSONB DEFAULT '[]',
  swot_fraquezas     JSONB DEFAULT '[]',
  swot_oportunidades JSONB DEFAULT '[]',
  swot_alertas       JSONB DEFAULT '[]',

  -- ── Badges ──────────────────────────────────────────
  badges          JSONB DEFAULT '[]',   -- array de { id, label }
  badges_count    INTEGER DEFAULT 0,

  -- ── Respostas brutas (índice de cada pergunta) ──────
  -- Segurança
  resp_seg_armazenamento  TEXT,
  resp_seg_backup         TEXT,
  resp_seg_acesso         TEXT,
  resp_seg_historico      TEXT,
  -- Processos
  resp_proc_envio         TEXT,
  resp_proc_pendentes     TEXT,
  resp_proc_qualidade     TEXT,
  resp_proc_assinatura    TEXT,
  -- Interoperabilidade
  resp_inter_equipamento  TEXT,
  resp_inter_visualizacao TEXT,
  resp_inter_plataformas  TEXT,
  resp_inter_entrega      TEXT,
  -- Inteligência
  resp_int_volume         TEXT,
  resp_int_tempo          TEXT,
  resp_int_indicadores    TEXT,
  resp_int_gargalos       TEXT,

  -- ── Metadados ───────────────────────────────────────
  whatsapp_requested BOOLEAN DEFAULT false,
  completed_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices úteis para queries e benchmark
CREATE INDEX idx_diagnostics_created_at       ON diagnostics (created_at DESC);
CREATE INDEX idx_diagnostics_estado           ON diagnostics (estado);
CREATE INDEX idx_diagnostics_volume_mensal    ON diagnostics (volume_mensal);
CREATE INDEX idx_diagnostics_persona          ON diagnostics (persona);
CREATE INDEX idx_diagnostics_score_geral      ON diagnostics (score_geral DESC);

-- RLS
ALTER TABLE diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_insert" ON diagnostics
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_public_select" ON diagnostics
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow_public_update" ON diagnostics
  FOR UPDATE TO anon USING (true);
