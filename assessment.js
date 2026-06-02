// FSM Self-Assessment — engine step-based (chat-style + gamified profile) (v1)
import {
  QUESTIONS,
  PILLAR_MAX,
  PILLAR_LABELS,
  BADGES,
  computeScores,
  buildSteps,
  detectUnlockedBadges,
  detectProgressMessages,
  detectPersona,
  AFTER_MESSAGES,
  ANALYSIS_STEPS,
  ANALYSIS_VIDEO,
  FINAL_VIDEO,
  SALES_VIDEO,
} from './assessment-flow.js?v=23';

const STEPS = buildSteps();
const QUESTION_COUNT = QUESTIONS.length;

// ---------- State ----------
const STORAGE_KEY = 'fsm_assessment_v1';
const state = {
  cursor: 0,                  // index in STEPS — what's currently rendering as the "active" step
  shownUpTo: -1,              // how many message-steps have already been rendered (kept on screen)
  answers: {},                // { questionId: optionIndex (number) | text (string) for type='text' }
  videoCompleted: {},         // { videoId: true }
  unlockedBadges: new Set(),  // ids of badges already revealed (avoids re-flashing)
  shownProgressMessages: new Set(),  // ids of dynamic progress messages already shown
  previousScores: { gestao: 0, growth: 0, branding: 0, dados: 0 },  // pra calcular delta "+N"
  // Marcos que disparam notificação no badge da aba "Resultado":
  // pilar finalizado (4 max) + perfil finalizado (1 max). Bumps com base nessas
  // mudanças + novas badges (resto das atualizações é ruído visual).
  completedPillars: new Set(),  // ids dos pilares com todas as perguntas respondidas
  profileComplete: false,       // nome + cargo + modelo_negocio + objetivo todos preenchidos
  lead: null,
  scores: null,
  result: null,
  shareSlug: null,            // cached após primeiro share — reusa em clicks subsequentes
};

// ---------- Turnstile (anti-bot) ----------
const TURNSTILE_SITE_KEY = '0x4AAAAAADSdarcf05QwLcbs';

let _turnstileWidgetId = null;
let _turnstileResolve = null;

window.__turnstileInit = function() {
  if (!window.turnstile) return;
  const el = document.getElementById('cf-turnstile');
  if (!el) return;
  try {
    _turnstileWidgetId = window.turnstile.render(el, {
      sitekey: TURNSTILE_SITE_KEY,
      size: 'invisible',
      callback: (token) => {
        if (_turnstileResolve) { const r = _turnstileResolve; _turnstileResolve = null; r(token || ''); }
      },
      'error-callback': () => {
        if (_turnstileResolve) { const r = _turnstileResolve; _turnstileResolve = null; r(''); }
      },
      'expired-callback': () => {
        if (_turnstileResolve) { const r = _turnstileResolve; _turnstileResolve = null; r(''); }
      },
    });
  } catch (err) {
    console.warn('[turnstile] render failed:', err);
  }
};

if (window.__turnstileLoaded) window.__turnstileInit();

function getTurnstileToken() {
  return new Promise((resolve) => {
    let waited = 0;
    const tryGet = () => {
      if (window.turnstile && _turnstileWidgetId !== null) {
        _turnstileResolve = resolve;
        // 10s timeout fallback — não trava o user se Turnstile falhar
        setTimeout(() => {
          if (_turnstileResolve === resolve) { _turnstileResolve = null; resolve(''); }
        }, 10000);
        try {
          window.turnstile.reset(_turnstileWidgetId);
          window.turnstile.execute(_turnstileWidgetId);
        } catch (_) { resolve(''); }
      } else if (waited < 5000) {
        waited += 100;
        setTimeout(tryGet, 100);
      } else {
        resolve('');
      }
    };
    tryGet();
  });
}

// ---------- Persistence ----------
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cursor: state.cursor,
      shownUpTo: state.shownUpTo,
      answers: state.answers,
      videoCompleted: state.videoCompleted,
    }));
  } catch (_) {}
}
function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

// ---------- Tracking ----------
function track(event, params = {}) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

// ---------- UTM ----------
const UTMS = (() => {
  const u = {};
  const url = new URLSearchParams(window.location.search);
  for (const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']) {
    const v = url.get(k); if (v) u[k] = v;
  }
  return u;
})();

// Anexa UTMs (e sck/src = utm_campaign no padrão Hotmart) a uma URL. Usado pra
// propagar atribuição até o checkout — mesma lógica do script global que roda
// nas landings (fsm.html, edu-led-growth.html, plano-head-de-marketing.html).
function hotmartUrlWithUtms(baseUrl) {
  try {
    const url = new URL(baseUrl);
    for (const [k, v] of Object.entries(UTMS)) url.searchParams.set(k, v);
    if (UTMS.utm_campaign) {
      url.searchParams.set('sck', UTMS.utm_campaign);
      url.searchParams.set('src', UTMS.utm_campaign);
    }
    return url.toString();
  } catch (_) { return baseUrl; }
}

// ---------- View management ----------
function setView(view) {
  document.body.setAttribute('data-view', view);
  document.querySelectorAll('.assess__view').forEach(el => {
    el.setAttribute('aria-hidden', el.dataset.view === view ? 'false' : 'true');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const SECTION_LABELS = {
  perfil: 'Perfil',
  growth: 'Growth',
  branding: 'Branding',
  dados: 'Dados',
  gestao: 'Gestão',
};

// Section ordering used in the progress bar
const SECTION_ORDER = ['perfil', 'growth', 'branding', 'dados', 'gestao'];

// Pre-compute: which question IDs belong to each section, in order.
const SECTION_QUESTIONS = (() => {
  const map = {};
  for (const key of SECTION_ORDER) map[key] = [];
  for (const q of QUESTIONS) {
    if (map[q.section]) map[q.section].push(q.id);
  }
  return map;
})();

// ---------- Progress (single bar + step indicators) ----------
// Toggle a shadow on the sticky progress bar once it's actually stuck.
let _stickyObserver = null;
function setupStickyObserver() {
  if (_stickyObserver) return;
  const progress = document.querySelector('.assess__progress');
  if (!progress) return;
  // Use a sentinel placed just above the progress bar to detect when it leaves the viewport.
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;';
  progress.before(sentinel);
  _stickyObserver = new IntersectionObserver(
    ([entry]) => {
      progress.classList.toggle('is-stuck', !entry.isIntersecting);
    },
    { threshold: 0, rootMargin: '0px 0px 0px 0px' }
  );
  _stickyObserver.observe(sentinel);
}

// Progress bar fluida única — % global do flow.
// Marcos macro: respondendo (0-65%) → análise (65-85%) → lead (85-95%) → resultado (100%)
function renderProgressSkeleton() {
  // sem skeleton — a barra já vem renderizada no HTML
}

function getCurrentSection() {
  const cursorStep = STEPS[state.cursor];
  if (cursorStep && cursorStep.section) return cursorStep.section;
  for (let i = state.cursor - 1; i >= 0; i--) {
    const s = STEPS[i];
    if (s?.type === 'question' && state.answers[s.id] !== undefined && s.section) {
      return s.section;
    }
  }
  return 'perfil';
}

function calcGlobalProgress() {
  const stage = document.body.dataset.stage;
  const view = document.body.dataset.view;

  if (stage === 'ready') return 100;
  if (stage === 'share-gate') return 95;
  if (view === 'lead') return 88;
  if (stage === 'analyzing') {
    // Análise no chat: 70% ao entrar; 80% quando IA termina (sobe pra
    // share-gate quando renderResult roda)
    return analysisGate?.apiDone ? 80 : 70;
  }
  // No flow: "dumb progress bar" sutil — perguntas têm pesos diferentes,
  // front-loaded mas sem saltos absurdos. Conta apenas perguntas respondidas
  // (não cada step), o que faz o user perceber só nos avanços reais.
  //   1-10:  peso 2.0
  //   11-20: peso 1.5
  //   21-30: peso 1.2
  //   31+:   peso 0.5  (cria a sensação de "travar" perto do fim)
  if (view === 'flow') {
    const relevantes = QUESTIONS.filter(q => q.section);
    const peso = (i) => (i < 10 ? 2 : i < 20 ? 1.5 : i < 30 ? 1.2 : 0.5);
    let acumulados = 0, maximos = 0;
    for (let i = 0; i < relevantes.length; i++) {
      const w = peso(i);
      maximos += w;
      if (state.answers[relevantes[i].id] !== undefined) acumulados += w;
    }
    const ratio = maximos > 0 ? acumulados / maximos : 0;
    const pct = ratio * 65;
    return Math.max(0, Math.min(65, Math.round(pct)));
  }
  return 0;
}

function updateProgress() {
  const fillEl = document.querySelector('[data-progress-fill]');
  if (!fillEl) return;
  fillEl.style.width = `${calcGlobalProgress()}%`;
}

// ---------- Step rendering ----------
const stackEl = () => document.querySelector('[data-step-stack]');

// Chama atenção pro painel de Resultado quando o user é instruído (logo após o
// nome) que ele atualiza em tempo real.
//   Desktop: "tchan ran" — entrance forte da linha inteira do nome no painel
//            (1×) + pulse sutil no card. O painel já está visível.
//   Mobile:  empurrão na aba "Resultado" (pulse + seta 👆) que PERSISTE até o
//            user tocar nela — clearOnboardingNudge(). Empurrão, não bloqueio.
function triggerOnboardingHighlight() {
  const nameRow = document.querySelector('[data-ident-key="nome"]');
  if (nameRow) {
    nameRow.classList.remove('is-onboarding-entrance', 'is-onboarding-pulse');
    void nameRow.offsetWidth;        // reflow → reinicia a animação do zero
    nameRow.classList.add('is-onboarding-entrance');
    // Depois da entrance (~1.3s), segue pulsando ~2s — garante que o user viu,
    // mesmo que ainda estivesse lendo a mensagem do chat.
    setTimeout(() => {
      nameRow.classList.remove('is-onboarding-entrance');
      nameRow.classList.add('is-onboarding-pulse');
      setTimeout(() => nameRow.classList.remove('is-onboarding-pulse'), 2100);
    }, 1300);
  }
  const reportCard = document.querySelector('.fsm-report');
  if (reportCard) {
    reportCard.classList.add('is-onboarding');
    setTimeout(() => reportCard.classList.remove('is-onboarding'), 5200);
  }
  document.querySelector('.assess__tab[data-tab="report"]')?.classList.add('is-onboarding');
  document.querySelector('.assess__tabs')?.classList.add('has-onboarding-nudge');
}

// Remove o empurrão da aba "Resultado" — chamado quando o user toca nela
// (setupTabs) ou quando a fase de perguntas acaba.
function clearOnboardingNudge() {
  document.querySelector('.assess__tab[data-tab="report"]')?.classList.remove('is-onboarding');
  document.querySelector('.assess__tabs')?.classList.remove('has-onboarding-nudge');
}

function clearActiveCard() {
  // Remove TODOS os cards ativos no DOM (não só o primeiro).
  // Necessário porque múltiplos data-active-step podem coexistir — ex: video-message
  // anterior que ficou marcado + question atual. Antes era querySelector singular e
  // removia o vídeo, deixando o card da pergunta (com botão Continuar) visível.
  document.querySelectorAll('[data-active-step]').forEach(el => el.remove());
}

const BOT_AVATAR_SRC = 'assets/arthur-avatar.jpg';

// Reposiciona o avatar floating pra ficar alinhado com a última bot bubble
// (ou typing indicator) — efeito de "deslizar para baixo" via CSS transition.
function positionFloatingAvatar() {
  const stack = stackEl();
  const floating = stack?.querySelector('[data-floating-avatar]');
  if (!stack || !floating) return;
  const bots = stack.querySelectorAll('.assess__bubble--bot, .assess__bubble--typing');
  if (bots.length === 0) {
    floating.classList.remove('is-visible');
    return;
  }
  const last = bots[bots.length - 1];
  requestAnimationFrame(() => {
    floating.style.transform = `translateY(${last.offsetTop}px)`;
    floating.classList.add('is-visible');
  });
}

function appendMessageBubble(html) {
  const li = document.createElement('li');
  li.className = 'assess__bubble assess__bubble--bot';
  li.dataset.persistent = '1';
  li.innerHTML = `
    <span class="assess__bubble-avatar" aria-hidden="true"></span>
    <div class="assess__bubble-text">${interpolateMessage(html)}</div>
  `;
  stackEl().appendChild(li);
  positionFloatingAvatar();
  requestAnimationFrame(() => li.classList.add('is-in'));
  setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'end' }), 30);

  // Onboarding glow: se a bubble contém [data-onboarding-result], chama atenção
  // pra atualização automática do painel de Resultado (mobile = tab; desktop = card).
  if (li.querySelector('[data-onboarding-result]')) {
    triggerOnboardingHighlight();
  }
}

