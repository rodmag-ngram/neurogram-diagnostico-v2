// FSM Self-Assessment — flow consolidado (v1) com mensagens intermediárias
//
// Estrutura:
// - QUESTIONS  → array de perguntas consolidadas (com sourceGroupId apontando
//   para o grupo equivalente no Typebot, usado para puxar afterMessages)
// - INTRO_MESSAGES / MESSAGES_BY_SOURCE_GROUP → auto-gerados em
//   scripts/assessment-messages.js (texts entre perguntas, caminho Gestor)
// - STEPS → sequência completa de steps (message + question + video-gate)
//   produzida por buildSteps()
//
// Para editar perguntas: edite QUESTIONS abaixo.
// Para editar mensagens: edite no Typebot e rode `node tools/extract-typebot.mjs`.
// Para inserir um vídeo gate: insira { type: 'video-gate', ... } em EXTRA_STEPS.
//
// PILLAR_MAX = soma dos scores máximos das perguntas pontuáveis de cada pilar.

import { MESSAGES_BY_SOURCE_GROUP } from './assessment-messages.js?v=2';

// Intro: 1 bubble curta apresentando o Arthur. O vídeo de abertura foi removido
// pra garantir interatividade imediata — vídeo no início exige paciência que o
// user ainda não investiu, e isso eleva o abandono.
export const INTRO_MESSAGES = [
  'Oi. Sou o Arthur e vou guiar você durante esse assessment.',
];

export const PILLAR_MAX = {
  gestao: 12,    // 4+3+3+2 (senioridade, dialogo_clevel, planejamento, responsabilidades)
  growth: 19,    // 3+4+4+4+2+2 (match, icp, pesquisa, orcamento, midia_paga, crm)
  branding: 12,  // 4+3+3+2 (narrativa+copy fundidas, coerencia, social, influencers)
  dados: 10,     // 3+2+2+3 (utms+gtm fundidas, cultura, autonomia, diagnosis)
};

export const PILLAR_LABELS = {
  gestao: 'Gestão',
  growth: 'Growth',
  branding: 'Branding',
  dados: 'Dados',
};

