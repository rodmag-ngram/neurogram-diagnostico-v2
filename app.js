// app.js — Neurogram Diagnóstico V2 — UI Engine (FSM-style)

// ============================================================
// ESTADO GLOBAL
// ============================================================
const state = {
  phase: 'profile',
  profileAnswers: {},
  benchmarkAnswers: {},
  currentStep: 0,
  scores: { seguranca: 0, processos: 0, interoperabilidade: 0, inteligencia: 0 },
  unlockedBadges: [],
  persona: null,
  swot: null,
  slug: null,
  sectionsShown: new Set()
};

const TOTAL_STEPS = PROFILE_QUESTIONS.length + BENCHMARK_QUESTIONS.length;

// ============================================================
// UTILS
// ============================================================
function $(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

function saveState() {
  try { localStorage.setItem('neurogram_diag_v2', JSON.stringify(state)); } catch(e) {}
}

function setDate() {
  const now = new Date();
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const str = `${months[now.getMonth()].toUpperCase()} · ${now.getFullYear()}`;
  const els = document.querySelectorAll('.wp-date, .sb-date');
  els.forEach(el => el.textContent = str);
}

// ============================================================
// WELCOME RADAR (decorativo)
// ============================================================
function initWelcomeRadar() {
  const ctx = $('welcome-radar');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Seg.','Proc.','Inter.','Intel.'],
      datasets: [{
        data: [82, 75, 91, 58],
        backgroundColor: 'rgba(162,201,110,.15)',
        borderColor: '#A2C96E',
        borderWidth: 1.5,
        pointRadius: 2,
        pointBackgroundColor: ['#A2C96E','#10B981','#8B5CF6','#F59E0B']
      }]
    },
    options: {
      responsive: false,
      animation: false,
      scales: {
        r: {
          beginAtZero: true, min: 0, max: 100,
          ticks: { display: false },
          grid: { color: 'rgba(255,255,255,.08)' },
          pointLabels: { display: false }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// ============================================================
// ASSESSMENT RADAR (ao vivo)
// ============================================================
let radarChart = null;

function initRadarChart() {
  const ctx = $('radar-chart');
  if (!ctx) return;
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Segurança','Processos','Interop.','Inteligência'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: 'rgba(162,201,110,.12)',
        borderColor: '#A2C96E',
        borderWidth: 1.5,
        pointBackgroundColor: '#A2C96E',
        pointBorderColor: 'rgba(255,255,255,.2)',
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true, min: 0, max: 100,
          ticks: { display: false },
          grid: { color: 'rgba(255,255,255,.06)' },
          pointLabels: {
            font: { size: 9, family: 'Inter', weight: '600' },
            color: '#BDC2B7'
          }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function updateRadar() {
  if (!radarChart) return;
  radarChart.data.datasets[0].data = [
    state.scores.seguranca,
    state.scores.processos,
    state.scores.interoperabilidade,
    state.scores.inteligencia
  ];
  radarChart.update('active');
}

// ============================================================
// PROGRESSO
// ============================================================
function updateProgress() {
  const completed = Object.keys(state.profileAnswers).length + Object.keys(state.benchmarkAnswers).length;
  const pct = Math.round((completed / TOTAL_STEPS) * 100);
  $('top-progress-fill').style.width = pct + '%';
}

// ============================================================
// SIDEBAR — atualização ao vivo
// ============================================================
function updateSidebarProfile(key, value) {
  const el = $(`sbp-${key}`);
  if (!el) return;
  el.querySelector('.sb-profile-value').textContent = value;
  el.classList.add('filled');
}

function updateSidebarScores() {
  const pillars = ['seguranca', 'processos', 'interoperabilidade', 'inteligencia'];
  pillars.forEach(p => {
    const qs = BENCHMARK_QUESTIONS.filter(q => q.pillar === p);
    const answered = qs.filter(q => state.benchmarkAnswers[q.id] !== undefined);
    if (answered.length === 0) return;

    const score = state.scores[p];
    $(`sb-val-${p}`).textContent = score;
    $(`sb-bar-${p}`).style.width = score + '%';
  });
  updateRadar();
}

function updateSidebarBadges(newBadge) {
  $('sb-badges').style.display = 'block';
  const grid = $('sb-badges-grid');
  const existing = new Set([...grid.querySelectorAll('.badge-pill')].map(b => b.dataset.id));
  if (!existing.has(newBadge.id)) {
    const pill = document.createElement('div');
    pill.className = 'badge-pill new';
    pill.dataset.id = newBadge.id;
    pill.textContent = newBadge.label;
    grid.appendChild(pill);
    setTimeout(() => pill.classList.remove('new'), 3000);
  }
}

function revealPersonaInSidebar(persona) {
  const el = $('sb-persona');
  el.classList.remove('unknown');
  el.innerHTML = `
    <div class="sb-persona-label">Persona</div>
    <div class="sb-persona-icon-row">
      <div class="sb-persona-icon">✦</div>
      <div class="sb-persona-name">${persona.label}</div>
    </div>
    <div class="sb-persona-hint">${persona.text.slice(0, 110)}…</div>
  `;
}

// ============================================================
// CHAT — helpers
// ============================================================
function appendBotBubble(html) {
  const chat = $('chat-inner');
  const div = document.createElement('div');
  div.className = 'msg msg-bot';
  div.innerHTML = `
    <div class="msg-avatar">🧠</div>
    <div class="msg-bubble">${html}</div>
  `;
  chat.appendChild(div);
  scrollChat();
}

function appendUserBubble(text, points, pillarLabel) {
  const chat = $('chat-inner');
  const div = document.createElement('div');
  div.className = 'msg msg-user';

  const pointsPill = (points && points > 0)
    ? `<div class="answer-points">+${points} ${pillarLabel || ''}</div>`
    : '';

  div.innerHTML = `
    <div class="msg-bubble-wrap">
      <div class="msg-bubble">${text}</div>
      ${pointsPill}
    </div>
  `;
  chat.appendChild(div);
  scrollChat();
}

function appendSectionBubble(pillar) {
  // Sem card de seção — o chat flui sem interrupções
  state.sectionsShown.add(pillar);
}

function appendQuestion(text) {
  const chat = $('chat-inner');
  const div = document.createElement('div');
  div.className = 'question-text';
  div.textContent = text;
  chat.appendChild(div);
  scrollChat();
}

function removeCurrentInput() {
  const el = $('chat-inner').querySelector('.options-wrap, .text-input-wrap, .dropdown-wrap');
  if (el) el.remove();
}

function scrollChat() {
  const panel = $('chat-panel');
  setTimeout(() => { panel.scrollTop = panel.scrollHeight; }, 60);
}

// ============================================================
// FLUXO
// ============================================================
function renderNext() {
  updateProgress();

  if (state.phase === 'profile') {
    if (state.currentStep >= PROFILE_QUESTIONS.length) {
      state.phase = 'benchmark';
      state.currentStep = 0;
      setTimeout(() => {
        appendBotBubble('Ótimo! Agora vamos avaliar a maturidade da sua operação. Responda com base na realidade atual da sua clínica. 💪');
        setTimeout(renderNext, 500);
      }, 200);
      return;
    }
    renderProfileQuestion(PROFILE_QUESTIONS[state.currentStep]);

  } else {
    if (state.currentStep >= BENCHMARK_QUESTIONS.length) {
      finishAssessment();
      return;
    }
    const q = BENCHMARK_QUESTIONS[state.currentStep];
    appendSectionBubble(q.pillar);
    setTimeout(() => renderBenchmarkQuestion(q), 150);
  }
}

// ============================================================
// PERGUNTAS DE PERFIL
// ============================================================
function renderProfileQuestion(q) {
  appendQuestion(q.title);

  const chat = $('chat-inner');

  if (q.type === 'text' || q.type === 'email') {
    const wrap = document.createElement('div');
    wrap.className = 'text-input-wrap';
    wrap.innerHTML = `
      <input class="text-input" id="txt-field" type="${q.type}" placeholder="${q.placeholder}" autocomplete="${q.type === 'email' ? 'email' : 'name'}">
      <button class="btn-continuar" id="btn-continuar">Continuar →</button>
    `;
    chat.appendChild(wrap);
    scrollChat();

    const field = $('txt-field');
    const btn = $('btn-continuar');
    setTimeout(() => field.focus(), 100);

    const submit = () => {
      const val = field.value.trim();
      if (!val) return;
      if (q.type === 'email' && !val.includes('@')) { field.style.borderColor = '#EF4444'; return; }
      removeCurrentInput();
      appendUserBubble(val);
      state.profileAnswers[q.id] = val;

      // Atualiza sidebar
      if (q.id === 'nome')       updateSidebarProfile('nome', val);
      if (q.id === 'funcao')     updateSidebarProfile('funcao', val);
      if (q.id === 'instituicao') updateSidebarProfile('instituicao', val);
      if (q.id === 'volume')     updateSidebarProfile('volume', val);

      state.currentStep++;
      saveState();
      setTimeout(renderNext, 350);
    };

    btn.addEventListener('click', submit);
    field.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

  } else if (q.type === 'dropdown') {
    const wrap = document.createElement('div');
    wrap.className = 'dropdown-wrap';
    const opts = q.options.map(s => `<option value="${s}">${s}</option>`).join('');
    wrap.innerHTML = `<select class="dropdown-select" id="drop-field"><option value="">Selecione seu estado</option>${opts}</select>`;
    chat.appendChild(wrap);
    scrollChat();

    $('drop-field').addEventListener('change', function() {
      if (!this.value) return;
      const val = this.value;
      removeCurrentInput();
      appendUserBubble(val);
      state.profileAnswers[q.id] = val;
      state.currentStep++;
      saveState();
      setTimeout(renderNext, 350);
    });

  } else if (q.type === 'single') {
    const wrap = document.createElement('div');
    wrap.className = 'options-wrap';
    wrap.innerHTML = q.options.map((opt, i) =>
      `<button class="option-btn" data-i="${i}">${opt}</button>`
    ).join('');
    chat.appendChild(wrap);
    scrollChat();

    wrap.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const val = q.options[parseInt(this.dataset.i)];
        removeCurrentInput();
        appendUserBubble(val);
        state.profileAnswers[q.id] = val;

        if (q.id === 'funcao')     updateSidebarProfile('funcao', val);
        if (q.id === 'instituicao') updateSidebarProfile('instituicao', val);
        if (q.id === 'volume')     updateSidebarProfile('volume', val);

        state.currentStep++;
        saveState();
        setTimeout(renderNext, 350);
      });
    });
  }
}

// ============================================================
// PERGUNTAS DO BENCHMARK
// ============================================================
function renderBenchmarkQuestion(q) {
  appendQuestion(q.title);

  const chat = $('chat-inner');
  const wrap = document.createElement('div');
  wrap.className = 'options-wrap';
  wrap.innerHTML = q.options.map((opt, i) =>
    `<button class="option-btn" data-i="${i}">${opt.label}</button>`
  ).join('');
  chat.appendChild(wrap);
  scrollChat();

  wrap.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.i);
      const opt = q.options[idx];
      const pillarLabel = SECTIONS[q.pillar]?.label || '';

      removeCurrentInput();
      appendUserBubble(opt.label, opt.score, pillarLabel);

      state.benchmarkAnswers[q.id] = idx;
      state.scores[q.pillar] += opt.score;
      state.currentStep++;
      saveState();
      updateSidebarScores();

      // Badge individual
      if (idx === q.options.length - 1) {
        updateSidebarBadges(q.badge);
        setTimeout(() => showBadgeToast(q.badge), 400);
      }

      setTimeout(renderNext, 350);
    });
  });
}