function appendUserBubble(questionId, text) {
  const li = document.createElement('li');
  li.className = 'assess__bubble assess__bubble--user';
  li.dataset.questionId = questionId;
  li.dataset.persistent = '1';

  const textSpan = document.createElement('span');
  textSpan.className = 'assess__bubble-text';
  textSpan.textContent = text;
  li.appendChild(textSpan);

  // Botão de editar só pra respostas de perguntas reais (não pra CTAs/lead).
  const isEditableQuestion = STEPS.some(s => s.type === 'question' && s.id === questionId);
  if (isEditableQuestion) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'assess__bubble-edit';
    editBtn.setAttribute('aria-label', 'Editar esta resposta');
    editBtn.title = 'Editar esta resposta';
    editBtn.innerHTML = '<span aria-hidden="true">✎</span>';
    editBtn.addEventListener('click', () => goBackToQuestion(questionId));
    li.appendChild(editBtn);
  }

  stackEl().appendChild(li);
  requestAnimationFrame(() => li.classList.add('is-in'));
  setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'end' }), 30);
}

function showTypingIndicator() {
  removeTypingIndicator();
  const li = document.createElement('li');
  li.className = 'assess__bubble assess__bubble--typing';
  li.dataset.typing = '1';
  li.innerHTML = `
    <span class="assess__bubble-avatar" aria-hidden="true"></span>
    <div class="assess__bubble-text"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
  `;
  stackEl().appendChild(li);
  positionFloatingAvatar();
  requestAnimationFrame(() => li.classList.add('is-in'));
  setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'end' }), 20);
}

function removeTypingIndicator() {
  const t = document.querySelector('[data-typing]');
  if (t) t.remove();
  positionFloatingAvatar();
}

function appendQuestionCard(step) {
  const card = document.createElement('li');
  card.className = 'assess__bubble assess__bubble--question';
  card.dataset.activeStep = 'question';
  card.dataset.questionId = step.id;

  const isText = step.inputType === 'text';
  let bodyHtml;

  if (isText) {
    const current = state.answers[step.id];
    const value = typeof current === 'string' ? current : '';
    bodyHtml = `
      <input
        type="text"
        class="assess__text-input"
        data-text-input
        placeholder="${escapeHtml(step.placeholder || '')}"
        minlength="${step.minLength ?? 1}"
        maxlength="${step.maxLength ?? 120}"
        value="${escapeHtml(value)}"
        autocomplete="given-name"
        spellcheck="false"
      >
    `;
  } else {
    bodyHtml = `
      <fieldset class="assess__options">
        <legend class="sr-only">Opções de resposta</legend>
        ${step.options.map((opt, i) => {
          const pressed = state.answers[step.id] === i;
          return `
            <button type="button" class="assess__option" data-option-index="${i}" aria-pressed="${pressed}">
              ${escapeHtml(opt.label)}
            </button>
          `;
        }).join('')}
      </fieldset>
    `;
  }

  const hasAnswer = isText
    ? (typeof state.answers[step.id] === 'string' && state.answers[step.id].trim().length >= (step.minLength ?? 1))
    : state.answers[step.id] !== undefined;

  // single-choice questions auto-advance on click, so the "Continuar"
  // button is not needed. Text questions still need it.
  const nextBtnHtml = isText
    ? `<button type="button" class="assess__nav-btn assess__nav-btn--primary" data-action="next" ${hasAnswer ? '' : 'disabled'}>
         Continuar <span aria-hidden="true">→</span>
       </button>`
    : '';

  card.innerHTML = `
    <article class="assess__q">
      <p class="assess__q-prompt">${escapeHtml(step.prompt)}</p>
      ${bodyHtml}
      ${nextBtnHtml ? `<nav class="assess__nav">${nextBtnHtml}</nav>` : ''}
    </article>
  `;

  if (isText) {
    const input = card.querySelector('[data-text-input]');
    const nextBtn = card.querySelector('[data-action="next"]');
    const minLen = step.minLength ?? 1;
    input.addEventListener('input', () => {
      const v = input.value.trim();
      if (v.length >= minLen) {
        state.answers[step.id] = v;
        nextBtn.disabled = false;
      } else {
        delete state.answers[step.id];
        nextBtn.disabled = true;
      }
      saveState();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !nextBtn.disabled) {
        e.preventDefault();
        nextBtn.click();
      }
    });
    // autofocus on text questions
    setTimeout(() => input.focus(), 100);
  } else {
    // Single-choice: click on an option auto-advances after a short delay,
    // giving visual feedback. Clicking another option resets the timer so
    // the user can change their mind without seeing the flow jump.
    let autoAdvanceTimer = null;
    const AUTO_ADVANCE_MS = 380;
    card.querySelectorAll('.assess__option').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.optionIndex);
        state.answers[step.id] = idx;
        saveState();
        card.querySelectorAll('.assess__option').forEach(b => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        const nextBtn = card.querySelector('[data-action="next"]');
        if (nextBtn) nextBtn.disabled = false;

        if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = setTimeout(() => {
          // only advance if this card is still active (user didn't navigate away)
          if (card.isConnected && card.dataset.activeStep === 'question') advance();
        }, AUTO_ADVANCE_MS);
      });
    });
  }
  const nextBtn = card.querySelector('[data-action="next"]');
  if (nextBtn) nextBtn.addEventListener('click', advance);

  stackEl().appendChild(card);
  requestAnimationFrame(() => card.classList.add('is-in'));
  setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
}

function appendVideoCard(step) {
  const card = document.createElement('li');
  card.className = 'assess__bubble assess__bubble--video';
  card.dataset.activeStep = 'video';
  card.dataset.videoId = step.id;

  card.innerHTML = `
    <article class="assess__video">
      <h2 class="assess__video-title">${escapeHtml(step.title || 'Antes de seguir, assista:')}</h2>
      ${step.description ? `<p class="assess__video-desc">${escapeHtml(step.description)}</p>` : ''}
      <div class="assess__video-frame">
        <video
          controls
          ${step.poster ? `poster="${escapeHtml(step.poster)}"` : ''}
          preload="metadata"
          playsinline
          data-video-player
        >
          <source src="${escapeHtml(step.src)}">
          Seu navegador não suporta vídeo HTML5.
        </video>
        <p class="assess__video-status" data-video-status>Assista o vídeo completo para liberar o próximo passo.</p>
      </div>
      <nav class="assess__nav">
        <button type="button" class="assess__nav-btn assess__nav-btn--primary" data-action="next" disabled>
          Continuar <span aria-hidden="true">→</span>
        </button>
      </nav>
    </article>
  `;

  const video = card.querySelector('[data-video-player]');
  const status = card.querySelector('[data-video-status]');
  const nextBtn = card.querySelector('[data-action="next"]');

  // prevent skipping forward by clamping currentTime to max watched
  let maxWatched = 0;
  video.addEventListener('timeupdate', () => {
    if (video.currentTime > maxWatched + 0.5) video.currentTime = maxWatched;
    else maxWatched = Math.max(maxWatched, video.currentTime);
  });
  video.addEventListener('seeking', () => {
    if (video.currentTime > maxWatched + 0.5) video.currentTime = maxWatched;
  });
  video.addEventListener('ended', () => {
    state.videoCompleted[step.id] = true;
    saveState();
    status.textContent = 'Vídeo concluído ✓';
    status.classList.add('is-done');
    nextBtn.disabled = false;
  });

  // restore completed state on re-render
  if (state.videoCompleted[step.id]) {
    status.textContent = 'Vídeo concluído ✓';
    status.classList.add('is-done');
    nextBtn.disabled = false;
  }

  nextBtn.addEventListener('click', advance);

  stackEl().appendChild(card);
  requestAnimationFrame(() => card.classList.add('is-in'));
  setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
}

// ---------- Step driver (chat-paced) ----------
const TIMING = {
  typingDelay: 900,            // typing indicator visible BEFORE the first message after a user action
  typingDelayCascade: 700,     // typing indicator visible BEFORE each message in a cascade
  pauseBeforeCascadeTyping: 500, // pause AFTER previous bubble before typing appears in cascade
  beforeQuestion: 1500,        // extra gap before a question/cta card appears
  afterUserAction: 500,        // short pause after user action before typing starts
};

let timerHandle = null;
function clearTimer() { if (timerHandle) { clearTimeout(timerHandle); timerHandle = null; } }
function schedule(fn, delay) { clearTimer(); timerHandle = setTimeout(fn, delay); }

function processCurrentStep() {
  if (state.cursor >= STEPS.length) return;
  const step = STEPS[state.cursor];
  if (step.type === 'message') {
    appendMessageBubble(step.html);
    state.cursor += 1;
    saveState();
    tickCascade();
  } else if (step.type === 'question') {
    appendQuestionCard(step);
    saveState();
    updateProgress();
    track('assessment_step', {
      step_index: STEPS.slice(0, state.cursor + 1).filter(s => s.type === 'question').length,
      step_total: QUESTION_COUNT,
      section: step.section,
      question_id: step.id,
    });
  } else if (step.type === 'video-gate') {
    appendVideoCard(step);
    saveState();
  } else if (step.type === 'video-message') {
    appendVideoMessage(step);
    saveState();
  } else if (step.type === 'cta') {
    appendCtaCard(step);
    saveState();
  } else if (step.type === 'lead-form') {
    // Fim da fase 1: captura email+whatsapp + inicia análise + entra na fase 2.
    // O cascade da fase 2 (vendas) é disparado pelo handleLeadSubmitInline,
    // não por STEPS — porque depende de await do form submit.
    appendLeadCard();
    saveState();
  }
}