// ============================ QUESTIONS ============================
// sourceGroupId mapeia para o grupo do Typebot de onde extraímos as afterMessages.
// Perguntas tipo 'text' capturam texto livre (ex: nome); não pontuam.
export const QUESTIONS = [
  // ---------- INTRODUÇÃO (captura nome) ----------
  {
    id: 'nome',
    section: 'perfil',
    title: 'Prazer em te conhecer.',
    prompt: 'Para começar, como você se chama?',
    type: 'text',
    placeholder: 'Ex: Paulo',
    minLength: 2,
    maxLength: 60,
  },

  // ---------- SEGMENTAÇÃO ----------
  {
    id: 'cargo',
    section: 'perfil',
    sourceGroupId: 'cl1sern8w00202e6ez69l190j',
    title: 'Cargo / Função',
    prompt: 'Qual opção melhor descreve seu papel atual?',
    type: 'single',
    options: [
      { label: 'Sou CEO ou Diretor(a) de Marketing e Vendas', chip: 'CEO/Diretor(a)' },
      { label: 'Sou Gestor(a) da Área de Marketing',          chip: 'Gestor(a) de Marketing' },
      { label: 'Sou responsável por Growth ou Performance',   chip: 'Growth/Performance' },
      { label: 'Sou responsável por Branding ou Comunicação', chip: 'Branding/Comunicação' },
      { label: 'Sou autônomo(a) ou dono(a) de agência',       chip: 'Autônomo(a)/Agência' },
      { label: 'Outro',                                       chip: 'Outro' },
    ],
  },
  {
    id: 'modelo_negocio',
    section: 'perfil',
    title: 'Modelo de negócio',
    prompt: 'Qual modelo de negócio melhor descreve onde você atua hoje?',
    type: 'single',
    options: [
      { label: 'B2B SaaS / Software',                          chip: 'B2B SaaS' },
      { label: 'B2C / E-commerce / DTC',                       chip: 'B2C/E-commerce' },
      { label: 'Educação online / Cursos',                     chip: 'Educação online' },
      { label: 'Agência de marketing',                         chip: 'Agência' },
      { label: 'Prestação de serviço (consultoria, freelance)', chip: 'Prestação de serviço' },
      { label: 'Marketplace / Plataforma',                     chip: 'Marketplace' },
      { label: 'Outro',                                        chip: 'Outro' },
    ],
  },
  {
    id: 'objetivo',
    section: 'perfil',
    sourceGroupId: 't43xdv1kotyx28h8u23f31dj', // Gestor's Objetivo version
    title: 'Objetivo',
    prompt: 'Por qual motivo você está fazendo este self-assessment?',
    type: 'single',
    options: [
      { label: 'Quero me tornar gestor(a) de marketing em breve',          chip: 'Virar gestor(a)' },
      { label: 'Sou gestor(a) e quero cobrir minhas lacunas',              chip: 'Cobrir lacunas' },
      { label: 'Quero diagnosticar a qualidade do trabalho da minha área', chip: 'Diagnóstico do trabalho' },
      { label: 'Quero me capacitar sem objetivo de carreira específico',   chip: 'Capacitação geral' },
    ],
  },

  // ============================== GROWTH ==============================
  {
    id: 'growth_match_publico_produto',
    section: 'growth',
    pillar: 'growth',
    title: 'Match Público-Produto',
    prompt: 'Você já lançou produto novo para público novo, ou adaptou produto para alcançar um novo público?',
    type: 'single',
    options: [
      { label: 'Nunca fiz nem participei', score: 0 },
      { label: 'Participei de algum lançamento dirigido por outro', score: 1 },
      { label: 'Liderei adaptação/lançamento ao menos 1× com resultado medido', score: 2 },
      { label: 'Faço isso de forma sistemática, é parte da estratégia de portfólio', score: 3 },
    ],
  },
  {
    id: 'growth_icp_qualificacao',
    section: 'growth',
    pillar: 'growth',
    title: 'Qualificação de Lead / ICP',
    prompt: 'Como você qualifica a qualidade dos leads/clientes que adquire?',
    type: 'single',
    options: [
      { label: 'Não qualifico — olho só volume', score: 0 },
      { label: 'Uso custo por lead (CPL) / CPA', score: 1 },
      { label: 'Correlaciono lead → conversão em venda', score: 2 },
      { label: 'Estimo LTV por coorte e ajusto investimento', score: 3 },
      { label: 'Tenho ICP formalmente definido e otimizo canais por LTV', score: 4 },
    ],
  },
  {
    id: 'growth_pesquisa_cliente',
    section: 'growth',
    pillar: 'growth',
    title: 'Pesquisa de Cliente',
    prompt: 'Que tipo de pesquisa você fez ou faz pra entender seu cliente ideal?',
    type: 'single',
    options: [
      { label: 'Nenhuma — acho que sei quem ele é', score: 0 },
      { label: 'Conversei informalmente com alguns clientes', score: 1 },
      { label: 'Uso formulário de captura + olho dados de produto', score: 2 },
      { label: 'Faço pesquisa estruturada (entrevistas + análise sistemática)', score: 3 },
      { label: 'Tenho processo contínuo de descoberta e validação', score: 4 },
    ],
  },
  {
    id: 'growth_orcamento',
    section: 'growth',
    pillar: 'growth',
    sourceGroupId: 'o4f6u5ks133085jx9twaolr2',
    title: 'Orçamento gerenciado',
    prompt: 'Falando em gastar dinheiro... qual volume de orçamento de mídia você já foi responsável por gerir?',
    type: 'single',
    options: [
      { label: 'Nunca gerenciei orçamento de mídia diretamente', score: 0 },
      { label: 'Até R$ 25.000 por mês', score: 1 },
      { label: 'De R$ 25.000 até R$ 75.000 por mês', score: 2 },
      { label: 'De R$ 75.000 até R$ 125.000 por mês', score: 3 },
      { label: 'Acima de R$ 125.000 por mês', score: 4 },
    ],
  },
  {
    id: 'growth_midia_paga',
    section: 'growth',
    pillar: 'growth',
    sourceGroupId: 'mvyabymzm3dn2j0w6nqz5c8x',
    title: 'Mídia Paga',
    prompt: 'Qual melhor descreve seu nível de domínio em Mídia Paga?',
    type: 'single',
    options: [
      { label: 'Só falo sobre isso na presença da minha agência.', score: 0 },
      { label: 'Me viro no básico, mas nunca foi função central pra mim.', score: 1 },
      { label: 'Já rodei vários canais — Google, Meta, LinkedIn, Retail.', score: 2 },
    ],
  },
  {
    id: 'growth_crm',
    section: 'growth',
    pillar: 'growth',
    sourceGroupId: 'beviv9nroqmdei3tf6oxgzrs',
    title: 'CRM',
    prompt: 'Qual melhor descreve seu nível de domínio em CRM / Automações de marketing?',
    type: 'single',
    options: [
      { label: 'Acho que ouvi alguma coisa sobre isso num RD Summit...', score: 0 },
      { label: 'Me viro no básico, mas nunca foi função central pra mim.', score: 1 },
      { label: 'Já rodei CRM em email, WhatsApp, SMS e push — automações e campanhas.', score: 2 },
    ],
  },

  // ============================== BRANDING ==============================
  {
    id: 'branding_narrativa_vendas',
    section: 'branding',
    pillar: 'branding',
    title: 'Narrativa & Copy',
    prompt: 'Qual é seu domínio de narrativa de vendas e copy — a história estruturada que vende, traduzida em texto que converte?',
    type: 'single',
    options: [
      { label: 'Não tenho narrativa clara — cada campanha é por feeling', score: 0 },
      { label: 'Tenho uma história, mas nunca testei os elementos dela', score: 1 },
      { label: 'Tenho narrativa validada e consigo passar como briefing pro time', score: 2 },
      { label: 'Narrativa está mapeada e refletida em todos os canais', score: 3 },
      { label: 'Tenho processo de teste e refinamento contínuo da narrativa', score: 4 },
    ],
  },
  {
    id: 'branding_coerencia_canais',
    section: 'branding',
    pillar: 'branding',
    title: 'Coerência Multi-canal',
    prompt: 'Como você garante coerência de mensagem entre canais (anúncio, landing, e-mail, social, conteúdo)?',
    type: 'single',
    options: [
      { label: 'Cada canal é independente, cada um faz como quer', score: 0 },
      { label: 'Tenho um brief geral, mas cada canal adapta livremente', score: 1 },
      { label: 'Tenho narrativa central + hooks específicos por canal', score: 2 },
      { label: 'Sistema de aprovação que respeita a narrativa sem engessar', score: 3 },
    ],
  },
  {
    id: 'branding_social',
    section: 'branding',
    pillar: 'branding',
    sourceGroupId: 'linn86m66ufqopqutteybhpl',
    title: 'Social Media',
    prompt: 'Qual melhor descreve seu nível de domínio em Social Media?',
    type: 'single',
    options: [
      { label: 'Fazer posts orgânicos? Nunca fiz mas sei que não vale a pena.', score: 0 },
      { label: 'Entendo o básico, mas nunca fiz render além de posicionamento de marca.', score: 1 },
      { label: 'Domino a função — já rodei Blog, Instagram, TikTok, LinkedIn.', score: 2 },
      { label: 'Crio e executo estratégia de conteúdo, e sei como ela conversa com Performance.', score: 3 },
    ],
  },
  {
    id: 'branding_influencers',
    section: 'branding',
    pillar: 'branding',
    sourceGroupId: 's76u6s281g2z5sb8173wwe7u',
    title: 'Influenciadores',
    prompt: 'Qual das opções abaixo melhor descreve sua experiência com Influenciadores?',
    type: 'single',
    options: [
      { label: 'Nunca contratei ou gerenciei influencers diretamente.', score: 0 },
      { label: 'Já fizemos algumas ações, mas sem estratégia clara nem resultado.', score: 1 },
      { label: 'Já contratei vários e testei perfis, objetivos e estratégias diferentes.', score: 2 },
    ],
  },

  // =============================== DADOS ===============================
  {
    id: 'dados_utms',
    section: 'dados',
    pillar: 'dados',
    sourceGroupId: 'xwsv99ng1xh844d0tsuk78f2',
    title: 'Arquitetura de Trackeamento',
    prompt: 'Qual descreve seu domínio sobre a arquitetura de trackeamento (UTMs, eventos via GTM, etc.) que sustenta a análise do seu marketing?',
    type: 'single',
    options: [
      { label: 'Não domino — deixo essa parte com a agência ou o time.', score: 0 },
      { label: 'Usamos UTMs e GTM, mas despadronizado — falta visão geral por canal.', score: 1 },
      { label: 'Temos arquitetura clara de UTMs + GTM, base de toda a análise.', score: 2 },
      { label: 'Além de UTMs + GTM, comparo modelos de atribuição e uso marketing mix modeling.', score: 3 },
    ],
  },
  {
    id: 'dados_cultura',
    section: 'dados',
    pillar: 'dados',
    sourceGroupId: 'p7l1uw41jbyykz09hu8v2gtn',
    title: 'Cultura de Dados',
    prompt: 'Qual das afirmações abaixo melhor descreve a cultura de dados no seu time?',
    type: 'single',
    options: [
      { label: 'Cada um olha as próprias métricas na sua plataforma — sem visão do todo.', score: 0 },
      { label: 'Existe visão do todo, mas só aparece em weekly/mensal, depois que alguém junta tudo.', score: 1 },
      { label: 'O time todo enxerga métricas de negócio e operacionais (mídia, CRM, social) e discute no dia a dia.', score: 2 },
    ],
  },
  {
    id: 'dados_autonomia',
    section: 'dados',
    pillar: 'dados',
    sourceGroupId: 'lh7thz3wq8vor5su1ioqj0iv',
    title: 'Autonomia Analítica',
    prompt: 'Qual você diria que é a sua autonomia analítica?',
    type: 'single',
    options: [
      { label: 'Tenho dificuldade com os números — nem sempre sei se a explicação da agência faz sentido.', score: 0 },
      { label: 'Sei qual dado preciso e o que concluir, mas dependo de alguém pra buscar nas plataformas.', score: 1 },
      { label: 'Busco o dado sozinho em GA4, Ads Managers, CRM ou dashs — controlo o marketing sem depender de ninguém.', score: 2 },
    ],
  },
  {
    id: 'dados_diagnosis_cascata',
    section: 'dados',
    pillar: 'dados',
    title: 'Diagnosis via Cascata de Métricas',
    prompt: 'Quando uma métrica importante piora, qual é seu protocolo?',
    type: 'single',
    options: [
      { label: 'Identifico que piorou e reporto', score: 0 },
      { label: 'Desço 1-2 níveis pra procurar a causa', score: 1 },
      { label: 'Sigo a árvore de métricas até a operação + cruzo entre funções', score: 2 },
      { label: 'Como (2) + chego com 2-3 hipóteses de ação antes de apresentar', score: 3 },
    ],
  },

  // ============================== GESTÃO ==============================
  {
    id: 'gestao_senioridade_time',
    section: 'gestao',
    pillar: 'gestao',
    sourceGroupId: 'lsosdmdjuh0z0rrkta6bhjag',
    title: 'Senioridade do time liderado',
    prompt: 'Qual o nível de senioridade das pessoas que você já teve a oportunidade de liderar diretamente?',
    type: 'single',
    options: [
      { label: 'Nunca liderei pessoas diretamente', score: 0 },
      { label: 'Liderei estagiários ou assistentes', score: 1 },
      { label: 'Liderei analistas', score: 2 },
      { label: 'Liderei coordenadores e especialistas', score: 3 },
      { label: 'Liderei gerentes', score: 4 },
    ],
  },
  {
    id: 'gestao_dialogo_clevel',
    section: 'gestao',
    pillar: 'gestao',
    title: 'Diálogo com C-Level',
    prompt: 'Quando você fala com seu CEO/CFO sobre marketing, em que linguagem você fala?',
    type: 'single',
    options: [
      { label: 'Em termos de marketing puros (CTR, CAC, volume de leads)', score: 0 },
      { label: 'Traduzo para ROI/receita, mas sem amarrar a negócio', score: 1 },
      { label: 'Incluo LTV, CAC, sazonalidade e ciclo do negócio', score: 2 },
      { label: 'Falo em P&L (margem, break-even) e antecipo objeções do CFO', score: 3 },
    ],
  },
  {
    id: 'gestao_planejamento',
    section: 'gestao',
    pillar: 'gestao',
    sourceGroupId: 'ym1oper57ybawce8i3qoddei',
    title: 'Planejamento',
    prompt: 'Qual afirmação abaixo melhor descreve a situação do seu planejamento de marketing?',
    type: 'single',
    options: [
      { label: 'Planejamento? Quem me dera.', score: 0 },
      { label: 'Metas são claras, mas os planos de ação não — a prioridade muda toda hora.', score: 1 },
      { label: 'Metas e planos são claros, mas se perdem no dia a dia — nada avança direito.', score: 2 },
      { label: 'Metas, planos e acompanhamento são claros — cada um sabe suas prioridades dentro do todo.', score: 3 },
    ],
  },
  {
    id: 'gestao_responsabilidades',
    section: 'gestao',
    pillar: 'gestao',
    sourceGroupId: 'efc8rsgd8dzw8euu2bmvzdmh',
    title: 'Definição de Responsabilidades',
    prompt: 'Como está a divisão de responsabilidades no seu time?',
    type: 'single',
    options: [
      { label: 'Cada um vai fazendo conforme a necessidade — nunca parei pra definir responsabilidades.', score: 0 },
      { label: 'Divido no nível macro, mas rolam bateções de cabeça que não sei explicar.', score: 1 },
      { label: 'Cada um sabe sua função e o que se espera dele — e sei orientar quem não performa.', score: 2 },
    ],
  },
];

