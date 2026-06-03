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

// ── HubSpot helpers ───────────────────────────────────────────

async function getHubSpotContact(email) {
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/search`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        properties: ['diagnostico_primeira_resposta', 'diagnostico_count_respostas', 'diagnostico_ultima_resposta'],
        limit: 1
      })
    }
  );
  const data = await res.json();
  return data.results?.[0] || null;
}

// Verifica se deve enviar e-mail (primeira vez OU última resposta > 24h atrás)
function shouldSendEmail(existing, nowMs) {
  if (!existing) return true; // contato novo → sempre envia

  const ultimaResposta = parseInt(existing.properties?.diagnostico_ultima_resposta || '0', 10);
  if (!ultimaResposta) return true; // nunca teve resposta registrada

  const VINTE_QUATRO_HORAS = 24 * 60 * 60 * 1000;
  return (nowMs - ultimaResposta) > VINTE_QUATRO_HORAS;
}

async function upsertHubSpotContact(body) {
  if (!HS_TOKEN || !body.email) return;

  const nowMs   = Date.now();
  const badges  = (body.badges || []).map(b => b.id).join(';'); // checkbox usa ; como separador

  // Verifica se o contato já existe para lógica de first/last/count
  const existing = await getHubSpotContact(body.email);
  const isNew    = !existing;
  const prevCount = parseInt(existing?.properties?.diagnostico_count_respostas || '0', 10);
  const primeiraResposta = existing?.properties?.diagnostico_primeira_resposta || String(nowMs);

  const properties = {
    // Campos padrão HubSpot
    firstname:   (body.nome || '').split(' ')[0],
    lastname:    (body.nome || '').split(' ').slice(1).join(' ') || '',
    email:       body.email,
    jobtitle:    body.funcao      || '',
    company:     body.instituicao || '',
    state:       body.estado      || '',

    // Scores
    diagnostico_score_seguranca:          body.score_seguranca          ?? '',
    diagnostico_score_processos:          body.score_processos          ?? '',
    diagnostico_score_interoperabilidade: body.score_interoperabilidade ?? '',
    diagnostico_score_inteligencia:       body.score_inteligencia       ?? '',
    diagnostico_score_geral:              body.score_geral              ?? '',

    // Resultado
    diagnostico_persona:      body.persona      || '',
    diagnostico_persona_tier: body.persona_tier || '',
    diagnostico_badges_count: (body.badges || []).length,
    diagnostico_badges:       badges,

    // Perfil
    diagnostico_funcao:        body.funcao        || '',
    diagnostico_instituicao:   body.instituicao   || '',
    diagnostico_estado:        body.estado        || '',
    diagnostico_volume_mensal: body.volume_mensal || '',
    diagnostico_objetivo:      body.objetivo      || '',
    diagnostico_slug:          body.slug          || '',
    diagnostico_data:          String(nowMs),

    // Datas e contador
    diagnostico_ultima_resposta:   String(nowMs),
    diagnostico_primeira_resposta: primeiraResposta,
    diagnostico_count_respostas:   prevCount + 1,

    // Gatilho de e-mail — true se for a primeira vez ou se passou 24h
    diagnostico_enviar_email: shouldSendEmail(existing, nowMs) ? 'true' : 'false',
  };

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: [{ idProperty: 'email', id: body.email, properties }]
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

    // Upsert no HubSpot (aguarda para garantir execução em serverless)
    await upsertHubSpotContact(body).catch(e => console.error('HubSpot error:', e));

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
