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

  try {
    const body = JSON.parse(event.body);

    // Atualização de WhatsApp (gate no final)
    if (body._update && body.slug && body.whatsapp) {
      const { error } = await supabase
        .from('diagnostics')
        .update({ whatsapp: body.whatsapp })
        .eq('slug', body.slug);

      if (error) throw error;

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true })
      };
    }

    // Inserção principal
    const { error } = await supabase.from('diagnostics').insert({
      slug:                      body.slug,
      nome:                      body.nome,
      email:                     body.email,
      funcao:                    body.funcao,
      instituicao:               body.instituicao,
      estado:                    body.estado,
      volume_mensal:             body.volume_mensal,
      objetivo:                  body.objetivo,
      score_seguranca:           body.score_seguranca,
      score_processos:           body.score_processos,
      score_interoperabilidade:  body.score_interoperabilidade,
      score_inteligencia:        body.score_inteligencia,
      score_geral:               body.score_geral,
      persona:                   body.persona,
      badges:                    body.badges,
      swot:                      body.swot,
      answers:                   body.answers
    });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, slug: body.slug })
    };

  } catch (err) {
    console.error('submit error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