// ============================== STEPS ==============================
// Cada step é uma das três formas:
//   { type: 'message', html: string, section?: string }
//   { type: 'question', ...QUESTION }
//   { type: 'video-gate', id, src, poster, title }
//
// Para inserir um vídeo gate, edite EXTRA_STEPS abaixo OU `buildSteps()`.

// Vídeo gate(s) opcional. Cada item tem: position (questionId que precede o vídeo)
// + dados do vídeo. Deixe vazio enquanto não houver vídeo pra inserir.
const VIDEO_GATES = [
  // Exemplo (descomentar para usar):
  // {
  //   afterQuestionId: 'gestao_responsabilidades',
  //   id: 'video_fechamento',
  //   src: 'assets/video-fechamento.mp4',
  //   poster: 'assets/video-fechamento-poster.jpg',
  //   title: 'Antes de gerar seu resultado, assista este vídeo:',
  //   description: 'Você precisa assistir até o final para liberar o relatório.',
  // },
];

// ============================ AFTER_MESSAGES ============================
// Mapa { questionId: string[] } com mensagens que aparecem APÓS aquela pergunta.
// Se uma key existe aqui, SUBSTITUI totalmente as mensagens auto-extraídas
// (de scripts/assessment-messages.js, geradas a partir do Typebot).
// Se a key NÃO existe, fallback para auto-extracted via sourceGroupId.
//
// Use {nome} pra interpolar o primeiro nome do usuário em runtime.
export const AFTER_MESSAGES = {
  // ─── INTRO ──────────────────────────────────────────────────────────
  // Logo após o nome (1ª resposta): ensina o preenchimento ao vivo do
  // resultado. O <span data-onboarding-result> dispara a animação —
  // ver triggerOnboardingHighlight() em assessment.js.
  nome: [
    'Veja, {nome}: conforme você responde, seu resultado já vai sendo preenchido automaticamente.<span data-onboarding-result></span>',
  ],

  // ─── TRANSIÇÃO PERFIL → SKILLS ──────────────────────────────────────
  objetivo: [
    'Beleza, {nome}! Perfil 🎯 Agora 4 funções (Growth, Branding, Dados, Gestão) em múltipla escolha. Escolha a opção mais próxima da sua realidade.',
  ],

  // ─── GROWTH ─────────────────────────────────────────────────────────
  growth_match_publico_produto: [
    'Marketing não é só a parte tática do meio do caminho, é também a capacidade de olhar pro portfólio e pros públicos. Novo público + produto adaptado = curva de crescimento que anos otimizando o mesmo funil não trazem.',
  ],
  growth_icp_qualificacao: [
    'Quanto custou cada cliente só importa quando você sabe quanto cada um vale. Com o mesmo CAC, você atrai tanto quem some depois da primeira compra quanto quem fica por anos. A diferença está em saber quem é o cliente de alto LTV e ir atrás dele.',
  ],
  growth_pesquisa_cliente: [
    'Pouca gente fala com o cliente. E quem fala, descobre coisas que nenhum dashboard mostra.',
  ],
  growth_orcamento: [
    'É gastando que se aprende, mas gastar sem saber QUE CLIENTE você traz muda tudo. Mesmo CAC, públicos diferentes, LTVs muito diferentes. Volume sem qualidade só queima dinheiro.',
  ],
  growth_midia_paga: [
    'Mídia paga é o laboratório. Você aprende testando, não lendo. Mas teste sem ICP claro é tiro no escuro. Defina seu cliente de alto valor antes de otimizar canal.',
  ],
  // Última de Growth — milestone embutido
  growth_crm: [
    'CRM é o canal mais lucrativo do marketing. Converte quem já demonstrou interesse. Mas vira armadilha quando vira só fluxo de e-mail. O CRM eficiente segmenta por comportamento e fala com cada coorte de jeito diferente.',
    '<strong>Growth</strong> ✅ 1 de 4. Próximo: Branding.',
  ],

  // ─── BRANDING ───────────────────────────────────────────────────────
  branding_narrativa_vendas: [
    'Marketing é o vendedor digitalizado. A função é vender. Boa comunicação tem 5 elementos clássicos: dor, promessa, prova, proposta, CTA. Narrativa estruturada + copy afiado = a campanha mais cara do mundo não morre na praia.',
  ],
  branding_coerencia_canais: [
    'O profissional de marketing nada mais é do que um vendedor que atua em diferentes canais. Em vez do contato 1:1, ele atua em escala através de conteúdo, mídia, CRM. Ele precisa vender. E sem uma narrativa central, cada canal toca uma música diferente e o discurso enfraquece.',
  ],
  // Override vazio: o extractor do Typebot trouxe pra cá uma mensagem sobre
  // testar mídia paga, fora de contexto depois da pergunta de Social Media.
  branding_social: [],
  // Última de Branding — milestone embutido
  branding_influencers: [
    'Saber usar influenciadores na estratégia de comunicação é um enorme potencializador da narrativa, pois uma coisa é você falar de você mesmo, outra é criar o efeito de outros falando de você. Mas tem jeitos certos de fazer isso.',
    '<strong>Branding</strong> ✅ 2 de 4. Próximo: Dados.',
  ],

  // ─── DADOS ──────────────────────────────────────────────────────────
  dados_utms: [
    'Trackeamento é seu feedback loop. UTMs + eventos via GTM fazem a arquitetura que sustenta toda análise.',
  ],
  // Última de Dados — milestone embutido
  dados_diagnosis_cascata: [
    'Dados não são pra mostrar que algo piorou, são pra entender por quê. Cada métrica é input de outra; cada queda é uma porta pra investigar. O head é o explicador, não o dashboard ambulante.',
    '<strong>Dados</strong> ✅ 3 de 4. Próximo: Gestão.',
  ],

  // ─── GESTÃO ─────────────────────────────────────────────────────────
  gestao_senioridade_time: [
    'Liderança é escola: estagiário te ensina processos, coordenador te ensina decisão, gerente te ensina trade-offs. Quem nunca liderou gerente raramente tomou decisões com peso de área inteira.',
  ],
  gestao_dialogo_clevel: [
    'Quando o líder do marketing não consegue traduzir os resultados da área em linguagem de negócio, o diálogo com C-Level vira sabatina e desconfiança.',
  ],
  // Override vazio: o extractor do Typebot capturou o grupo "Conclusion - Qualified"
  // e atribuiu pra gestao_planejamento. Override vazio mata o lixo.
  gestao_planejamento: [],

  // ─── FECHAMENTO (última pergunta de Gestão) ─────────────────────────
  gestao_responsabilidades: [
    'Acabamos, {nome}! 🎉 <strong>Gestão</strong> ✅ 4 de 4. Sua pontuação: <strong>Growth</strong> {score:growth} · <strong>Branding</strong> {score:branding} · <strong>Dados</strong> {score:dados} · <strong>Gestão</strong> {score:gestao}',
  ],
};

