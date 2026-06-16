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


async function upsertHubSpotContact(body, slug) {
  if (!HS_TOKEN || !body.email) return;

  const nowMs    = Date.now();
  const existing = await getHubSpotContact(body.email);
  const prevCount = parseInt(existing?.properties?.diagnostico_count_respostas || '0', 10);
  const primeiraResposta = existing?.properties?.diagnostico_primeira_resposta || String(nowMs);
  const badges = (body.badges || []).map(b => b.id).join(';');

  const properties = {
    firstname:   (body.nome || '').split(' ')[0],
    lastname:    (body.nome || '').split(' ').slice(1).join(' ') || '',
    email:       body.email,
    jobtitle:    body.funcao      || '',
    company:     body.instituicao || '',
    state:       body.estado      || '',

    diagnostico_score_seguranca:          body.score_seguranca          ?? '',
    diagnostico_score_processos:          body.score_processos          ?? '',
    diagnostico_score_interoperabilidade: body.score_interoperabilidade ?? '',
    diagnostico_score_inteligencia:       body.score_inteligencia       ?? '',
    diagnostico_score_geral:              body.score_geral              ?? '',

    diagnostico_persona:      body.persona      || '',
    diagnostico_persona_tier: body.persona_tier || '',
    diagnostico_badges_count: (body.badges || []).length,
    diagnostico_badges:       badges,

    diagnostico_funcao:        body.funcao        || '',
    diagnostico_instituicao:   body.instituicao   || '',
    diagnostico_estado:        body.estado        || '',
    diagnostico_volume_mensal: body.volume_mensal || '',
    diagnostico_objetivo:      body.objetivo      || '',
    diagnostico_slug:          slug               || '',
    diagnostico_url:           slug ? `https://neurogram-diagnostico-v2.netlify.app/resultado?slug=${slug}` : '',
    diagnostico_data:          String(nowMs),

    diagnostico_ultima_resposta:   String(nowMs),
    diagnostico_primeira_resposta: primeiraResposta,
    diagnostico_count_respostas:   prevCount + 1,
    diagnostico_enviar_email: 'true',
  };

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputs: [{ idProperty: 'email', id: body.email, properties }]
    })
  });

  const resText = await res.text();
  if (!res.ok) {
    console.error('[HubSpot] upsert failed', res.status, resText);
    throw new Error(`HubSpot ${res.status}: ${resText}`);
  } else {
    console.log('[HubSpot] upsert success', res.status);
  }
}

// ── Handler principal ─────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    // ── Atualização de WhatsApp ──────────────────────────────
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

      // Atualiza whatsapp em contacts também
      if (body.whatsapp && body.email) {
        await supabase
          .from('contacts')
          .update({ whatsapp: body.whatsapp })
          .eq('email', body.email);
      }

      // Atualiza phone (e flag de envio) no HubSpot
      if (body.whatsapp && HS_TOKEN && body.email) {
        const hsProps = { phone: body.whatsapp };
        if (body.whatsapp_enviar_resultado) hsProps.whatsapp_enviar_resultado = 'true';
        await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputs: [{ idProperty: 'email', id: body.email, properties: hsProps }]
          })
        });
      }

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // ── Submission principal ─────────────────────────────────

    // 1) Busca slug existente em contacts para manter o mesmo link
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('slug_mais_recente, total_diagnosticos')
      .eq('email', body.email)
      .single();

    const slug = existingContact?.slug_mais_recente || body.slug;
    const totalDiagnosticos = (existingContact?.total_diagnosticos || 0) + 1;

    // 2) Upsert em contacts — um registro por pessoa
    const { error: contactError } = await supabase
      .from('contacts')
      .upsert({
        email:              body.email,
        nome:               body.nome,
        funcao:             body.funcao,
        instituicao:        body.instituicao,
        estado:             body.estado,
        slug_mais_recente:  slug,
        total_diagnosticos: totalDiagnosticos,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'email' });

    if (contactError) throw contactError;

    // 3) Insert em diagnostics — histórico completo
    const answers = body.answers || {};
    const swot    = body.swot    || {};

    const { error: diagError } = await supabase.from('diagnostics').upsert({
      slug,
      email:           body.email,
      nome:            body.nome,
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
    }, { onConflict: 'slug' });

    if (diagError) throw diagError;

    // 4) HubSpot — fire and forget, não bloqueia o redirect
    console.log('[submit] HS_TOKEN present:', !!HS_TOKEN, '| email:', body.email, '| slug:', slug);
    upsertHubSpotContact(body, slug).catch(e =>
      console.error('[submit] HubSpot upsert FAILED:', e.message)
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, slug })
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