// ============================================================
// BADGE TOAST — canto superior direito (estilo FSM)
// ============================================================
function showBadgeToast(badge) {
  const old = document.querySelector('.badge-toast');
  if (old) { old.classList.add('bt-out'); setTimeout(() => old.remove(), 300); }

  // Extrai emoji e nome do label (ex: "🔒 Dados Protegidos")
  const parts = badge.label.split(' ');
  const emoji = parts[0];
  const name = parts.slice(1).join(' ');

  const t = document.createElement('div');
  t.className = 'badge-toast';
  t.innerHTML = `
    <span class="bt-icon">${emoji}</span>
    <div>
      <div class="bt-title">Badge desbloqueada: ${name}</div>
    </div>
  `;
  document.body.appendChild(t);

  requestAnimationFrame(() => t.classList.add('bt-visible'));
  setTimeout(() => {
    t.classList.add('bt-out');
    setTimeout(() => t.remove(), 400);
  }, 3200);
}

// ============================================================
// FINALIZAÇÃO
// ============================================================
function finishAssessment() {
  state.phase = 'results';
  state.persona   = detectPersona(state.scores);
  state.swot      = computeSWOT(state.scores);
  state.unlockedBadges = detectBadges(state.benchmarkAnswers, state.scores);
  state.slug      = generateSlug(state.profileAnswers.nome || 'clinica');
  saveState();

  revealPersonaInSidebar(state.persona);
  submitToBackend();
  renderResults();

  setTimeout(() => showScreen('screen-results'), 600);
}

