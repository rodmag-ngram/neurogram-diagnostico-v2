-- Neurogram Diagnóstico V2 — Supabase Schema
-- Execute no SQL Editor do Supabase antes de rodar o projeto

CREATE TABLE diagnostics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  slug TEXT UNIQUE NOT NULL,

  -- Perfil
  nome TEXT,
  email TEXT,
  funcao TEXT,
  instituicao TEXT,
  estado TEXT,
  volume_mensal TEXT,
  objetivo TEXT,

  -- Scores (0–100 por pilar)
  score_seguranca INTEGER,
  score_processos INTEGER,
  score_interoperabilidade INTEGER,
  score_inteligencia INTEGER,
  score_geral NUMERIC(5,2),

  -- Resultado
  persona TEXT,
  badges JSONB,
  swot JSONB,

  -- Respostas brutas
  answers JSONB,

  -- Coletado no final (opcional)
  whatsapp TEXT
);

-- Permitir insert público (anon key)
ALTER TABLE diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_insert" ON diagnostics
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_public_select_own" ON diagnostics
  FOR SELECT TO anon USING (true);