// ============================ ANALYSIS PHASE ============================
// Tela de "análise rodando" que aparece DEPOIS do user submeter o e-mail
// e ANTES do resultado. Loading rico (mensagens transicionando) + opcional
// vídeo gate. Botão "Acessar seu relatório" só libera quando API+vídeo prontos.

export const ANALYSIS_STEPS = [
  'Lendo suas respostas...',
  'Mapeando seu cargo e segmento...',
  'Cruzando com a base de profissionais de marketing...',
  'Identificando padrões nas suas forças...',
  'Detectando lacunas e oportunidades...',
  'Comparando com benchmarks de mercado...',
  'Elaborando análise SWOT...',
  'Personalizando recomendações para o seu perfil...',
  'Finalizando o relatório...',
];

// Quando o Arthur tiver o vídeo gravado, troque enabled pra true e
// preencha src + poster. Enquanto isso, o gate é só a análise da IA.
export const ANALYSIS_VIDEO = {
  enabled: false,
  src: 'assets/arthur-analise.mp4',
  poster: 'assets/arthur-analise-poster.jpg',
  title: 'Enquanto isso, uma mensagem rápida pra você',
  description: 'Pra liberar seu relatório, assista até o final.',
};

// Vídeo final (VSL) gated antes de liberar share/download. O assessment já está
// completo quando ele aparece — o user só destrava o compartilhamento depois.
export const FINAL_VIDEO = {
  enabled: false,
  src: 'assets/arthur-vsl.mp4',
  poster: 'assets/arthur-vsl-poster.jpg',
};

