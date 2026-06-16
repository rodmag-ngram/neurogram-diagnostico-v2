// netlify/functions/whatsapp-webhook.js
// Handles Meta webhook verification and forwards messages to Make

const MAKE_URL   = process.env.MAKE_WHATSAPP_WEBHOOK;
const VERIFY_TOKEN = 'neurogram2026';

exports.handler = async (event) => {
  // Meta verification challenge (GET)
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    if (
      params['hub.mode'] === 'subscribe' &&
      params['hub.verify_token'] === VERIFY_TOKEN
    ) {
      return { statusCode: 200, body: params['hub.challenge'] };
    }
    return { statusCode: 403, body: 'Forbidden' };
  }

  // Incoming message (POST) — forward to Make
  if (event.httpMethod === 'POST') {
    console.log('[whatsapp-webhook] POST received:', event.body?.slice(0, 500));
    if (MAKE_URL) {
      try {
        const res = await fetch(MAKE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: event.body,
        });
        console.log('[whatsapp-webhook] Make response:', res.status);
      } catch (e) {
        console.error('[whatsapp-webhook] forward failed:', e.message);
      }
    } else {
      console.error('[whatsapp-webhook] MAKE_URL not set');
    }
    return { statusCode: 200, body: 'ok' };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