function appendVideoMessage(step) {
  const li = document.createElement('li');
  li.className = 'assess__bubble assess__bubble--video-message';
  li.dataset.activeStep = 'video-message';

  // Config do vídeo vem do próprio step (preferencial) ou fallback p/ ANALYSIS_VIDEO.
  // Cada video-message escolhe sua source. Hoje só ANALYSIS_VIDEO usa video-message.
  const cfg = step.video || ANALYSIS_VIDEO;
  // gate=true: trava o avanço até o vídeo terminar (ex: video de boas-vindas).
  // gate=false (default): avança o cascade imediatamente e libera o CTA seguinte
  // quando o vídeo termina (ex: video da fase de análise + CTA reveal_result).
  const isGate = step.gate === true;

  // Callback ao "completar" o vídeo — comportamento depende do gate.
  // Steps avulsos (não vindo de STEPS, ex: vídeo final no renderResult) podem
  // passar step.onComplete pra customizar o que acontece quando termina.
  const onVideoComplete = () => {
    state.videoCompleted[step.id] = true;
    saveState();
    if (typeof step.onComplete === 'function') {
      step.onComplete();
    } else if (isGate) {
      advance();                  // só agora avança pra próxima pergunta
    } else {
      unlockRevealResultCta();    // cursor já avançou — destrava CTA seguinte
    }
  };

  if (!cfg.enabled) {
    // Placeholder enquanto não há vídeo gravado. Comportamento depende do gate:
    //   - gate=false (ex: vídeo de análise): auto-completa em 4.5s pra fluir
    //   - gate=true (ex: vídeo final): precisa de clique explícito do user
    //     pra liberar os botões de share/PDF (caso contrário o gate é fake)
    li.innerHTML = `
      <span class="assess__bubble-avatar" aria-hidden="true"></span>
      <div class="assess__bubble-video">
        <div class="video-frame video-frame--placeholder">
          <span class="play-icon" aria-hidden="true">▶</span>
          <p>Vídeo do Arthur</p>
          <p class="video-frame__sub">(em breve)</p>
          ${isGate ? `<button type="button" class="video-frame__placeholder-cta" data-placeholder-cta>Liberar meu relatório completo</button>` : ''}
        </div>
      </div>
    `;
    stackEl().appendChild(li);
    refreshFloatingAvatar();
    requestAnimationFrame(() => li.classList.add('is-in'));
    setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);

    if (isGate) {
      // Gated: aguarda clique do user no botão pra completar
      const cta = li.querySelector('[data-placeholder-cta]');
      if (cta) {
        cta.addEventListener('click', () => {
          cta.disabled = true;
          cta.textContent = '✓ Resultado liberado';
          onVideoComplete();
        });
      }
    } else {
      // Sem gate: avança o cascade já (pra que o CTA bloqueado apareça)
      state.cursor += 1;
      saveState();
      schedule(processCurrentStep, 200);
      setTimeout(onVideoComplete, 4500);
    }
    return;
  }

  // Vídeo real — bubble com player embedded.
  // Panda Video: embed por iframe (player do provedor). Sem pandaEmbed: cai
  // no player nativo <video> — usado pelo vídeo final gated, que escuta `ended`.
  const isPanda = !!cfg.pandaEmbed;
  const playerHtml = isPanda
    ? `<iframe src="${escapeHtml(cfg.pandaEmbed)}" title="Mensagem do Arthur" loading="lazy"
         allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture"
         allowfullscreen></iframe>`
    : `<video controls playsinline preload="metadata" data-msg-video ${cfg.poster ? `poster="${escapeHtml(cfg.poster)}"` : ''}>
        <source src="${escapeHtml(cfg.src)}">
      </video>`;
  li.innerHTML = `
    <span class="assess__bubble-avatar" aria-hidden="true"></span>
    <div class="assess__bubble-video">
      <div class="video-frame">${playerHtml}</div>
    </div>
  `;
  stackEl().appendChild(li);
  refreshFloatingAvatar();

  // Player nativo: detecta o fim pra disparar o onComplete do step (vídeo
  // final gated). Sem anti-seek — a pessoa navega o vídeo livremente.
  const video = li.querySelector('[data-msg-video]');
  if (video) {
    video.addEventListener('ended', () => {
      track(isGate ? 'assessment_intro_video_complete' : 'assessment_analysis_video_complete');
      onVideoComplete();
    });
  }

  requestAnimationFrame(() => li.classList.add('is-in'));
  setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);

  if (!isGate) {
    // Sem gate: avança o cascade pra renderizar o CTA logo abaixo do vídeo
    state.cursor += 1;
    saveState();
    schedule(processCurrentStep, 200);
  }
}

// Encontra o card do CTA `reveal_result` no chat e libera o botão.
function unlockRevealResultCta() {
  const ctaCard = document.querySelector('[data-cta-id="reveal_result"]');
  if (!ctaCard) return;
  const btn = ctaCard.querySelector('[data-cta-action]');
  if (!btn) return;
  btn.disabled = false;
  btn.removeAttribute('aria-disabled');
  ctaCard.removeAttribute('data-locked');
}

// helper local — usado pelos novos handlers
function refreshFloatingAvatar() {
  positionFloatingAvatar();
}

function appendCtaCard(step) {
  const li = document.createElement('li');
  li.className = 'assess__bubble assess__bubble--cta';
  li.dataset.activeStep = 'cta';
  li.dataset.ctaId = step.id;

  // reveal_result aparece BLOQUEADO até o vídeo terminar.
  // unlockRevealResultCta() libera depois do `ended` (ou após o timer do placeholder).
  const isRevealResult = step.action === 'reveal_result';
  const videoDone = isRevealResult ? !!state.videoCompleted['arthur_intro_video'] : true;
  const lockedAttrs = isRevealResult && !videoDone
    ? 'disabled aria-disabled="true" data-tooltip="aguardando você finalizar o vídeo"'
    : '';
  if (isRevealResult && !videoDone) li.dataset.locked = '1';

  li.innerHTML = `
    <span class="assess__bubble-avatar" aria-hidden="true"></span>
    <button type="button" class="assess__cta-submit" data-cta-action ${lockedAttrs}>
      <span aria-hidden="true">✓</span> ${escapeHtml(step.label)}
    </button>
  `;
  stackEl().appendChild(li);
  li.querySelector('[data-cta-action]').addEventListener('click', (e) => {
    if (e.currentTarget.disabled) return;
    if (step.action === 'start_analysis') startAnalysisInChat();
    else if (step.action === 'reveal_result') startLeadInChat();
  });
  requestAnimationFrame(() => li.classList.add('is-in'));
  setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
}

// Called after the user advances (Continuar / Começar). Shows typing
// indicator if the next step is a message; if it's a question, just pauses
// briefly so the user-bubble can settle.
function tickAfterUserAction() {
  if (state.cursor >= STEPS.length) return;
  const next = STEPS[state.cursor];
  if (next.type === 'message') {
    schedule(() => {
      showTypingIndicator();
      schedule(() => {
        removeTypingIndicator();
        processCurrentStep();
      }, TIMING.typingDelay);
    }, TIMING.afterUserAction);
  } else {
    // question or video — no typing indicator, just a pause
    schedule(processCurrentStep, TIMING.beforeQuestion);
  }
}

// Called while cascading through multiple bot messages.
function tickCascade() {
  if (state.cursor >= STEPS.length) return;
  const next = STEPS[state.cursor];
  if (next.type === 'message') {
    // pequena pausa após a bubble anterior, depois typing, depois a próxima mensagem
    schedule(() => {
      showTypingIndicator();
      schedule(() => {
        removeTypingIndicator();
        processCurrentStep();
      }, TIMING.typingDelayCascade);
    }, TIMING.pauseBeforeCascadeTyping);
  } else {
    // before a question/video/cta card appears, give the last message room to breathe
    schedule(processCurrentStep, TIMING.beforeQuestion);
  }
}

function advance() {
  const step = STEPS[state.cursor];
  if (step.type === 'question') {
    if (state.answers[step.id] === undefined) return;
    const displayText = step.inputType === 'text'
      ? String(state.answers[step.id] || '')
      : (step.options?.[state.answers[step.id]]?.label || '');
    clearActiveCard();
    appendUserBubble(step.id, displayText);
    updateReport();
    // Inject dynamic progress messages (e.g. "Tá mandando ver em Growth, hein?")
    injectProgressMessages();
  } else if (step.type === 'video-gate') {
    if (!state.videoCompleted[step.id]) return;
    clearActiveCard();
  }
  state.cursor += 1;
  saveState();
  tickAfterUserAction();
}

// Detects progress messages and splices them into STEPS at the current cursor.
// They will be picked up in the next tick as normal messages.
function injectProgressMessages() {
  const scores = computeScores(state.answers);
  const fresh = detectProgressMessages(state, scores, state.shownProgressMessages);
  if (fresh.length === 0) return;
  // Mark as shown so they don't repeat
  for (const m of fresh) state.shownProgressMessages.add(m.id);
  // Insert as message steps right after the current cursor (before any auto afterMessages)
  const insertAt = state.cursor + 1;
  const newSteps = fresh.map(m => ({ type: 'message', html: m.html, section: STEPS[state.cursor]?.section || 'intro', isDynamic: true }));
  STEPS.splice(insertAt, 0, ...newSteps);
}

// Pula direto pra uma pergunta específica (usado pelo lápis de "Editar"
// em cima das bolhas de resposta do usuário). Remove tudo dali pra frente
// no chat, recoloca a pergunta como card ativo, e ajusta o cursor.
function goBackToQuestion(targetId) {
  const targetIndex = STEPS.findIndex(s => s.type === 'question' && s.id === targetId);
  if (targetIndex < 0 || targetIndex === state.cursor) return;
  const stack = stackEl();
  const cards = Array.from(stack.children);
  let removing = false;
  for (const el of cards) {
    if (el.dataset.questionId === targetId) removing = true;
    if (removing) el.remove();
  }
  removeTypingIndicator();
  clearTimer();
  positionFloatingAvatar();
  state.cursor = targetIndex;
  saveState();
  processCurrentStep();
}

// ---------- Lead (após análise+vídeo) ----------
// Mantém o user no chat. Adiciona uma bot bubble explicando + um card de form
// inline (como se fosse mais uma pergunta extra).
function startLeadInChat() {
  // Mark CTA como respondido (vira user bubble curtinha)
  const ctaCard = document.querySelector('[data-cta-id="reveal_result"]');
  if (ctaCard) {
    appendUserBubble('reveal_result', 'Acessar minha análise');
    ctaCard.remove();
  }
  document.body.dataset.stage = 'lead';
  stopAnalyzingRotator();
  updateProgress();
  track('assessment_lead_view');

  // typing → bot message → lead card
  schedule(() => {
    showTypingIndicator();
    schedule(() => {
      removeTypingIndicator();
      appendMessageBubble('Deixe seu contato pra eu te enviar o material completo. 👇');
      schedule(() => {
        showTypingIndicator();
        schedule(() => {
          removeTypingIndicator();
          appendLeadCard();
        }, 600);
      }, 700);
    }, 800);
  }, 400);
}

