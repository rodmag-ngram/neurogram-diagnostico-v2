-- Neurogram Diagnóstico V2 — Supabase Schema
-- Execute no SQL Editor do Supabase

-- ══════════════════════════════════════════════════════
-- TABELA: contacts — um registro por pessoa (por email)
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contacts (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  email               TEXT        UNIQUE NOT NULL,
  nome                TEXT,
  whatsapp            TEXT,
  funcao              TEXT,
  instituicao         TEXT,
  estado              TEXT,

  slug_mais_recente   TEXT,         -- slug do diagnóstico mais recente
  total_diagnosticos  INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_public_insert" ON contacts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "contacts_public_select" ON contacts FOR SELECT TO anon USING (true);
CREATE POLICY "contacts_public_update" ON contacts FOR UPDATE TO anon USING (true);

-- ══════════════════════════════════════════════════════
-- TABELA: diagnostics — um registro por submission
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS diagnostics (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  slug            TEXT        UNIQUE NOT NULL,

  -- FK para contacts
  contact_email   TEXT,

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
  persona_tier    TEXT,

  -- ── SWOT ────────────────────────────────────────────
  swot_forcas        JSONB DEFAULT '[]',
  swot_fraquezas     JSONB DEFAULT '[]',
  swot_oportunidades JSONB DEFAULT '[]',
  swot_alertas       JSONB DEFAULT '[]',

  -- ── Badges ──────────────────────────────────────────
  badges          JSONB DEFAULT '[]',
  badges_count    INTEGER DEFAULT 0,

  -- ── Respostas brutas ────────────────────────────────
  resp_seg_armazenamento  TEXT,
  resp_seg_backup         TEXT,
  resp_seg_acesso         TEXT,
  resp_seg_historico      TEXT,
  resp_proc_envio         TEXT,
  resp_proc_pendentes     TEXT,
  resp_proc_qualidade     TEXT,
  resp_proc_assinatura    TEXT,
  resp_inter_equipamento  TEXT,
  resp_inter_visualizacao TEXT,
  resp_inter_plataformas  TEXT,
  resp_inter_entrega      TEXT,
  resp_int_volume         TEXT,
  resp_int_tempo          TEXT,
  resp_int_indicadores    TEXT,
  resp_int_gargalos       TEXT,

  -- ── Metadados ───────────────────────────────────────
  whatsapp_requested BOOLEAN DEFAULT false,
  completed_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnostics_created_at    ON diagnostics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostics_contact_email ON diagnostics (contact_email);
CREATE INDEX IF NOT EXISTS idx_diagnostics_estado        ON diagnostics (estado);
CREATE INDEX IF NOT EXISTS idx_diagnostics_persona       ON diagnostics (persona);
CREATE INDEX IF NOT EXISTS idx_diagnostics_score_geral   ON diagnostics (score_geral DESC);

ALTER TABLE diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_public_insert" ON diagnostics FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "allow_public_select" ON diagnostics FOR SELECT TO anon USING (true);
CREATE POLICY "allow_public_update" ON diagnostics FOR UPDATE TO anon USING (true);

-- ══════════════════════════════════════════════════════
-- MIGRAÇÃO — popula contacts a partir de diagnostics
-- (rodar uma vez se a tabela diagnostics já tem dados)
-- ══════════════════════════════════════════════════════
-- INSERT INTO contacts (email, nome, whatsapp, funcao, instituicao, estado, slug_mais_recente, total_diagnosticos, created_at, updated_at)
-- SELECT DISTINCT ON (email)
--   email, nome, whatsapp, funcao, instituicao, estado, slug, 1, created_at, created_at
-- FROM diagnostics
-- WHERE email IS NOT NULL
-- ORDER BY email, created_at DESC
-- ON CONFLICT (email) DO NOTHING;
