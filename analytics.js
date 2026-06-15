// analytics.js — cliente de tracking de eventos

(function() {
  function getSessionId() {
    let id = sessionStorage.getItem('ng_session');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('ng_session', id);
    }
    return id;
  }

  window.track = function(name, properties) {
    const state = (() => {
      try { return JSON.parse(localStorage.getItem('neurogram_diag_v2') || '{}'); } catch(e) { return {}; }
    })();

    const payload = {
      session_id: getSessionId(),
      name,
      email: state.profileAnswers?.email || null,
      slug:  state.slug || null,
      properties: properties || {}
    };

    // fire-and-forget
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  };
})();