// Vídeo da VSL — toca na fase 2, depois que o lead deixa o contato.
// Hospedado no Panda Video, embed por iframe. NÃO é um gate: a oferta
// cascateia sozinha logo depois (ver startOfferCascade), sem esperar o
// vídeo terminar — e a pessoa pode navegar o vídeo à vontade.
export const SALES_VIDEO = {
  enabled: true,
  pandaEmbed: 'https://player-vz-64ff1c1c-920.tv.pandavideo.com.br/embed/?v=966a2fee-5eee-4430-bdb9-a50e76963eae',
};

export function buildSteps() {
  const steps = [];

  // 1) Intro: só uma mensagem curta. Sem vídeo gated — o user precisa começar
  // interagindo imediatamente.
  for (const html of INTRO_MESSAGES) {
    steps.push({ type: 'message', html, section: 'perfil' });
  }

  // 2) For each question, push the question then any afterMessages
  for (const q of QUESTIONS) {
    steps.push({ ...q, inputType: q.type, type: 'question' });

    // Custom overrides take precedence over auto-extracted Typebot messages
    const messages =
      AFTER_MESSAGES[q.id]
      ?? MESSAGES_BY_SOURCE_GROUP[q.sourceGroupId]
      ?? [];
    for (const html of messages) {
      steps.push({ type: 'message', html, section: q.section });
    }

    // Video gate inserted after this question (if configured)
    for (const v of VIDEO_GATES) {
      if (v.afterQuestionId === q.id) {
        steps.push({ type: 'video-gate', ...v, section: q.section });
      }
    }
  }

  // ─── Transição: ofertar o resto do assessment via IA ─────────────
  // Reciprocidade: "tem custo mas eu cubro pra você". Captura email/whats
  // pra enviar o relatório completo depois (via webhook → email/whatsapp).
  steps.push({
    type: 'message',
    html: 'Falta a parte qualitativa (SWOT, comentário por pilar e análise da persona). Pra isso vou levar suas respostas pra uma IA: tem custo de processamento, mas <strong>eu cubro pra você</strong>. 🤝',
    section: 'gestao',
  });
  steps.push({
    type: 'message',
    html: 'Onde te mando o material completo daqui alguns minutos?',
    section: 'gestao',
  });
  steps.push({
    type: 'lead-form',
    id: 'lead_capture',
    section: 'gestao',
  });

  // ─── Fase 2: vendas (após lead submit, iniciada programaticamente) ─────
  // Não está em STEPS — o cascade da fase 2 é disparado por startSalesPhase()
  // após o user enviar email/whats.

  return steps;
}

