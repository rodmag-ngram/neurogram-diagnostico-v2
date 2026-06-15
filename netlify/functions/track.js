// netlify/functions/track.js — event tracking

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body);
    const { session_id, name, email, slug, properties } = body;

    if (!name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'missing name' }) };

    const { error } = await supabase.from('events').insert({
      session_id:  session_id || null,
      name,
      email:       email      || null,
      slug:        slug       || null,
      properties:  properties || {},
    });

    if (error) throw error;

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('[track] error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