function appendLeadCard() {
  const card = document.createElement('li');
  card.className = 'assess__bubble assess__bubble--question assess__bubble--lead';
  card.dataset.activeStep = 'lead-form';

  card.innerHTML = `
    <article class="assess__q">
      <form class="assess__form assess__form--inline" data-lead-form-inline novalidate>
        <label class="assess__field">
          <span>E-mail</span>
          <input type="email" name="email" required maxlength="120" autocomplete="email" inputmode="email" placeholder="voce@exemplo.com">
        </label>
        <label class="assess__field">
          <span>WhatsApp</span>
          <input type="tel" name="whatsapp" required autocomplete="tel" inputmode="tel" placeholder="(11) 9XXXX-XXXX" data-whatsapp-input-inline>
        </label>
        <nav class="assess__nav">
          <button type="submit" class="assess__nav-btn assess__nav-btn--primary" data-action="submit-lead-inline">
            Finalize meu assessment <span aria-hidden="true">→</span>
          </button>
        </nav>
        <p class="assess__form-error" data-form-error-inline role="alert" hidden></p>
      </form>
    </article>
  `;

  stackEl().appendChild(card);
  requestAnimationFrame(() => card.classList.add('is-in'));
  setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);

  // máscara BR pro whatsapp
  const whatsInput = card.querySelector('[data-whatsapp-input-inline]');
  if (whatsInput) {
    whatsInput.addEventListener('input', () => {
      const cursor = whatsInput.selectionStart;
      const before = whatsInput.value;
      whatsInput.value = formatBrPhone(whatsInput.value);
      const diff = whatsInput.value.length - before.length;
      try { whatsInput.setSelectionRange(cursor + diff, cursor + diff); } catch (_) {}
    });
  }

  // autofocus no email
  const email = card.querySelector('input[name="email"]');
  if (email) setTimeout(() => email.focus(), 200);

  const form = card.querySelector('[data-lead-form-inline]');
  form.addEventListener('submit', handleLeadSubmitInline);
}

async function handleLeadSubmitInline(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const email = form.email.value.trim();
  const whatsapp = form.whatsapp.value.trim();
  const errorEl = form.querySelector('[data-form-error-inline]');
  errorEl.hidden = true;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showFormError(errorEl, 'E-mail inválido. Confere a digitação?');
  if (!isValidBrPhone(whatsapp)) return showFormError(errorEl, 'WhatsApp inválido. Use (XX) XXXXX-XXXX.');

  // Compute scores agora (fase 1 acabou). state.lead pra logging/webhook.
  state.scores = computeScores(state.answers);
  const nome = String(state.answers.nome || '').trim();
  state.lead = { nome, email, whatsapp };
  track('assessment_lead_submit', { ...state.scores });

  // Mostra como "user bubble" (resumo dos dados) — sumiço do form
  const card = form.closest('.assess__bubble--lead');
  if (card) {
    appendUserBubble('lead', `${email} · ${whatsapp}`);
    card.remove();
  }

  // Lead + entrega do relatório viajam juntos no webhook único disparado por
  // /api/assessment (depois do Claude + KV save). Não há mais /api/lead aqui.

  // Avança cursor pra próximo step (deveria estar no fim de STEPS)
  state.cursor += 1;
  saveState();

  // Entra na fase 2: análise IA permanente em background + vídeo de vendas
  schedule(() => startSalesPhase(), 600);
}

// ---------- Fase 2: análise em background + chat de vendas ----------
// Após o lead enviar email+whats, a IA roda em background (não revela no UI)
// e o chat vira pitch de vendas. Painel de resultado trava em "analisando…
// em breve enviarei" pra sempre — material completo vai via email/whatsapp
// (webhook a ser implementado na próxima fase).
function startSalesPhase() {
  document.body.dataset.stage = 'analyzing';
  setTabBadgeStage('loading');
  updateProgress();
  // Para o rotator default e fixa subtext de "vou te enviar"
  stopAnalyzingRotator();
  const sub = document.querySelector('[data-analyzing-sub]');
  if (sub) {
    sub.classList.remove('is-in');
    void sub.offsetWidth;
    sub.textContent = 'Em breve, enviarei pro seu email e WhatsApp.';
    sub.classList.add('is-in');
  }
  // Esconde botões share/stories/PDF do painel — material vai por outros canais
  document.querySelectorAll('[data-share-btn], [data-story-btn], [data-pdf-btn]').forEach(b => {
    b.style.display = 'none';
  });

  // Dispara API da IA (resultado salvo internamente — UI não revela).
  // Webhook na próxima fase: salva slug em KV + envia URL por email/whats.
  submitToAPI();
  track('assessment_analysis_start');

  // Cascade da fase 2 — pitch de vendas
  schedule(() => {
    showTypingIndicator();
    schedule(() => {
      removeTypingIndicator();
      appendMessageBubble('Boa, {nome}! Já enviei pra IA processar. Em alguns minutos você recebe o material completo no email e WhatsApp. 📬');
      schedule(() => {
        showTypingIndicator();
        schedule(() => {
          removeTypingIndicator();
          appendMessageBubble('Agora deixa eu te falar uma coisa importante (e te oferecer um presentinho) 👇');
          schedule(() => {
            // Vídeo da VSL. A oferta cascateia ~10s depois: tempo pra pessoa
            // começar a ver o vídeo antes da tela rolar pra oferta. O vídeo
            // segue tocando enquanto a oferta aparece.
            appendVideoMessage({ id: 'sales_video', video: SALES_VIDEO });
            track('assessment_sales_video_shown');
            schedule(startOfferCascade, 10000);
          }, 700);
        }, 900);
      }, 800);
    }, 700);
  }, 400);
}

// ---------- Fase 2b: oferta pós-VSL ----------
// Editável sem regravar o vídeo — o VSL nunca fala o preço, então trocar
// valores aqui basta. checkoutPromo: criar a oferta no Hotmart e colar o link.
const OFFER = {
  fullPrice:     'R$ 497',
  promoPrice:    'R$ 69,90',
  checkoutPromo: 'https://pay.hotmart.com/V102416561D?off=8tzltwbq', // oferta R$ 69,90
  checkoutFull:  'https://pay.hotmart.com/V102416561D', // preço cheio — fallback pós-prazo
  windowHours:   24,
  includes: [
    '2 horas de aula direto ao ponto com o Arthur',
    'Agente de IA que lê suas respostas e monta seu PDI',
    '7 dias de garantia incondicional',
  ],
};
const OFFER_DEADLINE_KEY = 'fsm_offer_deadline_v1';
let offerTimer = null;

// Timestamp (ms) de expiração da condição. Criado na 1ª exibição e persistido
// — countdown estável entre reloads. Ao expirar, o card troca pro preço cheio
// (a "tela volta pro preço cheio" prometida no roteiro do VSL).
function offerDeadline() {
  try {
    const saved = parseInt(localStorage.getItem(OFFER_DEADLINE_KEY) || '', 10);
    if (Number.isFinite(saved)) return saved;
    const ts = Date.now() + OFFER.windowHours * 3600e3;
    localStorage.setItem(OFFER_DEADLINE_KEY, String(ts));
    return ts;
  } catch (_) {
    return Date.now() + OFFER.windowHours * 3600e3;
  }
}
function offerExpired() { return Date.now() >= offerDeadline(); }

function fmtCountdown(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const pad = n => String(n).padStart(2, '0');
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

// Cascata da oferta — roda sozinha logo depois do vídeo da VSL aparecer,
// sem esperar o vídeo terminar (o vídeo é encaixado, não um gate).
function startOfferCascade() {
  track('assessment_offer_shown');
  schedule(() => {
    showTypingIndicator();
    schedule(() => {
      removeTypingIndicator();
      appendMessageBubble('Tudo o que você precisa pra virar esse profissional tá no <strong>Plano Head de Marketing</strong>, o meu curso pra quem quer ocupar posições sêniores no marketing.');
      schedule(() => {
        showTypingIndicator();
        schedule(() => {
          removeTypingIndicator();
          appendMessageBubble('E porque você fez o assessment, eu liberei uma condição especial pra você. Tá aqui 👇');
          schedule(appendOfferCard, 700);
        }, 700);
      }, 800);
    }, 900);
  }, 400);
}

function appendOfferCard() {
  const li = document.createElement('li');
  li.className = 'assess__bubble assess__bubble--bot assess__bubble--offer';
  li.dataset.persistent = '1';
  li.innerHTML = `
    <span class="assess__bubble-avatar" aria-hidden="true"></span>
    <div class="assess__offer" data-offer-card></div>
  `;
  stackEl().appendChild(li);
  positionFloatingAvatar();
  paintOfferCard(li.querySelector('[data-offer-card]'));
  requestAnimationFrame(() => li.classList.add('is-in'));
  setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'end' }), 30);
}

// Renderiza o card no estado certo (ativo / expirado). Chamado na criação e
// de novo no instante exato em que o countdown zera.
function paintOfferCard(el) {
  if (!el) return;
  const expired = offerExpired();
  const incl = OFFER.includes.map(t => `<li>${escapeHtml(t)}</li>`).join('');

  if (expired) {
    el.innerHTML = `
      <p class="assess__offer-eyebrow">Plano Head de Marketing</p>
      <div class="assess__offer-price">
        <span class="assess__offer-now">${escapeHtml(OFFER.fullPrice)}</span>
      </div>
      <ul class="assess__offer-incl">${incl}</ul>
      <p class="assess__offer-expired">A condição de ${escapeHtml(OFFER.promoPrice)} liberada pra quem fez o assessment encerrou.</p>
      <a class="assess__offer-cta" href="${escapeHtml(hotmartUrlWithUtms(OFFER.checkoutFull))}" target="_blank" rel="noopener" data-offer-cta="full">
        Ver o curso <span aria-hidden="true">→</span>
      </a>
    `;
  } else {
    el.innerHTML = `
      <p class="assess__offer-eyebrow">Sua condição · Plano Head de Marketing</p>
      <div class="assess__offer-price">
        <span class="assess__offer-was">${escapeHtml(OFFER.fullPrice)}</span>
        <span class="assess__offer-now">${escapeHtml(OFFER.promoPrice)}</span>
      </div>
      <ul class="assess__offer-incl">${incl}</ul>
      <div class="assess__offer-timer">
        <span class="assess__offer-timer-label">Sua condição expira em</span>
        <span class="assess__offer-timer-clock" data-offer-countdown>${fmtCountdown(offerDeadline() - Date.now())}</span>
      </div>
      <a class="assess__offer-cta" href="${escapeHtml(hotmartUrlWithUtms(OFFER.checkoutPromo))}" target="_blank" rel="noopener" data-offer-cta="promo">
        Garantir meu acesso <span aria-hidden="true">→</span>
      </a>
      <p class="assess__offer-fine">Pagamento único · Compra segura via Hotmart</p>
    `;
  }

  const cta = el.querySelector('[data-offer-cta]');
  if (cta) cta.addEventListener('click', () => track('assessment_offer_click', { variant: cta.dataset.offerCta }));

  if (!expired) startOfferTimer(el);
}

function startOfferTimer(el) {
  if (offerTimer) clearInterval(offerTimer);
  const tick = () => {
    const remaining = offerDeadline() - Date.now();
    if (remaining <= 0) {
      clearInterval(offerTimer);
      offerTimer = null;
      track('assessment_offer_expired');
      paintOfferCard(el);   // troca pro estado expirado (preço cheio)
      return;
    }
    const clock = el.querySelector('[data-offer-countdown]');
    if (clock) clock.textContent = fmtCountdown(remaining);
  };
  tick();
  offerTimer = setInterval(tick, 1000);
}

function showLead() { setView('lead'); updateProgress(); }

function isValidBrPhone(s) {
  const digits = String(s).replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return false;
  if (/^(.)\1+$/.test(digits)) return false;
  if (digits.length === 11 && digits[2] !== '9') return false;
  return true;
}