// ============================== BADGES ==============================
// Cada badge tem um `when(state, helpers)` que retorna true quando o jogador
// preencheu os critérios. State é { answers, scores }. Helpers traz:
//   - maxOption(qid): true se o user marcou a última opção (score máx)
//   - hasAnsweredZero(qid): true se marcou opção 0
//   - zeroCount(): quantas perguntas marcadas como opção 0
//   - score(pillar): score % atual do pilar
export const BADGES = [
  // ─── GROWTH ─────────────────────────────────────────────────────────
  { id: 'icp_whisperer',     icon: '🎯', pillar: 'growth',
    name: 'ICP Whisperer',          blurb: 'Conhece o cliente ideal pelo CPF.',
    when: (s, h) => h.maxOption('growth_icp_qualificacao') },
  { id: 'paid_media_master', icon: '💸', pillar: 'growth',
    name: 'Paid Media Master',      blurb: 'Pode dar aula pro Pedro Sobral.',
    when: (s, h) => h.maxOption('growth_midia_paga') },
  { id: 'big_spender',       icon: '💰', pillar: 'growth',
    name: 'Big Spender',            blurb: 'Já investiu em mídia mais do que muito CMO veria numa carreira inteira.',
    when: (s, h) => h.maxOption('growth_orcamento') },
  { id: 'cliente_pesquisador', icon: '🔍', pillar: 'growth',
    name: 'Cliente Pesquisador',    blurb: 'Fala com cliente de verdade — não chuta o que ele quer.',
    when: (s, h) => h.maxOption('growth_pesquisa_cliente') },
  { id: 'product_market_fit', icon: '🧬', pillar: 'growth',
    name: 'Product-Market Fitter',  blurb: 'Já adaptou produto pra novo público com resultado.',
    when: (s, h) => h.maxOption('growth_match_publico_produto') },

  // ─── BRANDING ───────────────────────────────────────────────────────
  { id: 'storyteller_mestre', icon: '📖', pillar: 'branding',
    name: 'Storyteller Mestre',     blurb: 'Narrativa amarrada, comunicação amarrada.',
    when: (s, h) => h.maxOption('branding_narrativa_vendas') },
  { id: 'coerencia_total',   icon: '🎬', pillar: 'branding',
    name: 'Coerência Total',        blurb: 'Uma música, vários instrumentos.',
    when: (s, h) => h.maxOption('branding_coerencia_canais') },
  { id: 'social_sniper',     icon: '📱', pillar: 'branding',
    name: 'Social Sniper',          blurb: 'Não confunde post bonito com post que vende.',
    when: (s, h) => h.maxOption('branding_social') },
  { id: 'influencer_operator', icon: '🤝', pillar: 'branding',
    name: 'Influencer Operator',    blurb: 'Sabe quem postar e quem ignorar.',
    when: (s, h) => h.maxOption('branding_influencers') },

  // ─── DADOS ──────────────────────────────────────────────────────────
  { id: 'utm_architect',     icon: '🔗', pillar: 'dados',
    name: 'UTM Architect',          blurb: 'Cada link no lugar certo.',
    when: (s, h) => h.maxOption('dados_utms') },
  { id: 'dashboard_slayer',  icon: '🧠', pillar: 'dados',
    name: 'Dashboard Slayer',       blurb: 'Não é dashboard ambulante, é explicador.',
    when: (s, h) => h.maxOption('dados_diagnosis_cascata') },
  { id: 'data_culture_driver', icon: '🌐', pillar: 'dados',
    name: 'Data Culture Driver',    blurb: 'Time inteiro fala a língua dos números.',
    when: (s, h) => h.maxOption('dados_cultura') },

  // ─── GESTÃO ─────────────────────────────────────────────────────────
  { id: 'c_level_translator', icon: '👔', pillar: 'gestao',
    name: 'C-Level Translator',     blurb: 'Fala P&L, marketing e estratégia na mesma frase.',
    when: (s, h) => h.maxOption('gestao_dialogo_clevel') },
  { id: 'maestro_da_area',   icon: '🎻', pillar: 'gestao',
    name: 'Maestro da Área',        blurb: 'Planeja e responsabiliza. Os 2 no ponto.',
    when: (s, h) => h.maxOption('gestao_planejamento') && h.maxOption('gestao_responsabilidades') },
  { id: 'lider_senior',      icon: '🪖', pillar: 'gestao',
    name: 'Líder Sênior',           blurb: 'Já liderou quem tinha cargo grande.',
    when: (s, h) => h.maxOption('gestao_senioridade_time') },
  { id: 'plano_que_sai',     icon: '📋', pillar: 'gestao',
    name: 'Plano Que Sai do Papel', blurb: 'Meta vira ação no chão da operação.',
    when: (s, h) => h.maxOption('gestao_planejamento') },

  // ─── ESPECIAIS ──────────────────────────────────────────────────────
  { id: 'full_stack_real',   icon: '🦄', pillar: 'special',
    name: 'Full Stack Real',        blurb: 'Generalista de verdade, não na desculpa.',
    when: (s, h) => h.score('growth') >= 60 && h.score('branding') >= 60 && h.score('dados') >= 60 && h.score('gestao') >= 60 },
  { id: 'quadruple_threat',  icon: '🦅', pillar: 'special',
    name: 'Quadruple Threat',       blurb: '70+ em tudo. Não tem buraco no jogo.',
    when: (s, h) => h.score('growth') >= 70 && h.score('branding') >= 70 && h.score('dados') >= 70 && h.score('gestao') >= 70 },
  { id: 'especialista_growth', icon: '🚀', pillar: 'special',
    name: 'Especialista em Growth', blurb: 'Profundo em aquisição. Sabe onde mira.',
    when: (s, h) => h.score('growth') >= 80 && h.score('branding') <= 65 && h.score('dados') <= 65 && h.score('gestao') <= 65 },
  { id: 'especialista_branding', icon: '🧲', pillar: 'special',
    name: 'Especialista em Branding', blurb: 'Marca afiada. Comunicação é ofício.',
    when: (s, h) => h.score('branding') >= 80 && h.score('growth') <= 65 && h.score('dados') <= 65 && h.score('gestao') <= 65 },
  { id: 'especialista_dados', icon: '📊', pillar: 'special',
    name: 'Especialista em Dados',  blurb: 'Tracking, dashboard, cultura. Trinca completa.',
    when: (s, h) => h.score('dados') >= 80 && h.score('growth') <= 65 && h.score('branding') <= 65 && h.score('gestao') <= 65 },
  { id: 'especialista_gestao', icon: '👑', pillar: 'special',
    name: 'Especialista em Gestão', blurb: 'Lidera, prioriza, entrega. Operador sênior.',
    when: (s, h) => h.score('gestao') >= 80 && h.score('growth') <= 65 && h.score('branding') <= 65 && h.score('dados') <= 65 },
];

