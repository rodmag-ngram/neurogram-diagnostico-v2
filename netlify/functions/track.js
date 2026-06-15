// netlify/functions/track.js — event tracking (Supabase + HubSpot)

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const HS_TOKEN   = process.env.HUBSPOT_TOKEN;
const HS_PORTAL  = '45616811';
const HS_APP_ID  = `neurogram_diagnostico`;

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

// Eventos que mandamos ao HubSpot (requer email)
const HS_EVENTS = new Set([
  'quiz_started',
  'profile_completed',
  'email_submitted',
  'quiz_completed',
  'submit_success',
  'result_viewed',
  'whatsapp_gate_shown',
  'whatsapp_gate_submitted',
  'whatsapp_gate_skipped',
  'returning_user_shown',
  'returning_user_view',
  'returning_user_redo',
]);

async function sendHubSpotEvent(name, email, properties) {
  if (!HS_TOKEN || !email) return;

  // Monta propriedades simples — HubSpot aceita strings/numbers
  const hsProps = {};
  for (const [k, v] of Object.entries(properties || {})) {
    if (v !== null && v !== undefined) hsProps[k] = String(v);
  }

  const res = await fetch('https://api.hubapi.com/events/v3/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      eventName:  `pe${HS_PORTAL}_${name}`,
      email,
      properties: hsProps,
      occurredAt: new Date().toISOString()
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[HubSpot event] ${name} failed:`, res.status, err);
  } else {
    console.log(`[HubSpot event] ${name} sent for ${email}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body);
    const { session_id, name, email, slug, properties } = body;

    if (!name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing name' }) };

    // 1) Salva no Supabase
    const { error } = await supabase.from('events').insert({
      session_id:  session_id || null,
      name,
      email:       email      || null,
      slug:        slug       || null,
      properties:  properties || {},
    });

    if (error) throw error;

    // 2) Dispara no HubSpot se o evento for relevante e tiver email
    if (HS_EVENTS.has(name) && email) {
      sendHubSpotEvent(name, email, { slug, ...properties }).catch(e =>
        console.error('[HubSpot event] async error:', e.message)
      );
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('[track] error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