function formatBrPhone(s) {
  const d = String(s).replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function setupWhatsappMask() {
  const input = document.querySelector('[data-whatsapp-input]');
  if (!input) return;
  input.addEventListener('input', () => {
    const cursor = input.selectionStart;
    const before = input.value;
    input.value = formatBrPhone(input.value);
    // best-effort cursor restore
    const diff = input.value.length - before.length;
    try { input.setSelectionRange(cursor + diff, cursor + diff); } catch (_) {}
  });
}

async function handleLeadSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const whatsapp = form.whatsapp.value.trim();
  const errorEl = form.querySelector('[data-form-error]');
  errorEl.hidden = true;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showFormError(errorEl, 'E-mail inválido. Confere a digitação?');
  if (!isValidBrPhone(whatsapp)) return showFormError(errorEl, 'WhatsApp inválido. Use o formato (XX) XXXXX-XXXX.');

  const nome = String(state.answers.nome || '').trim();
  state.lead = { ...state.lead, nome, email, whatsapp };
  track('assessment_lead_submit', { ...state.scores });

  // Fire-and-forget: webhook do lead. Não bloqueia a entrada no resultado.
  fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lead: state.lead,
      scores: state.scores,
      persona: detectPersona(state, state.scores),
      utm: UTMS,
    }),
  }).catch(err => console.warn('[lead] webhook failed (non-blocking):', err));

  // Já temos o state.result (foi gerado durante a análise). Vai direto pro resultado.
  renderResult();
}

// ---------- Analysis phase (loading rico + vídeo gate) ----------
const analysisGate = {
  apiDone: false,
  videoDone: false,
  stepTimer: null,
  stepIndex: 0,
};

// Análise rodando DENTRO do chat (não muda de view).
// Marca stage="analyzing" pra ativar o paywall sutil no profile e dispara API.
// O cascade segue normal pelas mensagens + vídeo + CTA reveal_result.
function startAnalysisInChat() {
  state.lead = { nome: String(state.answers.nome || '').trim() };
  state.scores = computeScores(state.answers);
  document.body.dataset.stage = 'analyzing';
  clearOnboardingNudge();   // perguntas acabaram — o empurrão da aba não faz mais sentido
  setTabBadgeStage('loading');
  updateProgress();
  startAnalyzingRotator();
  submitToAPI();
  track('assessment_analysis_start');
  // O CTA já era um step renderizado como card. clearActiveCard + advance
  // pra o cascade continuar pelas mensagens + vídeo.
  clearActiveCard();
  state.cursor += 1;
  saveState();
  tickAfterUserAction();
}

// Rotaciona o microcopy abaixo do pill "● analisando…" pra dar a sensação
// de "pensando profundo". Usa as frases do ANALYSIS_STEPS.
let _analyzingTimer = null;
let _analyzingIndex = 0;
function startAnalyzingRotator() {
  const sub = document.querySelector('[data-analyzing-sub]');
  if (!sub) return;
  _analyzingIndex = 0;
  sub.textContent = ANALYSIS_STEPS[0] || '';
  if (_analyzingTimer) clearInterval(_analyzingTimer);
  _analyzingTimer = setInterval(() => {
    _analyzingIndex = (_analyzingIndex + 1) % ANALYSIS_STEPS.length;
    sub.classList.remove('is-in');
    void sub.offsetWidth;
    sub.textContent = ANALYSIS_STEPS[_analyzingIndex];
    sub.classList.add('is-in');
  }, 1800);
}
function stopAnalyzingRotator() {
  if (_analyzingTimer) { clearInterval(_analyzingTimer); _analyzingTimer = null; }
}

// (Funções da view "analysis" antiga foram removidas — análise agora roda no chat)
// Mantenho `revealResult` por compatibilidade caso algum listener antigo ainda dispare:
function revealResult() {
  track('assessment_result_reveal');
  showLead();
}
function showFormError(el, msg) {
  el.textContent = msg; el.hidden = false;
}

// ---------- Submit ----------
async function submitToAPI() {
  const answersWithLabels = QUESTIONS.map(q => {
    const idx = state.answers[q.id];
    if (typeof idx !== 'number') return null;
    const opt = q.options[idx];
    return {
      question_id: q.id, section: q.section, pillar: q.pillar || null,
      title: q.title,
      answer: opt?.label || '',
      chip: opt?.chip || '',
      score: opt?.score ?? null,
      // options completas + índice escolhido — pro log "Suas respostas"
      // mostrar marcadas E não marcadas (o contraste é o que informa).
      options: q.options.map(o => o.label || ''),
      chosen: idx,
    };
  }).filter(Boolean);

  const persona = detectPersona(state, state.scores);
  const payload = {
    lead: state.lead, scores: state.scores, answers: answersWithLabels,
    persona,  // determinístico — contexto pra IA gerar SWOT coerente
    badges: Array.from(state.unlockedBadges),    // ids — pro KV renderizar badges
    utm: UTMS,
    meta: {
      version: '1.0',
      generated_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
    },
  };

  try {
    const cf_turnstile_token = await getTurnstileToken();
    const res = await fetch('/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, cf_turnstile_token }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    state.result = await res.json();
    // /api/assessment já salvou o relatório no KV e devolveu o slug.
    if (state.result?.slug) { state.shareSlug = state.result.slug; saveState(); }
    track('assessment_complete', { ...state.scores });
  } catch (err) {
    console.warn('[assessment] API call failed:', err);
    state.result = fallbackResult(state.scores);
    track('assessment_complete', { ...state.scores, fallback: true });
  }
  // Marca API done e atualiza progresso + relatório (preenche descrição persona, comments, SWOT).
  analysisGate.apiDone = true;
  updateProgress();
  updateReport();
}

function fallbackResult(scores) {
  const c = (label, s) =>
    s >= 60 ? `Boa expertise em ${label} — base sólida para liderança na área.`
    : s >= 30 ? `Conhecimento intermediário em ${label} — há espaço relevante para evolução.`
    : `Baixa exposição a ${label} — pode ser um gargalo importante na sua atuação.`;
  return {
    comments: {
      gestao: c('gestão', scores.gestao),
      growth: c('growth', scores.growth),
      branding: c('branding', scores.branding),
      dados: c('dados', scores.dados),
    },
    swot: {
      forcas: ['Análise SWOT detalhada indisponível no momento.'],
      fraquezas: ['Tente recarregar a página em alguns minutos.'],
      oportunidades: [], alertas: [],
    },
  };
}

// ---------- Result rendering ----------
function scoreTier(s) {
  if (s >= 60) return 'good';
  if (s >= 30) return 'mid';
  return 'low';
}

const PILLAR_ORDER = ['gestao', 'growth', 'branding', 'dados'];
const PILLAR_ICON  = { gestao: '◐', growth: '↗', branding: '★', dados: '▤' };

// SVGs inline pra os bullets das skill rows (ícone por pilar)
const SKILL_ICONS = {
  gestao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="3"/><circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="17" r="2.5"/><path d="M12 10v3"/><path d="M12 13l-5 2.5"/><path d="M12 13l5 2.5"/></svg>',
  growth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-8"/><path d="M14 7h6v6"/></svg>',
  branding: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12,3 14.6,9 21,9.5 16,13.8 17.5,20 12,16.7 6.5,20 8,13.8 3,9.5 9.4,9"/></svg>',
  dados: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>',
};

function renderResult() {
  // Assessment completo na parte de scores/IA, mas ainda em SHARE-GATE:
  // o user só destrava share/PDF depois de assistir o vídeo final (VSL).
  // O report tá totalmente visível ao lado — o vídeo é o pedágio antes
  // de poder LEVAR esse material embora.
  document.body.dataset.stage = 'share-gate';
  stopAnalyzingRotator();
  updateReport();
  updateProgress();
  flashReportReady();
  // Badge na aba muda de spinner → check ✓ no momento exato em que dizemos
  // "Pronto, X. Seu assessment tá completo". Pulse forte convida o clique.
  setTabBadgeStage('ready');

  // Cascata de mensagens: completo → promessa do material → preview → CTA pro vídeo
  schedule(() => {
    showTypingIndicator();
    schedule(() => {
      removeTypingIndicator();
      appendMessageBubble('Pronto, {nome}. Seu assessment tá completo. 🎉');
      schedule(() => {
        showTypingIndicator();
        schedule(() => {
          removeTypingIndicator();
          appendMessageBubble('No final eu vou te dar tudo isso numa URL personalizada. Você vai poder salvar, baixar em PDF e compartilhar com quem quiser. Vai ficar assim:');
          schedule(() => {
            appendImagePreview('assets/assessment-preview.webp', 'Exemplo do relatório final que você vai receber');
            schedule(() => {
              showTypingIndicator();
              schedule(() => {
                removeTypingIndicator();
                appendMessageBubble('Mas antes, quero te falar uma coisa importante. Dá um play. 👇');
                schedule(() => {
                  // Vídeo final (VSL) gated. Quando termina → revealShareReady.
                  appendVideoMessage({
                    id: 'final_video',
                    gate: true,
                    video: FINAL_VIDEO,
                    onComplete: revealShareReady,
                  });
                  track('assessment_final_video_shown');
                }, 700);
              }, 900);
            }, 1400);
          }, 700);
        }, 700);
      }, 800);
    }, 900);
  }, 400);
}

// Chamado quando o vídeo final (VSL) termina. Destrava share/PDF.
function revealShareReady() {
  document.body.dataset.stage = 'ready';
  updateReport();      // habilita botões share/PDF
  updateProgress();    // 100%
  flashReportReady();
  track('assessment_ready');

  // Warm-up: pré-cria o slug em background pra evitar `await` no meio do gesto
  // de clique (share nativo perde user activation pós-await em alguns browsers).
  if (!state.shareSlug) {
    createShareLink()
      .then(slug => { state.shareSlug = slug; saveState(); })
      .catch(err => console.warn('[share] warm-up failed:', err));
  }

  schedule(() => {
    showTypingIndicator();
    schedule(() => {
      removeTypingIndicator();
      appendMessageBubble('Pronto, {nome}. Liberei seu relatório completo. Agora você pode levar isso embora. Escolhe abaixo. 👇');
      schedule(() => appendShareActionsBubble(), 500);
    }, 700);
  }, 400);
}

// Bubble com os 3 botões de share/stories/PDF inline no chat. Aparece logo
// após o vídeo final liberar (revealShareReady). Wire handlers diretamente
// nos botões — os botões da aba Resultado continuam funcionando em paralelo.
function appendShareActionsBubble() {
  const li = document.createElement('li');
  li.className = 'assess__bubble assess__bubble--bot assess__bubble--share-actions';
  li.dataset.persistent = '1';
  li.innerHTML = `
    <span class="assess__bubble-avatar" aria-hidden="true"></span>
    <div class="assess__bubble-text assess__share-actions">
      <button type="button" class="assess__share-btn assess__share-btn--share" data-action="share">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Compartilhar
      </button>
      <button type="button" class="assess__share-btn assess__share-btn--story" data-action="story">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        Stories
      </button>
      <button type="button" class="assess__share-btn assess__share-btn--pdf" data-action="download-pdf">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Baixar PDF
      </button>
    </div>
  `;
  stackEl().appendChild(li);
  positionFloatingAvatar();
  requestAnimationFrame(() => li.classList.add('is-in'));
  // Wire handlers (init() já bindou em buttons existentes, mas esses são novos)
  li.querySelector('[data-action="share"]').addEventListener('click', handleShareClick);
  li.querySelector('[data-action="story"]').addEventListener('click', handleStoryClick);
  li.querySelector('[data-action="download-pdf"]').addEventListener('click', () => {
    track('assessment_pdf_download'); window.print();
  });
  setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'end' }), 30);
}