// ============================ PROGRESS MESSAGES ============================
// Mensagens dinâmicas disparadas durante o fluxo baseado em padrões de resposta.
// Cada trigger só dispara UMA VEZ (controlado por state.shownProgressMessages).
// `when(state, scores, helpers)` retorna a mensagem (string) ou null pra não disparar.
// `helpers`:
//   - maxOption(qid) / zeroCount()
//   - sectionStats(section) → { answered, totalScored, sumScore, maxPossible }
//     útil pra detectar "está mandando bem" / "está com dificuldade" numa seção
export const PROGRESS_MESSAGES = [
  // Após acertar 2+ opções no topo em Growth, antes de terminar o pilar
  {
    id: 'growth_strong',
    when: (s, scores, h) => {
      const maxedInGrowth = ['growth_match_publico_produto','growth_icp_qualificacao','growth_pesquisa_cliente','growth_orcamento','growth_midia_paga','growth_crm']
        .filter(qid => h.maxOption(qid)).length;
      return maxedInGrowth >= 2 ? 'Tá mandando ver em Growth, {nome}, hein? 💪' : null;
    },
  },
  // Equivalente em Branding
  {
    id: 'branding_strong',
    when: (s, scores, h) => {
      const maxed = ['branding_narrativa_vendas','branding_coerencia_canais','branding_social','branding_influencers']
        .filter(qid => h.maxOption(qid)).length;
      return maxed >= 2 ? 'Tá com a casa de Branding bem arrumada, é nítido.' : null;
    },
  },
  // Equivalente em Dados
  {
    id: 'dados_strong',
    when: (s, scores, h) => {
      const maxed = ['dados_utms','dados_cultura','dados_autonomia','dados_diagnosis_cascata']
        .filter(qid => h.maxOption(qid)).length;
      return maxed >= 2 ? 'Você sabe o que faz em Dados. Isso é raro.' : null;
    },
  },
  // Equivalente em Gestão
  {
    id: 'gestao_strong',
    when: (s, scores, h) => {
      const maxed = ['gestao_senioridade_time','gestao_dialogo_clevel','gestao_planejamento','gestao_responsabilidades']
        .filter(qid => h.maxOption(qid)).length;
      return maxed >= 2 ? 'Gestão tá afiada. Senioridade real.' : null;
    },
  },
  // Quando atinge a primeira badge
  {
    id: 'first_badge',
    when: (s, scores, h) => {
      return s.unlockedBadges && s.unlockedBadges.size >= 1 ? 'Boa, {nome}, primeira badge desbloqueada. 👀 Vai aparecendo no seu perfil aí.' : null;
    },
  },
  // Quando atinge 5+ badges
  {
    id: 'many_badges',
    when: (s, scores, h) => {
      return s.unlockedBadges && s.unlockedBadges.size >= 5 ? 'Cinco badges. Tá entregando.' : null;
    },
  },
  // Acabou de fazer a metade (26 perguntas total → midpoint em ~13)
  {
    id: 'halfway',
    when: (s, scores, h) => {
      const answered = Object.keys(s.answers).length;
      return answered >= 13 && answered < 15 ? 'Meio caminho andado, {nome}. Continua firme.' : null;
    },
  },
];

export function detectProgressMessages(state, scores, alreadyShown = new Set()) {
  const helpers = buildBadgeHelpers(state, scores);
  const fresh = [];
  for (const m of PROGRESS_MESSAGES) {
    if (alreadyShown.has(m.id)) continue;
    try {
      const html = m.when(state, scores, helpers);
      if (html) fresh.push({ id: m.id, html });
    } catch (_) { /* ignore */ }
  }
  return fresh;
}

// Helpers para os critérios de badge
export function buildBadgeHelpers(state, scores) {
  return {
    maxOption: (qid) => {
      const q = QUESTIONS.find(x => x.id === qid);
      if (!q || q.type === 'text') return false;
      const idx = state.answers[qid];
      return typeof idx === 'number' && idx === q.options.length - 1;
    },
    hasAnsweredZero: (qid) => state.answers[qid] === 0,
    zeroCount: () => Object.values(state.answers).filter(v => v === 0).length,
    score: (pillar) => scores?.[pillar] ?? 0,
  };
}

// Detecta quais badges estão desbloqueadas no estado atual.
export function detectUnlockedBadges(state, scores) {
  const helpers = buildBadgeHelpers(state, scores);
  return BADGES.filter(b => {
    try { return b.when(state, helpers); }
    catch { return false; }
  }).map(b => b.id);
}

// ============================== PERSONAS ==============================
// Personas determinísticas — avaliadas em ordem (first-match wins).
// Cada persona tem um label único, em português neutro de gênero.
// Render só no PDF final, não no profile durante o flow.
function _avg(scores) { return (scores.growth + scores.branding + scores.dados + scores.gestao) / 4; }
function _min(scores) { return Math.min(scores.growth, scores.branding, scores.dados, scores.gestao); }
function _max(scores) { return Math.max(scores.growth, scores.branding, scores.dados, scores.gestao); }
function _dominantBy(scores, pillar, gap) {
  const others = Object.entries(scores).filter(([p]) => p !== pillar).map(([_, v]) => v);
  return Math.max(...others) <= scores[pillar] - gap;
}
function _cargoKey(state) {
  const idx = state.answers.cargo;
  return ['ceo', 'gestor', 'growth_resp', 'branding_resp', 'autonomo', 'outro'][idx] ?? null;
}