// ============================================================
// RESULTADOS — dark FSM-style
// ============================================================
function renderResults() {
  const { scores, persona, swot, unlockedBadges, profileAnswers } = state;

  // Data
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const now = new Date();
  $('rd-date').textContent = `${months[now.getMonth()].toUpperCase()} · ${now.getFullYear()}`;

  // Perfil
  const profileRows = [
    { icon: '👤', label: 'Nome',       val: profileAnswers.nome },
    { icon: '💼', label: 'Função',     val: profileAnswers.funcao },
    { icon: '🏥', label: 'Instituição',val: profileAnswers.instituicao },
    { icon: '📊', label: 'Volume',     val: profileAnswers.volume }
  ];
  $('rd-profile').innerHTML = profileRows.map(r => `
    <div class="rdp-row">
      <div class="rdp-icon">${r.icon}</div>
      <span class="rdp-label">${r.label}</span>
      <span class="rdp-value">${r.val || '—'}</span>
    </div>
  `).join('');

  // Persona
  const tierLabels = { elite: 'Elite', dominancia: 'Especialista', equilibrio: 'Em desenvolvimento' };
  $('rd-persona').innerHTML = `
    <div class="rd-persona-card">
      <div class="rdpc-label">Persona — ${tierLabels[persona.tier] || ''}</div>
      <div class="rdpc-icon-row">
        <div class="rdpc-icon">✦</div>
        <div class="rdpc-name">${persona.label}</div>
      </div>
      <div class="rdpc-text">${persona.text}</div>
    </div>
  `;

  // Radar resultado
  const pillarsConfig = [
    { key: 'seguranca',          icon: '🛡️', name: 'Segurança',          color: '#A2C96E' },
    { key: 'processos',          icon: '📋', name: 'Processos',          color: '#10B981' },
    { key: 'interoperabilidade', icon: '🔗', name: 'Interoperabilidade', color: '#8B5CF6' },
    { key: 'inteligencia',       icon: '🧠', name: 'Inteligência',       color: '#F59E0B' }
  ];

  new Chart($('result-radar').getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['Segurança','Processos','Interop.','Inteligência'],
      datasets: [{
        data: [scores.seguranca, scores.processos, scores.interoperabilidade, scores.inteligencia],
        backgroundColor: 'rgba(162,201,110,.15)',
        borderColor: '#A2C96E',
        borderWidth: 2,
        pointBackgroundColor: ['#A2C96E','#10B981','#8B5CF6','#F59E0B'],
        pointBorderColor: 'rgba(255,255,255,.2)',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true, min: 0, max: 100,
          ticks: { display: false },
          grid: { color: 'rgba(255,255,255,.07)' },
          pointLabels: {
            font: { size: 11, family: 'Inter', weight: '700' },
            color: ctx => ['#A2C96E','#10B981','#8B5CF6','#F59E0B'][ctx.index] || '#BDC2B7',
            callback: (label, index) => {
              const vals = [scores.seguranca, scores.processos, scores.interoperabilidade, scores.inteligencia];
              return [String(vals[index]), label];
            }
          }
        }
      },
      plugins: { legend: { display: false } }
    }
  });

  // Pilares
  $('rd-pillars').innerHTML = pillarsConfig.map(p => {
    const score = scores[p.key];
    const text = getPillarText(p.key, score);
    return `
      <div class="rdp-card">
        <div>
          <div class="rdpc-top">
            <div class="rdpc-pillar-icon">${p.icon}</div>
            <span class="rdpc-pillar-name">${p.name}</span>
          </div>
          <div class="rdpc-bar-wrap">
            <div class="rdpc-bar" style="width:${score}%;background:${p.color}"></div>
          </div>
          <div class="rdpc-desc">${text}</div>
        </div>
        <div class="rdpc-score-big" style="color:${getScoreColor(score)}">${score}</div>
      </div>
    `;
  }).join('');

  // Badges — mostrar TODOS (locked + unlocked), igual FSM
  const unlockedIds = new Set(unlockedBadges.map(b => b.id));
  const allBadges = [
    ...BENCHMARK_QUESTIONS.map(q => q.badge),
    ...SPECIAL_BADGES.map(b => ({ id: b.id, label: b.label }))
  ];
  const totalUnlocked = unlockedBadges.length;

  $('rd-badges-count').textContent = `${totalUnlocked} CONQUISTADA${totalUnlocked !== 1 ? 'S' : ''}`;

  $('rd-badges').innerHTML = `
    <div class="rd-badges-counter">${totalUnlocked} / ${allBadges.length}</div>
    <div class="rd-badges-grid">
      ${allBadges.map(b => {
        const isUnlocked = unlockedIds.has(b.id);
        const parts = b.label.split(' ');
        const emoji = parts[0];
        const name = parts.slice(1).join(' ');
        return `
          <div class="rdb-card ${isUnlocked ? 'unlocked' : ''}">
            <div class="rdb-icon">${emoji}</div>
            <div class="rdb-name">${name}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // SWOT
  const swotCfg = [
    { key: 'forcas',        icon: '💪', label: 'Forças',        cls: 'rds-forcas' },
    { key: 'fraquezas',     icon: '🔴', label: 'Fraquezas',     cls: 'rds-fraquezas' },
    { key: 'oportunidades', icon: '🎯', label: 'Oportunidades', cls: 'rds-oportunidades' },
    { key: 'alertas',       icon: '⚠️', label: 'Alertas',       cls: 'rds-alertas' }
  ];

  $('rd-swot').innerHTML = swotCfg.map(s => {
    const items = swot[s.key];
    const inner = items.length
      ? items.map(t => `
          <div class="rds-item">
            <div class="rds-dot"></div>
            <span>${t.text || t}</span>
          </div>`)
        .join('')
      : `<div class="rds-empty">Nenhuma identificada.</div>`;
    return `
      <div class="rds-box ${s.cls}">
        <div class="rds-header">
          <div class="rds-circle">${s.icon}</div>
          <span class="rds-title">${s.label}</span>
        </div>
        <div class="rds-divider"></div>
        <div class="rds-items">${inner}</div>
      </div>
    `;
  }).join('');
}