// Bubble simples de imagem no chat — usada como "preview" do material final.
// Reusa as classes do video bubble pro mesmo enquadramento.
function appendImagePreview(src, alt) {
  const li = document.createElement('li');
  li.className = 'assess__bubble assess__bubble--video-message assess__bubble--image';
  li.innerHTML = `
    <span class="assess__bubble-avatar" aria-hidden="true"></span>
    <div class="assess__bubble-video">
      <div class="image-frame">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">
      </div>
    </div>
  `;
  stackEl().appendChild(li);
  refreshFloatingAvatar();
  requestAnimationFrame(() => li.classList.add('is-in'));
  setTimeout(() => li.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
}

// Animação curta "check-in" no report quando algo notável muda (assessment
// completo, vídeo final assistido). Pulse de glow lime na borda.
function flashReportReady() {
  const report = document.querySelector('[data-report]');
  if (!report) return;
  report.classList.remove('is-ready-flash');
  void report.offsetWidth;
  report.classList.add('is-ready-flash');
  setTimeout(() => report.classList.remove('is-ready-flash'), 1800);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Report (embedado durante o flow + final no resultado) ----------

// helper pra valor amigável (chip) das respostas — usado no header/aside do report
function getAnswerValue(qid) {
  const ans = state.answers[qid];
  if (ans === undefined) return null;
  const q = QUESTIONS.find(x => x.id === qid);
  if (!q) return null;
  if (q.type === 'text') return String(ans || '').trim() || null;
  const opt = q.options?.[ans];
  if (!opt) return null;
  return opt.chip || opt.label;
}

const PILLAR_ICONS_SVG = {
  gestao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="3"/><circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="17" r="2.5"/><path d="M12 10v3"/><path d="M12 13l-5 2.5"/><path d="M12 13l5 2.5"/></svg>',
  growth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-8"/><path d="M14 7h6v6"/></svg>',
  branding: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12,3 14.6,9 21,9.5 16,13.8 17.5,20 12,16.7 6.5,20 8,13.8 3,9.5 9.4,9"/></svg>',
  dados: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>',
};
const PILLAR_LABEL = { gestao: 'Gestão', growth: 'Growth', branding: 'Branding', dados: 'Dados' };

function renderReportSkeleton() {
  // Skills (4 score cards — icon + label + bar + note + value)
  const skillsGrid = document.querySelector('[data-report-skills]');
  if (skillsGrid && !skillsGrid.dataset.built) {
    skillsGrid.innerHTML = ['gestao', 'growth', 'branding', 'dados'].map(p => `
      <div class="score" data-skill-row="${p}">
        <div class="score-icon" aria-hidden="true">${PILLAR_ICONS_SVG[p]}</div>
        <div class="score-body">
          <div class="score-label">${PILLAR_LABEL[p]}</div>
          <div class="score-bar"><div class="score-bar-fill" style="width:0%"></div></div>
          <div class="score-note" data-skill-note="${p}"></div>
        </div>
        <div class="score-value" data-skill-value="${p}">0</div>
      </div>
    `).join('');
    skillsGrid.dataset.built = '1';
  }

  // Badges (20 locked)
  const badgesGrid = document.querySelector('[data-report-badges-grid]');
  if (badgesGrid && !badgesGrid.dataset.built) {
    badgesGrid.innerHTML = BADGES.map(b => `
      <div class="badge locked" data-badge-id="${b.id}" data-tooltip="${escapeHtml(b.name)}: ${escapeHtml(b.blurb)}" tabindex="0">
        <span class="emoji">${b.icon}</span>
        <span class="bname">${escapeHtml(b.name)}</span>
      </div>
    `).join('');
    badgesGrid.dataset.built = '1';
    // Listener pra ajustar offset da tooltip e evitar vazar da coluna do report
    badgesGrid.addEventListener('mouseover', positionBadgeTooltip);
    badgesGrid.addEventListener('focusin', positionBadgeTooltip);
  }

  // SWOT — vazio até IA terminar
  for (const key of ['forcas', 'fraquezas', 'oportunidades', 'alertas']) {
    const ul = document.querySelector(`[data-report-swot="${key}"]`);
    if (ul && !ul.dataset.built) {
      ul.innerHTML = '';
      ul.dataset.built = '1';
    }
  }

  // Intro meta — mês · ano (gerado uma vez no boot)
  const metaEl = document.querySelector('[data-report-meta]');
  if (metaEl && !metaEl.dataset.built) {
    const now = new Date();
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    metaEl.textContent = `${months[now.getMonth()]} · ${now.getFullYear()}`;
    metaEl.dataset.built = '1';
  }
}

function updateReport() {
  const scores = computeScores(state.answers);
  const allPillarsAnswered = QUESTIONS
    .filter(q => q.pillar)
    .every(q => state.answers[q.id] !== undefined);
  const persona = allPillarsAnswered ? detectPersona(state, scores) : null;
  const nomeFull = String(state.answers.nome || '').trim();

  // 1) Ident fields (.attr) + flash quando atualiza
  const identKeys = ['nome', 'cargo', 'modelo_negocio', 'objetivo'];
  for (const key of identKeys) {
    const li = document.querySelector(`[data-ident-key="${key}"]`);
    if (!li) continue;
    const valueEl = li.querySelector('.attr-val');
    if (!valueEl) continue;
    const val = getAnswerValue(key);
    const previousVal = valueEl.textContent;
    if (val) {
      if (previousVal !== val) {
        valueEl.textContent = val;
        valueEl.removeAttribute('data-empty');
        flashField(valueEl);
      }
    } else if (previousVal !== '—') {
      valueEl.textContent = '—';
      valueEl.setAttribute('data-empty', '');
    }
  }

  // 1b) Perfil completo? (nome + cargo + modelo_negocio + objetivo)
  // Bump no badge da aba só no momento exato em que o perfil COMPLETA (1×).
  const profileNowComplete = identKeys.every(k => !!getAnswerValue(k));
  if (profileNowComplete && !state.profileComplete) {
    state.profileComplete = true;
    markReportUpdated();
  }

  // 2) Class trophy (persona) — pendente até a fase de pilares acabar
  // Não dispara bump no badge — a finalização do 4º pilar (logo abaixo) já cobre.
  const classValueEl = document.querySelector('[data-class-value]');
  if (classValueEl) {
    const previousClass = classValueEl.textContent;
    if (persona) {
      if (previousClass !== persona.label) {
        classValueEl.textContent = persona.label;
        classValueEl.classList.remove('is-pending');
        if (previousClass === '???' || previousClass === '' || classValueEl.classList.contains('is-pending')) {
          classValueEl.classList.remove('is-revealing');
          void classValueEl.offsetWidth;
          classValueEl.classList.add('is-revealing');
        }
      }
    } else if (previousClass !== '???') {
      classValueEl.textContent = '???';
      classValueEl.classList.add('is-pending');
    }
  }

  // 3) Class trophy flavor (descrição da persona — 100% IA)
  // Antes mostrávamos persona.description (determinístico, 1 frase genérica por
  // persona) como fallback. Trocamos por skeleton durante a análise pra que o
  // texto final seja sempre o da IA, que considera todas as respostas + contexto
  // de segmentação e produz uma análise específica.
  // Descrição da persona (AI) — NÃO revela no UI; vai por email/whats.
  // Permanece como skeleton enquanto stage='analyzing' (estado final).
  const profileDescEl = document.querySelector('[data-report-profile-desc]');
  if (profileDescEl) {
    const stage = document.body.dataset.stage;
    const aiDesc = state.result?.persona_description;
    if (aiDesc && stage !== 'analyzing') {
      profileDescEl.textContent = aiDesc;
      profileDescEl.classList.remove('is-pending');
    } else if (allPillarsAnswered) {
      profileDescEl.innerHTML = '<span class="is-skeleton">Personalizando análise da sua persona com base nas suas respostas…</span>';
      profileDescEl.classList.remove('is-pending');
    } else {
      profileDescEl.textContent = 'Sua persona aparece aqui assim que você terminar de responder.';
      profileDescEl.classList.add('is-pending');
    }
  }

  // 4) Radar (gradientes + vértices semafóricos)
  renderRadar(scores);

  // 5) Score cards (icon | label + bar + note | value) com tier semafórico
  for (const p of ['gestao', 'growth', 'branding', 'dados']) {
    const row = document.querySelector(`[data-skill-row="${p}"]`);
    if (!row) continue;
    const value = scores[p] || 0;
    const prev = state.previousScores[p] || 0;
    const delta = value - prev;
    // 4-tier semafórico, mesmas faixas do radar (radarColorFor):
    //   ≥75 is-top (lime) · ≥60 is-good (sage) · ≥30 is-mid (warn) · <30 is-low (danger)
    const tier = value >= 75 ? 'is-top'
               : value >= 60 ? 'is-good'
               : value >= 30 ? 'is-mid'
               : 'is-low';
    row.className = `score ${tier}`;
    row.dataset.skillRow = p;
    const fill = row.querySelector('.score-bar-fill');
    if (fill) fill.style.width = `${value}%`;
    const valEl = row.querySelector('.score-value');
    if (valEl) valEl.textContent = String(value);
    // Anim +N (chip flutuante acima da skill row)
    // NÃO bump no badge da aba — pequenos deltas de score são ruído visual.
    // O bump só acontece quando o pilar INTEIRO finaliza (logo abaixo).
    if (delta > 0 && prev !== undefined) {
      flashSkillDelta(row, delta);
      flashSkillInChat(p, delta);
    }
    // Score note (IA) — NÃO revela mais no UI; vai por email/whats via webhook.
    // Permanece como skeleton enquanto stage='analyzing' (estado final do novo flow).
    const noteEl = row.querySelector(`[data-skill-note="${p}"]`);
    if (noteEl) {
      const stage = document.body.dataset.stage;
      const comment = state.result?.comments?.[p];
      if (comment && stage !== 'analyzing') {
        noteEl.textContent = comment;
        noteEl.classList.remove('is-pending');
      } else if (allPillarsAnswered) {
        noteEl.innerHTML = '<span class="is-skeleton">analisando…</span>';
      } else {
        noteEl.innerHTML = '';
      }
    }
  }
  state.previousScores = { ...scores };

  // 6) Pilares finalizados — quando TODAS as perguntas de um pilar foram
  // respondidas, ele "finaliza" e bumpa o badge da aba (1× por pilar).
  for (const p of ['gestao', 'growth', 'branding', 'dados']) {
    if (state.completedPillars.has(p)) continue;
    const pillarDone = QUESTIONS
      .filter(q => q.pillar === p)
      .every(q => state.answers[q.id] !== undefined);
    if (pillarDone) {
      state.completedPillars.add(p);
      markReportUpdated();
    }
  }

  // 7) Badges
  const unlocked = detectUnlockedBadges(state, scores);
  const newlyUnlocked = unlocked.filter(id => !state.unlockedBadges.has(id));
  for (const id of unlocked) state.unlockedBadges.add(id);

  for (const b of BADGES) {
    const el = document.querySelector(`.badge[data-badge-id="${b.id}"]`);
    if (!el) continue;
    const isUnlocked = state.unlockedBadges.has(b.id);
    el.classList.toggle('locked', !isUnlocked);
    if (newlyUnlocked.includes(b.id)) {
      el.classList.remove('is-revealing');
      void el.offsetWidth;
      el.classList.add('is-revealing');
    }
  }
  if (newlyUnlocked.length > 0) markReportUpdated();

  // Badges count chip + section meta + tab mobile
  const badgesCountEl = document.querySelector('[data-report-badges-count]');
  if (badgesCountEl) badgesCountEl.textContent = `${state.unlockedBadges.size} / ${BADGES.length}`;
  const badgesMetaEl = document.querySelector('[data-report-badges-meta]');
  if (badgesMetaEl) badgesMetaEl.textContent = state.unlockedBadges.size === 1
    ? '1 conquistada'
    : `${state.unlockedBadges.size} conquistadas`;

  // 8) SWOT (IA) — NÃO revela mais no UI; vai por email/whats via webhook.
  // Permanece como skeleton enquanto stage='analyzing' (estado final do novo flow).
  const stage = document.body.dataset.stage;
  const swot = state.result?.swot || null;
  const lockToSkeleton = stage === 'analyzing';
  for (const key of ['forcas', 'fraquezas', 'oportunidades', 'alertas']) {
    const ul = document.querySelector(`[data-report-swot="${key}"]`);
    if (!ul) continue;
    if (swot && !lockToSkeleton && Array.isArray(swot[key]) && swot[key].length > 0) {
      ul.innerHTML = swot[key].map(item => `<li>${escapeHtml(item)}</li>`).join('');
    } else if (allPillarsAnswered) {
      ul.innerHTML = '<li class="is-skeleton">analisando…</li>';
    } else {
      ul.innerHTML = '';
    }
  }

  // 9) Toasts pra badges novas
  for (const id of newlyUnlocked) {
    const b = BADGES.find(x => x.id === id);
    if (b) queueBadgeToast(b);
  }

  // 10) Botões "Compartilhar" + "Baixar PDF" — só liberam em stage="ready"
  // (depois do vídeo final / VSL). Antes disso (durante o flow, analyzing,
  // ou share-gate) ficam disabled com tooltip explicativo.
  // Reusa `stage` declarado acima no bloco SWOT.
  const ready = stage === 'ready';
  const pdfBtn = document.querySelector('[data-pdf-btn]');
  if (pdfBtn) {
    pdfBtn.disabled = !ready;
    if (ready) pdfBtn.removeAttribute('data-tooltip');
    else pdfBtn.setAttribute('data-tooltip', 'Será disponibilizado após conclusão do assessment.');
  }
  const shareBtn = document.querySelector('[data-share-btn]');
  if (shareBtn) {
    shareBtn.disabled = !ready;
    if (ready) shareBtn.removeAttribute('data-tooltip');
    else shareBtn.setAttribute('data-tooltip', 'Será disponibilizado após conclusão do assessment.');
  }
  const storyBtn = document.querySelector('[data-story-btn]');
  if (storyBtn) {
    storyBtn.disabled = !ready;
    if (ready) storyBtn.removeAttribute('data-tooltip');
    else storyBtn.setAttribute('data-tooltip', 'Será disponibilizado após conclusão do assessment.');
  }
}

// Cor semafórica por score (usado nos vértices + gradients do radar).
function radarColorFor(score) {
  if (score >= 75) return '#89CC72'; // lime
  if (score >= 60) return '#5E9F4E'; // sage
  if (score >= 30) return '#D4A637'; // warn
  return '#C44545';                  // danger
}

// Renderiza o radar (SVG 500x460, centro 250,230, maxR=160).
// Cada quadrante (NE/SE/SW/NW) é um triângulo com gradiente entre as cores
// semafóricas dos dois vértices vizinhos. Linhas e pontos seguem a mesma lógica.
function renderRadar(scores) {
  const cx = 250, cy = 230, maxR = 160;
  // Vértices em ordem Gestão (top), Growth (right), Dados (bottom), Branding (left)
  const order = ['gestao', 'growth', 'dados', 'branding'];
  const pts = [
    [cx,                                         cy - maxR * ((scores.gestao   || 0) / 100)], // top
    [cx + maxR * ((scores.growth   || 0) / 100), cy],                                         // right
    [cx,                                         cy + maxR * ((scores.dados    || 0) / 100)], // bottom
    [cx - maxR * ((scores.branding || 0) / 100), cy],                                         // left
  ];
  const colors = order.map(p => radarColorFor(scores[p] || 0));

  // <defs> com 4 gradientes (um por aresta entre vértices vizinhos)
  const defs = document.querySelector('[data-radar-defs]');
  if (defs) {
    const grads = [
      { id: 'grad-NE', a: pts[0], b: pts[1], ca: colors[0], cb: colors[1] }, // Gestão → Growth
      { id: 'grad-SE', a: pts[1], b: pts[2], ca: colors[1], cb: colors[2] }, // Growth → Branding
      { id: 'grad-SW', a: pts[2], b: pts[3], ca: colors[2], cb: colors[3] }, // Branding → Dados
      { id: 'grad-NW', a: pts[3], b: pts[0], ca: colors[3], cb: colors[0] }, // Dados → Gestão
    ];
    defs.innerHTML = grads.map(g => `
      <linearGradient id="${g.id}" x1="${g.a[0].toFixed(1)}" y1="${g.a[1].toFixed(1)}" x2="${g.b[0].toFixed(1)}" y2="${g.b[1].toFixed(1)}" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stop-color="${g.ca}" />
        <stop offset="100%" stop-color="${g.cb}" />
      </linearGradient>
    `).join('');
  }

  // 4 triângulos preenchidos (centro → vértice A → vértice B)
  const quadEl = document.querySelector('[data-radar-quadrants]');
  if (quadEl) {
    quadEl.innerHTML = `
      <polygon points="${cx},${cy} ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} ${pts[1][0].toFixed(1)},${pts[1][1].toFixed(1)}" fill="url(#grad-NE)" />
      <polygon points="${cx},${cy} ${pts[1][0].toFixed(1)},${pts[1][1].toFixed(1)} ${pts[2][0].toFixed(1)},${pts[2][1].toFixed(1)}" fill="url(#grad-SE)" />
      <polygon points="${cx},${cy} ${pts[2][0].toFixed(1)},${pts[2][1].toFixed(1)} ${pts[3][0].toFixed(1)},${pts[3][1].toFixed(1)}" fill="url(#grad-SW)" />
      <polygon points="${cx},${cy} ${pts[3][0].toFixed(1)},${pts[3][1].toFixed(1)} ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}" fill="url(#grad-NW)" />
    `;
  }

  // Linhas das arestas externas (com mesma cor do gradiente)
  const edgesEl = document.querySelector('[data-radar-edges]');
  if (edgesEl) {
    edgesEl.innerHTML = `
      <line x1="${pts[0][0].toFixed(1)}" y1="${pts[0][1].toFixed(1)}" x2="${pts[1][0].toFixed(1)}" y2="${pts[1][1].toFixed(1)}" stroke="url(#grad-NE)" />
      <line x1="${pts[1][0].toFixed(1)}" y1="${pts[1][1].toFixed(1)}" x2="${pts[2][0].toFixed(1)}" y2="${pts[2][1].toFixed(1)}" stroke="url(#grad-SE)" />
      <line x1="${pts[2][0].toFixed(1)}" y1="${pts[2][1].toFixed(1)}" x2="${pts[3][0].toFixed(1)}" y2="${pts[3][1].toFixed(1)}" stroke="url(#grad-SW)" />
      <line x1="${pts[3][0].toFixed(1)}" y1="${pts[3][1].toFixed(1)}" x2="${pts[0][0].toFixed(1)}" y2="${pts[0][1].toFixed(1)}" stroke="url(#grad-NW)" />
    `;
  }

  // Pontos coloridos individualmente
  const pointsEl = document.querySelector('[data-radar-points]');
  if (pointsEl) {
    pointsEl.innerHTML = order.map((p, i) => `
      <circle cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="6" fill="${colors[i]}" />
    `).join('');
  }

  // Atualiza valores numéricos dos labels (e cor matching)
  order.forEach((p, i) => {
    const valEl = document.querySelector(`[data-radar-value="${p}"]`);
    if (valEl) {
      valEl.textContent = String(scores[p] ?? 0);
      valEl.setAttribute('fill', colors[i]);
    }
  });
}

// Dispara um span "+N" flutuante na skill row do profile
function flashSkillDelta(row, delta) {
  const span = document.createElement('span');
  span.className = 'skill__delta';
  span.textContent = `+${delta}`;
  row.appendChild(span);
  const cleanup = () => span.remove();
  span.addEventListener('animationend', cleanup, { once: true });
  setTimeout(cleanup, 2600);
}

// Dispara um floater "+N Growth" na última user bubble do chat — feedback
// imediato (essencial em mobile, onde o profile fica em outra tab).
function flashSkillInChat(pillar, delta) {
  const userBubbles = document.querySelectorAll('.assess__bubble--user');
  const lastBubble = userBubbles[userBubbles.length - 1];
  if (!lastBubble) return;
  // remove qualquer flash anterior na mesma bubble pra não acumular
  lastBubble.querySelectorAll('.assess__skill-flash').forEach(el => el.remove());
  const span = document.createElement('span');
  span.className = 'assess__skill-flash';
  span.innerHTML = `<strong>+${delta}</strong> ${PILLAR_LABEL[pillar] || pillar}`;
  lastBubble.appendChild(span);
  // remover logo no fim da animação (evita ficar "preso num canto" em mobile
  // caso o setTimeout escorregue por algum drift de frame). Fallback de 2.6s.
  const cleanup = () => span.remove();
  span.addEventListener('animationend', cleanup, { once: true });
  setTimeout(cleanup, 2600);
}

// Pulsa rápido um field do profile que acabou de ser preenchido (in-place)
function flashField(el) {
  if (!el) return;
  el.classList.remove('is-flashing');
  void el.offsetWidth;
  el.classList.add('is-flashing');
  setTimeout(() => el.classList.remove('is-flashing'), 750);
}

// Quando o profile recebe update e o user está na tab "chat" (mobile),
// pulsa rápido o tab "Relatório" pra sinalizar que algo mudou lá.
function markReportUpdated() {
  if (document.body.dataset.pane !== 'chat') return;
  const tab = document.querySelector('.assess__tab[data-tab="report"]');
  if (!tab) return;
  tab.classList.remove('is-flashing');
  void tab.offsetWidth;
  tab.classList.add('is-flashing');
  setTimeout(() => tab.classList.remove('is-flashing'), 1500);
  // Incrementa contador no badge da aba (zera quando o user clica na aba).
  bumpTabBadge();
}

// ---------- Badge da aba "Resultado" ----------
// Estados:
//   - counter: nº de updates desde a última visita do user ao tab
//   - stage: 'idle' | 'loading' (durante análise IA) | 'ready' (assessment completo)
// Renderização: stage > counter (loading/ready substituem o número).
const tabBadgeState = { counter: 0, stage: 'idle' };

function bumpTabBadge() {
  if (document.body.dataset.pane !== 'chat') return;
  if (tabBadgeState.stage === 'loading') return; // não incrementa enquanto roda análise
  tabBadgeState.counter += 1;
  renderTabBadge();
}

function setTabBadgeStage(stage) {
  tabBadgeState.stage = stage;
  if (stage === 'ready') {
    // ready também dispara pulse forte na aba — convida o clique
    const tab = document.querySelector('.assess__tab[data-tab="report"]');
    if (tab && !tab.classList.contains('is-active')) tab.classList.add('is-ready-pulse');
  }
  renderTabBadge();
}

function clearTabBadge() {
  tabBadgeState.counter = 0;
  // mantém stage='ready' se já foi atingido, mas remove pulse
  const tab = document.querySelector('.assess__tab[data-tab="report"]');
  if (tab) tab.classList.remove('is-ready-pulse');
  // se já chegou em 'ready', some o check após o user já ter visto
  if (tabBadgeState.stage === 'ready') tabBadgeState.stage = 'idle';
  renderTabBadge();
}

function renderTabBadge() {
  const badge = document.querySelector('[data-tab-badge]');
  if (!badge) return;
  badge.classList.remove('is-loading', 'is-ready');
  if (tabBadgeState.stage === 'loading') {
    badge.hidden = false;
    badge.classList.add('is-loading');
    badge.textContent = '';
  } else if (tabBadgeState.stage === 'ready') {
    badge.hidden = false;
    badge.classList.add('is-ready');
    badge.textContent = '✓';
  } else if (tabBadgeState.counter > 0) {
    badge.hidden = false;
    badge.textContent = String(tabBadgeState.counter);
  } else {
    badge.hidden = true;
    badge.textContent = '';
  }
}

// ---------- Tabs (mobile chat ↔ assessment) ----------
// Ao trocar de tab no mobile, sempre posiciona o scroll no lugar mais relevante:
//   chat       → última bubble (a interação mais recente)
//   assessment → topo do report (visão geral: perfil + stats logo de cara)
// Decisão de design: "topo" no assessment é mais previsível que "última seção
// atualizada" — o user sempre sabe onde vai cair, e Perfil/Stats são os blocos
// que mais mudam durante o flow (estão lá em cima).
function setupTabs() {
  document.body.dataset.pane = 'chat';
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      const prev = document.body.dataset.pane;
      document.body.dataset.pane = target;
      document.querySelectorAll('[data-tab]').forEach(b => {
        const active = b.dataset.tab === target;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      // Ao entrar na aba Resultado: zera contador, pulse "ready" e o empurrão de onboarding
      if (target === 'report') { clearTabBadge(); clearOnboardingNudge(); }
      // Ao sair da chat com vídeo tocando, pausa o vídeo (evita fake-watch)
      if (prev === 'chat' && target !== 'chat') pauseActiveChatVideo();
      scrollPaneToAnchor(target);
    });
  });
}

