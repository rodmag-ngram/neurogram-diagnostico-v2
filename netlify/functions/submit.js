// netlify/functions/submit.js — Neurogram Diagnóstico V2

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const body = JSON.parse(event.body);

    // ── Atualização de WhatsApp (gate no final) ──────────────
    if (body._update && body.slug) {
      const update = {};
      if (body.whatsapp) {
        update.whatsapp = body.whatsapp;
        update.whatsapp_requested = true;
      }

      const { error } = await supabase
        .from('diagnostics')
        .update(update)
        .eq('slug', body.slug);

      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // ── Inserção principal ───────────────────────────────────
    const answers = body.answers || {};
    const swot    = body.swot || {};

    const { error } = await supabase.from('diagnostics').insert({
      slug:            body.slug,

      // Perfil
      nome:            body.nome,
      email:           body.email,
      funcao:          body.funcao,
      instituicao:     body.instituicao,
      estado:          body.estado,
      volume_mensal:   body.volume_mensal,
      objetivo:        body.objetivo,

      // Scores
      score_seguranca:          body.score_seguranca,
      score_processos:          body.score_processos,
      score_interoperabilidade: body.score_interoperabilidade,
      score_inteligencia:       body.score_inteligencia,
      score_geral:              body.score_geral,

      // Resultado
      persona:      body.persona,
      persona_tier: body.persona_tier,

      // SWOT por quadrante
      swot_forcas:        swot.forcas        || [],
      swot_fraquezas:     swot.fraquezas     || [],
      swot_oportunidades: swot.oportunidades || [],
      swot_alertas:       swot.alertas       || [],

      // Badges
      badges:       body.badges || [],
      badges_count: (body.badges || []).length,

      // Respostas individuais — Segurança
      resp_seg_armazenamento:  answers.seg_armazenamento  ?? null,
      resp_seg_backup:         answers.seg_backup         ?? null,
      resp_seg_acesso:         answers.seg_acesso         ?? null,
      resp_seg_historico:      answers.seg_historico      ?? null,

      // Respostas individuais — Processos
      resp_proc_envio:         answers.proc_envio         ?? null,
      resp_proc_pendentes:     answers.proc_pendentes     ?? null,
      resp_proc_qualidade:     answers.proc_qualidade     ?? null,
      resp_proc_assinatura:    answers.proc_assinatura    ?? null,

      // Respostas individuais — Interoperabilidade
      resp_inter_equipamento:  answers.inter_equipamento  ?? null,
      resp_inter_visualizacao: answers.inter_visualizacao ?? null,
      resp_inter_plataformas:  answers.inter_plataformas  ?? null,
      resp_inter_entrega:      answers.inter_entrega      ?? null,

      // Respostas individuais — Inteligência
      resp_int_volume:         answers.int_volume         ?? null,
      resp_int_tempo:          answers.int_tempo          ?? null,
      resp_int_indicadores:    answers.int_indicadores    ?? null,
      resp_int_gargalos:       answers.int_gargalos       ?? null,
    });

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, slug: body.slug })
    };

  } catch (err) {
    console.error('submit error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