// Personas — testadas em ordem, a primeira que casa vence. Ordenadas das mais
// específicas/impressionantes pras mais amplas. Cruzam score × cargo. Todo nome
// é uma identidade que se assume com orgulho; o "tem o que crescer" mora na
// descrição, enquadrado como direção — nunca no nome.
export const PERSONAS = [
  // ——— Maestria ———
  {
    id: 'maestro_marketing',
    label: 'Maestro(a) do Marketing',
    description: 'Orquestra as 4 funções com domínio real. Generalista de verdade que entrega.',
    when: (state, scores) => scores.gestao >= 75 && _min(scores) >= 55,
  },
  {
    id: 'full_stack_real',
    label: 'Full Stack Real',
    description: 'Cobre as 4 funções do marketing com profundidade. Raríssimo no mercado.',
    when: (state, scores) => _min(scores) >= 65,
  },
  // ——— Cargo × força ———
  {
    id: 'ceo_domina_marketing',
    label: 'CEO que Domina Marketing',
    description: 'Lidera o negócio E entende de marketing de verdade. Combinação rara — o time inteiro sente a diferença.',
    when: (state, scores) => _cargoKey(state) === 'ceo' && _avg(scores) >= 52,
  },
  {
    id: 'criativo_virou_gestor',
    label: 'Criativo(a) que Virou Gestor(a)',
    description: 'Subiu pela comunicação e hoje lidera. Branding é a base; a gestão veio por cima.',
    when: (state, scores) => {
      const c = _cargoKey(state);
      return (c === 'ceo' || c === 'gestor')
        && scores.branding >= 65
        && scores.branding >= scores.growth
        && scores.branding >= scores.dados
        && scores.branding >= scores.gestao;
    },
  },
  {
    id: 'cabeca_estrategica',
    label: 'Cabeça Estratégica',
    description: 'Visão de negócio e diálogo com C-level no ponto. O próximo capítulo é descer mais fundo no técnico.',
    when: (state, scores) => {
      const c = _cargoKey(state);
      return (c === 'ceo' || c === 'gestor') && scores.gestao >= 68;
    },
  },
  // ——— Especialistas (a função domina) ———
  {
    id: 'mago_growth',
    label: 'Mago(a) do Growth',
    description: 'Performance é sua zona. Vê funil onde outros veem só anúncio.',
    when: (state, scores) => scores.growth >= 70 && _dominantBy(scores, 'growth', 15),
  },
  {
    id: 'expert_branding',
    label: 'Expert em Branding',
    description: 'Storytelling e construção de marca correm no sangue.',
    when: (state, scores) => scores.branding >= 70 && _dominantBy(scores, 'branding', 15),
  },
  {
    id: 'baseado_em_dados',
    label: 'Sr(a). "Baseado em Dados"',
    description: 'Dados é sua função-mãe. Quando o time precisa da verdade, recorre a você.',
    when: (state, scores) => scores.dados >= 70 && _dominantBy(scores, 'dados', 15),
  },
  // ——— Trajetória & generalistas ———
  {
    id: 'pronto_para_liderar',
    label: 'Pronto(a) para Liderar',
    description: 'As habilidades de gestão já estão no ponto — o cargo é questão de tempo.',
    when: (state, scores) => {
      const c = _cargoKey(state);
      return _avg(scores) >= 55 && c !== 'ceo' && c !== 'gestor' && c !== 'autonomo';
    },
  },
  {
    id: 'empreendedor_polivalente',
    label: 'Empreendedor(a) Polivalente',
    description: 'Toca todas as frentes do próprio negócio e cada uma fica mais afiada. Versatilidade é o ativo — agora é método pra escalar.',
    when: (state, scores) => _cargoKey(state) === 'autonomo' && _avg(scores) >= 45,
  },
  {
    id: 'especialista_expansao',
    label: 'Especialista em Expansão',
    description: 'Domina sua área a fundo e já avança nas outras. Exatamente o perfil que o mercado disputa.',
    when: (state, scores) => _max(scores) >= 65 && _avg(scores) >= 45 && _avg(scores) <= 63,
  },
  {
    id: 'deixa_comigo',
    label: '"Deixa Comigo"',
    description: 'Não é fraco em nada — pode receber qualquer frente que entrega. O faz-tudo confiável do time.',
    when: (state, scores) => _min(scores) >= 42 && _max(scores) < 68,
  },
  {
    id: 'generalista_ascensao',
    label: 'Generalista em Ascensão',
    description: 'Repertório nas 4 funções crescendo junto, sem buraco grave. O próximo salto é cravar um pico de destaque.',
    when: (state, scores) => _avg(scores) >= 38,
  },
  {
    id: 'explorador_marketing',
    label: 'Explorador(a) do Marketing',
    description: 'No início da jornada, com o mapa inteiro pra desbravar. Melhor momento pra construir: sem vícios, sem teto.',
    when: () => true,
  },
];

export function detectPersona(state, scores) {
  for (const p of PERSONAS) {
    try {
      if (p.when(state, scores)) {
        return {
          id: p.id,
          label: p.label,
          description: p.description,
        };
      }
    } catch (_) { /* skip and try next */ }
  }
  return null;
}

// ============================== SCORING ==============================
export function computeScores(answers) {
  const totals = { gestao: 0, growth: 0, branding: 0, dados: 0 };
  for (const q of QUESTIONS) {
    if (!q.pillar) continue;
    const idx = answers[q.id];
    if (typeof idx !== 'number') continue;
    const opt = q.options[idx];
    if (!opt) continue;
    totals[q.pillar] += (opt.score ?? 0);
  }
  return {
    gestao: Math.round((totals.gestao / PILLAR_MAX.gestao) * 100),
    growth: Math.round((totals.growth / PILLAR_MAX.growth) * 100),
    branding: Math.round((totals.branding / PILLAR_MAX.branding) * 100),
    dados: Math.round((totals.dados / PILLAR_MAX.dados) * 100),
  };
}