// Pausa qualquer <video> tocando dentro do chat. Usado quando o user troca
// pra aba "Resultado" — evita que o usuário simule ter visto o vídeo gating.
function pauseActiveChatVideo() {
  const videos = document.querySelectorAll('.assess__chat video');
  videos.forEach(v => {
    if (!v.paused && !v.ended) {
      try { v.pause(); } catch (_) {}
    }
  });
}

// Posiciona o scroll dentro do pane ativado (ou na página, em telas pequenas
// onde os panes não rolam internamente).
function scrollPaneToAnchor(pane) {
  // pequena espera pro layout estabilizar (pane visível, alturas reais)
  requestAnimationFrame(() => {
    if (pane === 'chat') {
      const bubbles = document.querySelectorAll('.assess__stack > li');
      const last = bubbles[bubbles.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    } else if (pane === 'report') {
      const report = document.querySelector('[data-report]');
      if (report) {
        report.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  });
}


// Queue toasts so multiple unlocks don't overlap
const toastQueue = [];
let toastShowing = false;
function queueBadgeToast(badge) {
  toastQueue.push(badge);
  if (!toastShowing) showNextBadgeToast();
}
function showNextBadgeToast() {
  const badge = toastQueue.shift();
  if (!badge) { toastShowing = false; return; }
  toastShowing = true;
  const toast = document.querySelector('[data-badge-toast]');
  if (!toast) { toastShowing = false; return; }
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${badge.icon}</span>
    <div class="toast__body">
      <span class="toast__title">Badge desbloqueada: ${escapeHtml(badge.name)}</span>
      <span class="toast__blurb">${escapeHtml(badge.blurb)}</span>
    </div>
  `;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  track('assessment_badge_unlock', { badge_id: badge.id, badge_name: badge.name });
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => {
      toast.hidden = true;
      showNextBadgeToast();
    }, 450);
  }, 5500);
}

// Interpola {nome} e {score:pillar} no momento da render.
function interpolateMessage(html) {
  const nome = (state.answers.nome || '').toString().split(/\s+/)[0] || '';
  const scores = computeScores(state.answers);
  return String(html)
    .replaceAll('{nome}', escapeHtml(nome))
    .replace(/\{score:(growth|branding|dados|gestao)\}/g, (_, p) => String(scores[p] ?? 0));
}

// ---------- Compartilhar (URL pública gerada sob demanda) ----------
async function handleShareClick(e) {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    if (!state.shareSlug) {
      state.shareSlug = await createShareLink();
      saveState();
    }
    const shareUrl = `${location.origin}/assessment/r/${state.shareSlug}`;
    const persona = detectPersona(state, state.scores);
    const firstName = (state.answers.nome || '').toString().split(/\s+/)[0] || '';
    const shareTitle = firstName
      ? `${firstName} · análise de senioridade em marketing`
      : 'Análise de senioridade em marketing';
    const shareText = persona?.label
      ? `Meu perfil: ${persona.label}. Análise nas 4 funções do marketing — Gestão · Growth · Branding · Dados:`
      : 'Análise de senioridade nas 4 funções do marketing — Gestão · Growth · Branding · Dados:';
    track('assessment_share_click');
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        track('assessment_share_complete', { method: 'native' });
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('[share] native failed:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showShareToast('Link copiado pra área de transferência! 🔗');
        track('assessment_share_complete', { method: 'clipboard' });
      } catch (err) {
        showShareToast(`Copie este link: ${shareUrl}`);
        console.warn('[share] clipboard failed:', err);
      }
    }
  } catch (err) {
    console.warn('[share] create link failed:', err);
    showShareToast('Não consegui gerar o link agora. Tente de novo em instantes.');
  } finally {
    btn.disabled = false;
  }
}

// ---------- Baixar imagem pra Stories (PNG 1080x1920) ----------
async function handleStoryClick(e) {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    if (!state.shareSlug) {
      state.shareSlug = await createShareLink();
      saveState();
    }
    const storyUrl = `${location.origin}/api/og/${state.shareSlug}/story`;
    const filename = `assessment-${state.shareSlug}-story.png`;
    track('assessment_story_click');

    // Mobile recente: share nativo com arquivo → user escolhe Instagram no sheet
    if (navigator.canShare && navigator.share) {
      try {
        const res = await fetch(storyUrl);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Meu assessment de marketing' });
          track('assessment_story_share', { method: 'native' });
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('[story] native share failed:', err);
      }
    }

    // Fallback (desktop ou mobile antigo): download direto
    const a = document.createElement('a');
    a.href = storyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showShareToast('Imagem baixada! Poste nos Stories e marque @arthurdambros 📱');
    track('assessment_story_share', { method: 'download' });
  } catch (err) {
    console.warn('[story] failed:', err);
    showShareToast('Não consegui gerar a imagem agora. Tente de novo.');
  } finally {
    btn.disabled = false;
  }
}

async function createShareLink() {
  const payload = {
    nome_curto: (state.answers.nome || '').toString().split(/\s+/)[0] || '',
    scores: state.scores,
    persona: detectPersona(state, state.scores),
    result: state.result,
    badges: Array.from(state.unlockedBadges),
    answers_summary: {
      cargo: getAnswerValue('cargo'),
      modelo_negocio: getAnswerValue('modelo_negocio'),
      objetivo: getAnswerValue('objetivo'),
    },
  };
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`/api/share returned ${res.status}`);
  const data = await res.json();
  if (!data.slug) throw new Error('share response missing slug');
  return data.slug;
}

// Toast simples reusa o componente do badge toast (mesmo bg/posição)
function showShareToast(message) {
  const toast = document.querySelector('[data-badge-toast]');
  if (!toast) return;
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">🔗</span>
    <div class="toast__body">
      <span class="toast__title">${escapeHtml(message)}</span>
    </div>
  `;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => { toast.hidden = true; }, 450);
  }, 3500);
}