// ============================================================
// SUPABASE / BACKEND
// ============================================================
async function submitToBackend() {
  try {
    await fetch('/.netlify/functions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug:                     state.slug,
        nome:                     state.profileAnswers.nome,
        email:                    state.profileAnswers.email,
        funcao:                   state.profileAnswers.funcao,
        instituicao:              state.profileAnswers.instituicao,
        estado:                   state.profileAnswers.estado,
        volume_mensal:            state.profileAnswers.volume,
        objetivo:                 state.profileAnswers.objetivo,
        score_seguranca:          state.scores.seguranca,
        score_processos:          state.scores.processos,
        score_interoperabilidade: state.scores.interoperabilidade,
        score_inteligencia:       state.scores.inteligencia,
        score_geral:              Math.round(avg(state.scores) * 100) / 100,
        persona:                  state.persona?.label,
        badges:                   state.unlockedBadges,
        swot:                     state.swot,
        answers:                  state.benchmarkAnswers
      })
    });
  } catch(e) { console.warn('Backend offline (local mode):', e.message); }
}

// ============================================================
// WHATSAPP GATE
// ============================================================
async function submitWhatsApp() {
  const val = $('wg-input').value.trim();
  if (!val) { $('wg-input').focus(); return; }
  const btn = $('btn-whatsapp');
  btn.textContent = '...'; btn.disabled = true;
  try {
    await fetch('/.netlify/functions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: state.slug, whatsapp: val, _update: true })
    });
  } catch(e) {}
  $('whatsapp-gate').style.display = 'none';
  $('wg-confirm').style.display = 'block';
}

function initWhatsApp() {
  $('btn-whatsapp').addEventListener('click', submitWhatsApp);
  $('btn-skip').addEventListener('click', () => { $('whatsapp-gate').style.display = 'none'; });

  // Botão no header
  $('btn-whatsapp-header').addEventListener('click', () => {
    $('whatsapp-gate').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => $('wg-input').focus(), 600);
  });

  // Restart
  $('btn-restart').addEventListener('click', () => {
    localStorage.removeItem('neurogram_diag_v2');
    location.reload();
  });
}

// ============================================================
// INIT
// ============================================================
function init() {
  setDate();
  initWelcomeRadar();

  $('btn-start').addEventListener('click', () => {
    showScreen('screen-assessment');
    initRadarChart();
    setTimeout(() => {
      appendBotBubble('Olá! Vou guiar você pelo diagnóstico de maturidade operacional da sua clínica.');
      setTimeout(renderNext, 500);
    }, 200);
  });

  initWhatsApp();
  showScreen('screen-welcome');
}

document.addEventListener('DOMContentLoaded', init);
