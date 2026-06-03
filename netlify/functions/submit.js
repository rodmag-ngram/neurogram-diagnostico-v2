// netlify/functions/submit.js — Neurogram Diagnóstico V2

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const HS_TOKEN = process.env.HUBSPOT_TOKEN;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

// ── HubSpot upsert ────────────────────────────────────────────
async function upsertHubSpotContact(body) {
  if (!HS_TOKEN || !body.email) return;

  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const properties = {
    // Campos padrão
    firstname:   (body.nome || '').split(' ')[0],
    lastname:    (body.nome || '').split(' ').slice(1).join(' ') || '',
    email:       body.email,
    jobtitle:    body.funcao       || '',
    company:     body.instituicao  || '',
    state:       body.estado       || '',

    // Campos customizados diagnostico_
    diagnostico_score_seguranca:          body.score_seguranca          ?? '',
    diagnostico_score_processos:          body.score_processos          ?? '',
    diagnostico_score_interoperabilidade: body.score_interoperabilidade ?? '',
    diagnostico_score_inteligencia:       body.score_inteligencia       ?? '',
    diagnostico_score_geral:              body.score_geral              ?? '',
    diagnostico_persona:                  body.persona                  || '',
    diagnostico_persona_tier:             body.persona_tier             || '',
    diagnostico_badges_count:             (body.badges || []).length,
    diagnostico_badges:                   (body.badges || []).map(b => b.label).join(', '),
    diagnostico_funcao:                   body.funcao                   || '',
    diagnostico_instituicao:              body.instituicao              || '',
    diagnostico_estado:                   body.estado                   || '',
    diagnostico_volume_mensal:            body.volume_mensal            || '',
    diagnostico_objetivo:                 body.objetivo                 || '',
    diagnostico_slug:                     body.slug                     || '',
    diagnostico_data:                     now,
  };

  // Upsert por email (cria ou atualiza)
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: [{
        idProperty: 'email',
        id: body.email,
        properties
      }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('HubSpot upsert error:', err);
  }
}

// ── Handler principal ─────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    // Atualização de WhatsApp
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

      // Atualiza phone no HubSpot também
      if (body.whatsapp && HS_TOKEN) {
        await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: [{
              idProperty: 'email',
              id: body.email || '',
              properties: { phone: body.whatsapp }
            }]
          })
        });
      }

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // Inserção principal
    const answers = body.answers || {};
    const swot    = body.swot    || {};

    // Salva no Supabase
    const { error } = await supabase.from('diagnostics').insert({
      slug:            body.slug,
      nome:            body.nome,
      email:           body.email,
      funcao:          body.funcao,
      instituicao:     body.instituicao,
      estado:          body.estado,
      volume_mensal:   body.volume_mensal,
      objetivo:        body.objetivo,

      score_seguranca:          body.score_seguranca,
      score_processos:          body.score_processos,
      score_interoperabilidade: body.score_interoperabilidade,
      score_inteligencia:       body.score_inteligencia,
      score_geral:              body.score_geral,

      persona:      body.persona,
      persona_tier: body.persona_tier,

      swot_forcas:        swot.forcas        || [],
      swot_fraquezas:     swot.fraquezas     || [],
      swot_oportunidades: swot.oportunidades || [],
      swot_alertas:       swot.alertas       || [],

      badges:       body.badges || [],
      badges_count: (body.badges || []).length,

      resp_seg_armazenamento:  answers.seg_armazenamento,
      resp_seg_backup:         answers.seg_backup,
      resp_seg_acesso:         answers.seg_acesso,
      resp_seg_historico:      answers.seg_historico,
      resp_proc_envio:         answers.proc_envio,
      resp_proc_pendentes:     answers.proc_pendentes,
      resp_proc_qualidade:     answers.proc_qualidade,
      resp_proc_assinatura:    answers.proc_assinatura,
      resp_inter_equipamento:  answers.inter_equipamento,
      resp_inter_visualizacao: answers.inter_visualizacao,
      resp_inter_plataformas:  answers.inter_plataformas,
      resp_inter_entrega:      answers.inter_entrega,
      resp_int_volume:         answers.int_volume,
      resp_int_tempo:          answers.int_tempo,
      resp_int_indicadores:    answers.int_indicadores,
      resp_int_gargalos:       answers.int_gargalos,
    });

    if (error) throw error;

    // Upsert no HubSpot (não bloqueia a resposta)
    upsertHubSpotContact(body).catch(e => console.error('HubSpot error:', e));

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