// Ajusta o offset horizontal da tooltip da badge pra ela nunca vazar da
// coluna do report (o pseudo-elemento ::after é centralizado por padrão, mas
// badges nas bordas faziam a tooltip invadir o chat). Mede e seta uma custom
// property --tt-offset que o CSS usa no translateX.
function positionBadgeTooltip(e) {
  const badge = e.target.closest('.badge[data-tooltip]');
  if (!badge) return;
  const report = badge.closest('.fsm-report');
  if (!report) return;
  const reportRect = report.getBoundingClientRect();
  const badgeRect = badge.getBoundingClientRect();
  const badgeCenter = badgeRect.left + badgeRect.width / 2;
  // Mesmos limites do CSS: padding 8px + max-width 240px do tooltip
  const tooltipMaxW = 240;
  const safetyPad = 12;
  const halfW = Math.min(tooltipMaxW, reportRect.width - safetyPad * 2) / 2;
  let leftEdge = badgeCenter - halfW;
  let rightEdge = badgeCenter + halfW;
  let offset = 0;
  if (leftEdge < reportRect.left + safetyPad) {
    offset = (reportRect.left + safetyPad) - leftEdge;
  } else if (rightEdge > reportRect.right - safetyPad) {
    offset = (reportRect.right - safetyPad) - rightEdge;
  }
  badge.style.setProperty('--tt-offset', `${offset.toFixed(1)}px`);
}

// ---------- Lifecycle ----------
function start() {
  clearState();
  clearTimer();
  state.cursor = 0;
  state.shownUpTo = -1;
  state.answers = {};
  state.videoCompleted = {};
  state.unlockedBadges = new Set();
  // Limpa só os <li> de mensagens/perguntas; preserva o <img data-floating-avatar>
  stackEl().querySelectorAll('li').forEach(el => el.remove());
  document.body.dataset.stage = 'flow';
  track('assessment_start');
  setView('flow');
  renderProgressSkeleton();
  renderReportSkeleton();
  setupStickyObserver();
  setupTabs();
  updateProgress();
  updateReport();
  // Starting the flow is itself a user action — let typing indicator precede the first message.
  tickAfterUserAction();
}

function init() {
  document.querySelectorAll('[data-action="start"]').forEach(el => el.addEventListener('click', start));
  document.querySelectorAll('[data-action="retry"]').forEach(el => el.addEventListener('click', () => submitToAPI()));
  document.querySelectorAll('[data-action="reveal-result"]').forEach(el => el.addEventListener('click', revealResult));
  document.querySelectorAll('[data-action="download-pdf"]').forEach(el => {
    el.addEventListener('click', () => { track('assessment_pdf_download'); window.print(); });
  });
  document.querySelectorAll('[data-action="share"]').forEach(el => {
    el.addEventListener('click', handleShareClick);
  });
  document.querySelectorAll('[data-action="story"]').forEach(el => {
    el.addEventListener('click', handleStoryClick);
  });
  const form = document.querySelector('[data-lead-form]');
  if (form) form.addEventListener('submit', handleLeadSubmit);
  setupWhatsappMask();
  window.addEventListener('resize', positionFloatingAvatar);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
