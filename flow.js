// flow.js — Neurogram Diagnóstico V2
// Dados, perguntas, lógica de score, personas, badges e SWOT

// ============================================================
// PERGUNTAS DE PERFIL (não pontuadas)
// ============================================================
const PROFILE_QUESTIONS = [
  {
    id: 'nome',
    type: 'text',
    title: 'Antes de começar, qual é o seu nome?',
    placeholder: 'Digite seu nome completo'
  },
  {
    id: 'email',
    type: 'email',
    title: 'Qual é o seu melhor e-mail?',
    placeholder: 'seu@email.com'
  },
  {
    id: 'funcao',
    type: 'single',
    title: 'Qual é a sua função principal?',
    options: [
      'Diretor(a) / Gestor(a)',
      'Médico(a) interno',
      'Médico(a) terceirizado',
      'Técnico(a) em EEG',
      'Secretário(a)',
      'Outro'
    ]
  },
  {
    id: 'instituicao',
    type: 'single',
    title: 'Qual o perfil da sua instituição?',
    options: [
      'Clínica especializada em EEG',
      'Clínica multidisciplinar',
      'Hospital',
      'Centro de Diagnóstico',
      'Universidade / Pesquisa',
      'Outro'
    ]
  },
  {
    id: 'estado',
    type: 'dropdown',
    title: 'Em qual estado você atua?',
    options: ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
  },
  {
    id: 'volume',
    type: 'single',
    title: 'Quantos exames de EEG sua instituição realiza por mês?',
    options: [
      'Até 50',
      '51–100',
      '101–250',
      '251–500',
      'Mais de 500'
    ]
  },
  {
    id: 'objetivo',
    type: 'single',
    title: 'Qual é o seu principal objetivo hoje?',
    options: [
      'Aumentar produtividade',
      'Reduzir tempo de entrega dos laudos',
      'Organizar a operação',
      'Melhorar integração entre sistemas',
      'Aumentar segurança e rastreabilidade',
      'Ter mais visibilidade dos indicadores',
      'Escalar sem aumentar equipe'
    ]
  }
];

// ============================================================
// SEÇÕES DO BENCHMARK (mensagens de transição)
// ============================================================
const SECTIONS = {
  seguranca: {
    icon: '🛡️',
    label: 'Segurança',
    intro: 'Vamos começar avaliando a segurança e rastreabilidade da sua operação.'
  },
  processos: {
    icon: '📋',
    label: 'Processos',
    intro: 'Agora vamos entender como são os seus fluxos do exame ao laudo.'
  },
  interoperabilidade: {
    icon: '🔗',
    label: 'Interoperabilidade',
    intro: 'Ótimo! Agora vamos falar sobre a integração entre sistemas, equipamentos e equipes.'
  },
  inteligencia: {
    icon: '🧠',
    label: 'Inteligência',
    intro: 'Quase lá. Últimas perguntas — sobre indicadores e tomada de decisão.'
  }
};

// ============================================================
// PERGUNTAS DO BENCHMARK (pontuadas)
// ============================================================
const BENCHMARK_QUESTIONS = [
  // ── SEGURANÇA ──────────────────────────────────────────────
  {
    id: 'seg_armazenamento',
    pillar: 'seguranca',
    title: 'Onde ficam armazenados os exames?',
    badge: { id: 'dados_protegidos', label: '🔒 Dados Protegidos' },
    options: [
      { label: 'Computador local', score: 0 },
      { label: 'Servidor interno', score: 8 },
      { label: 'Nuvem genérica (Drive, Dropbox)', score: 16 },
      { label: 'Plataforma especializada', score: 25 }
    ]
  },
  {
    id: 'seg_backup',
    pillar: 'seguranca',
    title: 'Se um computador da clínica parar de funcionar hoje, o que acontece?',
    badge: { id: 'backup_garantido', label: '💾 Backup Garantido' },
    options: [
      { label: 'Posso perder exames', score: 0 },
      { label: 'Tenho backup manual', score: 8 },
      { label: 'Tenho backup automático', score: 16 },
      { label: 'Tenho redundância e recuperação imediata', score: 25 }
    ]
  },
  {
    id: 'seg_acesso',
    pillar: 'seguranca',
    title: 'Como você controla quem acessa exames e laudos?',
    badge: { id: 'acesso_controlado', label: '👤 Acesso Controlado' },
    options: [
      { label: 'Não existe controle formal', score: 0 },
      { label: 'Acesso compartilhado por senhas', score: 8 },
      { label: 'Usuários individuais', score: 16 },
      { label: 'Permissões e rastreabilidade completas', score: 25 }
    ]
  },
  {
    id: 'seg_historico',
    pillar: 'seguranca',
    title: 'Se um exame realizado há 2 anos precisar ser encontrado hoje, qual a dificuldade?',
    badge: { id: 'historico_recuperavel', label: '🔎 Histórico Recuperável' },
    options: [
      { label: 'Não conseguiríamos encontrar', score: 0 },
      { label: 'Levaria bastante tempo', score: 8 },
      { label: 'Conseguimos localizar com algum esforço', score: 16 },
      { label: 'Localizamos rapidamente com busca estruturada', score: 25 }
    ]
  },

  // ── PROCESSOS ──────────────────────────────────────────────
  {
    id: 'proc_envio',
    pillar: 'processos',
    title: 'Como é feito o envio de exames e laudos?',
    badge: { id: 'fluxo_estruturado', label: '📋 Fluxo Estruturado' },
    options: [
      { label: 'WhatsApp', score: 0 },
      { label: 'E-mail', score: 8 },
      { label: 'Pasta compartilhada', score: 16 },
      { label: 'Fluxo centralizado em plataforma', score: 25 }
    ]
  },
  {
    id: 'proc_pendentes',
    pillar: 'processos',
    title: 'Como você acompanha laudos pendentes?',
    badge: { id: 'fila_controle', label: '⏳ Fila Sob Controle' },
    options: [
      { label: 'Não acompanho formalmente', score: 0 },
      { label: 'Controle informal entre equipe', score: 8 },
      { label: 'Planilha', score: 16 },
      { label: 'Worklist estruturada e rastreável', score: 25 }
    ]
  },
  {
    id: 'proc_qualidade',
    pillar: 'processos',
    title: 'Como funciona o controle de qualidade dos laudos?',
    badge: { id: 'qualidade_garantida', label: '🎯 Qualidade Garantida' },
    options: [
      { label: 'Não existe controle', score: 0 },
      { label: 'Apenas quando surgem erros', score: 8 },
      { label: 'Revisões periódicas', score: 16 },
      { label: 'Processo estruturado com modelos pré-estabelecidos', score: 25 }
    ]
  },
  {
    id: 'proc_assinatura',
    pillar: 'processos',
    title: 'Como os laudos são assinados?',
    badge: { id: 'assinatura_digital', label: '✍️ Assinatura Digital' },
    options: [
      { label: 'Assinatura manual / impressa', score: 0 },
      { label: 'PDF sem validação', score: 8 },
      { label: 'Certificado digital externo', score: 16 },
      { label: 'Assinatura integrada ao fluxo', score: 25 }
    ]
  },

  // ── INTEROPERABILIDADE ────────────────────────────────────
  {
    id: 'inter_equipamento',
    pillar: 'interoperabilidade',
    title: 'Como os exames saem do equipamento e chegam para análise?',
    badge: { id: 'integracao_equipamentos', label: '⚡ Integração de Equipamentos' },
    options: [
      { label: 'Transferência manual (USB, cabo)', score: 0 },
      { label: 'Exportação manual digital', score: 8 },
      { label: 'Integração parcial com algum sistema', score: 16 },
      { label: 'Integração totalmente automatizada', score: 25 }
    ]
  },
  {
    id: 'inter_visualizacao',
    pillar: 'interoperabilidade',
    title: 'Como sua equipe visualiza os exames de EEG?',
    badge: { id: 'operacao_multimarca', label: '🧩 Operação Multimarca' },
    options: [
      { label: 'Cada fabricante exige um software diferente', score: 0 },
      { label: 'Usamos apenas um fabricante e o software dele', score: 16 },
      { label: 'Centralizamos parte dos exames em um único ambiente', score: 20 },
      { label: 'Todos os exames em um único ambiente, independente do fabricante', score: 25 }
    ]
  },
  {
    id: 'inter_plataformas',
    pillar: 'interoperabilidade',
    title: 'Quantas plataformas/programas são necessários para concluir um laudo?',
    badge: { id: 'plataforma_unificada', label: '🏢 Plataforma Unificada' },
    options: [
      { label: 'Mais de 5', score: 0 },
      { label: '4 ou 5', score: 8 },
      { label: '2 ou 3', score: 16 },
      { label: 'Tudo em uma única plataforma', score: 25 }
    ]
  },
  {
    id: 'inter_entrega',
    pillar: 'interoperabilidade',
    title: 'Como os laudos são enviados ao médico solicitante ou paciente?',
    badge: { id: 'entrega_conectada', label: '📤 Entrega Conectada' },
    options: [
      { label: 'Manualmente por WhatsApp, e-mail ou impressão', score: 0 },
      { label: 'Processo digital, mas envio ainda é manual', score: 8 },
      { label: 'Disponíveis em um portal para consulta', score: 16 },
      { label: 'Entrega digital, rastreável e integrada ao fluxo', score: 25 }
    ]
  },

  // ── INTELIGÊNCIA ──────────────────────────────────────────
  {
    id: 'int_volume',
    pillar: 'inteligencia',
    title: 'Você sabe quantos exames e laudos realizou no último mês?',
    badge: { id: 'operacao_visivel', label: '📊 Operação Visível' },
    options: [
      { label: 'Não sei', score: 0 },
      { label: 'Tenho uma estimativa aproximada', score: 8 },
      { label: 'Consigo levantar manualmente', score: 16 },
      { label: 'Tenho acesso imediato ao dado', score: 25 }
    ]
  },
  {
    id: 'int_tempo',
    pillar: 'inteligencia',
    title: 'Você sabe quanto tempo leva entre a realização do exame e o envio do laudo?',
    badge: { id: 'tempo_controle', label: '⏱️ Tempo Sob Controle' },
    options: [
      { label: 'Não sei', score: 0 },
      { label: 'Tenho uma estimativa aproximada', score: 8 },
      { label: 'Acompanho ocasionalmente', score: 16 },
      { label: 'Monitoro continuamente com dados reais', score: 25 }
    ]
  },
  {
    id: 'int_indicadores',
    pillar: 'inteligencia',
    title: 'Você acompanha indicadores da operação?',
    badge: { id: 'gestao_indicadores', label: '📈 Gestão por Indicadores' },
    options: [
      { label: 'Nenhum indicador', score: 0 },
      { label: 'Apenas faturamento', score: 8 },
      { label: 'Faturamento e volume de exames', score: 16 },
      { label: 'Dashboard operacional completo', score: 25 }
    ]
  },
  {
    id: 'int_gargalos',
    pillar: 'inteligencia',
    title: 'Como você identifica gargalos na operação?',
    badge: { id: 'decisoes_dados', label: '🧠 Decisões por Dados' },
    options: [
      { label: 'Quando surgem reclamações', score: 0 },
      { label: 'Percepção da equipe', score: 8 },
      { label: 'Análises ocasionais', score: 16 },
      { label: 'Indicadores em tempo real', score: 25 }
    ]
  }
];

// ============================================================
// TEXTOS DOS PILARES (4 faixas × 4 pilares = 16 textos)
// ============================================================
const PILLAR_TEXTS = {
  seguranca: [
    { min: 0,  max: 39,  text: 'Os mecanismos de armazenamento, recuperação e controle das informações ainda apresentam fragilidades importantes. A operação depende de processos pouco estruturados para proteger dados críticos, aumentando riscos de perda, dificuldade de rastreabilidade e indisponibilidade de informações.' },
    { min: 40, max: 59,  text: 'Existem práticas básicas de proteção e recuperação dos dados, mas ainda há oportunidades relevantes para aumentar a rastreabilidade, o controle de acesso e a capacidade de recuperação das informações clínicas.' },
    { min: 60, max: 79,  text: 'A clínica demonstra boa maturidade na gestão e proteção dos dados. Os principais fundamentos de segurança já estão presentes, reduzindo riscos operacionais e aumentando a confiabilidade da operação.' },
    { min: 80, max: 100, text: 'A proteção, rastreabilidade e recuperação das informações clínicas estão acima da média observada no mercado. Segurança deixa de ser um fator limitante e passa a atuar como um alicerce para o crescimento da operação.' }
  ],
  processos: [
    { min: 0,  max: 39,  text: 'Grande parte do fluxo entre exame e laudo ainda depende de controles manuais, conhecimento individual e baixa padronização. Esse cenário tende a aumentar retrabalho, atrasos e dificuldade de escala.' },
    { min: 40, max: 59,  text: 'A clínica já possui iniciativas de organização dos processos, mas ainda convive com etapas pouco estruturadas e dependência operacional de pessoas específicas.' },
    { min: 60, max: 79,  text: 'Os principais fluxos da operação apresentam consistência e previsibilidade. Existe uma base sólida para crescimento, embora ainda haja oportunidades para reduzir atividades manuais e aumentar a eficiência.' },
    { min: 80, max: 100, text: 'Os processos demonstram alto nível de padronização e controle. A operação consegue manter qualidade e previsibilidade mesmo diante de aumento de volume e complexidade.' }
  ],
  interoperabilidade: [
    { min: 0,  max: 39,  text: 'Equipamentos, sistemas e profissionais ainda operam de forma fragmentada. A necessidade de múltiplas ferramentas e fluxos paralelos aumenta a complexidade operacional e reduz a eficiência.' },
    { min: 40, max: 59,  text: 'Existem avanços importantes na integração da operação, mas ainda persistem barreiras entre sistemas, fabricantes ou equipes que geram atritos ao longo do fluxo.' },
    { min: 60, max: 79,  text: 'A clínica já possui um bom nível de conectividade operacional. Parte significativa dos processos ocorre de forma integrada, reduzindo retrabalho e melhorando a experiência da equipe.' },
    { min: 80, max: 100, text: 'A operação demonstra alta capacidade de integração entre equipamentos, sistemas e profissionais. A informação circula com fluidez, reduzindo dependências e aumentando a eficiência operacional.' }
  ],
  inteligencia: [
    { min: 0,  max: 39,  text: 'A tomada de decisão ainda depende principalmente da experiência e da percepção da equipe. A ausência de indicadores estruturados dificulta a identificação de gargalos e oportunidades de melhoria.' },
    { min: 40, max: 59,  text: 'Alguns indicadores já são acompanhados, mas a visibilidade sobre a operação ainda é limitada. Existe oportunidade para ampliar o uso de dados como ferramenta de gestão.' },
    { min: 60, max: 79,  text: 'A clínica já utiliza indicadores para acompanhar parte importante da operação. Isso permite identificar oportunidades de melhoria e tomar decisões com maior previsibilidade.' },
    { min: 80, max: 100, text: 'Dados e indicadores fazem parte da rotina de gestão. A operação possui alta capacidade de monitoramento, aprendizado e tomada de decisão baseada em evidências.' }
  ]
};

// ============================================================
// BADGES ESPECIAIS
// ============================================================
const SPECIAL_BADGES = [
  { id: 'fortaleza_digital',       label: '🛡️ Fortaleza Digital',        condition: s => s.seguranca > 80 },
  { id: 'excelencia_operacional',  label: '📋 Excelência Operacional',   condition: s => s.processos > 80 },
  { id: 'operacao_conectada',      label: '🔗 Operação Conectada',       condition: s => s.interoperabilidade > 80 },
  { id: 'clinica_inteligente',     label: '🧠 Clínica Inteligente',      condition: s => s.inteligencia > 80 },
  { id: 'alta_performance',        label: '⚡ Alta Performance',          condition: s => Object.values(s).every(v => v > 80) },
  { id: 'elite_neurofisiologica',  label: '🏆 Elite Neurofisiológica',   condition: s => Object.values(s).every(v => v > 90) }
];

// ============================================================
// PERSONAS (9 no total, 3 níveis)
// ============================================================
const PERSONAS = [
  // NÍVEL 1 — ELITE
  {
    id: 'referencia',
    label: '💎 Referência em Neurofisiologia',
    tier: 'elite',
    text: 'Sua clínica opera em um nível de maturidade acima da média do mercado. Segurança, processos, interoperabilidade e inteligência trabalham de forma integrada, criando uma operação eficiente, previsível e preparada para crescer. O principal desafio daqui para frente não é estruturar a operação, mas continuar evoluindo e sustentando esse padrão de excelência.'
  },
  {
    id: 'escalar',
    label: '🚀 Pronta para Escalar',
    tier: 'elite',
    text: 'Sua clínica possui bases sólidas para absorver crescimento sem aumentar proporcionalmente a complexidade operacional. Processos bem definidos e uma operação consistente permitem expandir volume, equipe e serviços com mais previsibilidade. O próximo passo é fortalecer a inteligência operacional para sustentar esse crescimento no longo prazo.'
  },
  // NÍVEL 2 — DOMINÂNCIA (por pilar)
  {
    id: 'ecossistema',
    label: '🔗 Ecossistema Integrado',
    tier: 'dominancia',
    pillar: 'interoperabilidade',
    text: 'Sua clínica se destaca pela capacidade de conectar pessoas, equipamentos e sistemas em uma única operação. Essa integração reduz barreiras, elimina etapas desnecessárias e aumenta a eficiência do fluxo de trabalho. A oportunidade está em utilizar essa conectividade para gerar mais inteligência e previsibilidade operacional.'
  },
  {
    id: 'precisao',
    label: '📋 Operação de Precisão',
    tier: 'dominancia',
    pillar: 'processos',
    text: 'Sua maior força está na consistência dos processos. Exames, laudos e fluxos operacionais seguem padrões claros, reduzindo retrabalho e dependência de pessoas específicas. Isso cria uma operação previsível e confiável. O próximo estágio é ampliar a integração entre sistemas e utilizar mais dados para otimizar a tomada de decisão.'
  },
  {
    id: 'decisor',
    label: '🧠 Decisor Estratégico',
    tier: 'dominancia',
    pillar: 'inteligencia',
    text: 'Sua operação demonstra uma forte cultura orientada por dados. Indicadores, métricas e análises fazem parte da rotina e ajudam a identificar oportunidades antes que se tornem problemas. O desafio agora é transformar essa inteligência em melhorias contínuas nos processos e na experiência operacional.'
  },
  {
    id: 'fortaleza',
    label: '🛡️ Fortaleza Clínica',
    tier: 'dominancia',
    pillar: 'seguranca',
    text: 'A proteção e a confiabilidade da operação são seus maiores diferenciais. Sua clínica demonstra maturidade na gestão de informações, rastreabilidade e continuidade operacional, reduzindo riscos e aumentando a segurança dos dados. A oportunidade está em transformar essa base sólida em ganhos adicionais de produtividade e integração.'
  },
  // NÍVEL 3 — EQUILÍBRIO
  {
    id: 'evolucao',
    label: '📈 Em Evolução',
    tier: 'equilibrio',
    text: 'Sua clínica já possui práticas importantes de gestão e organização, mas ainda apresenta oportunidades claras de amadurecimento. Existem boas bases construídas, porém alguns processos continuam dependentes de controles manuais ou pouco integrados. Com pequenos ajustes estruturais, é possível alcançar ganhos significativos de eficiência e controle.'
  },
  {
    id: 'transformacao',
    label: '🔄 Em Transformação',
    tier: 'equilibrio',
    text: 'Sua operação está em um momento de transição. Algumas iniciativas de modernização já foram implementadas, mas ainda convivem com processos manuais, limitações operacionais e baixa visibilidade sobre determinados aspectos da rotina. O potencial de evolução é alto, principalmente nas áreas de integração, padronização e gestão.'
  },
  {
    id: 'artesanal',
    label: '🏥 Clínica Artesanal',
    tier: 'equilibrio',
    text: 'Grande parte da operação ainda depende de processos manuais, conhecimento individual e ferramentas pouco conectadas entre si. Isso não significa que a clínica não funcione bem, mas indica que existe uma oportunidade importante de ganhar produtividade, previsibilidade e controle. Os maiores ganhos normalmente surgem da organização dos fluxos e da digitalização da operação.'
  }
];

// ============================================================
// TEXTOS DA SWOT
// ============================================================
const SWOT_TEXTS = {
  forcas: {
    seguranca:          'Seus dados clínicos apresentam alto nível de proteção, rastreabilidade e capacidade de recuperação, reduzindo riscos operacionais e aumentando a confiabilidade da operação.',
    processos:          'Os fluxos da clínica demonstram alto nível de consistência e previsibilidade, reduzindo retrabalho e aumentando a eficiência da operação.',
    interoperabilidade: 'Equipamentos, sistemas e profissionais operam de forma integrada, reduzindo barreiras operacionais e aumentando a fluidez dos processos.',
    inteligencia:       'A tomada de decisão é fortemente apoiada por indicadores e métricas operacionais, proporcionando maior visibilidade sobre a performance da clínica.'
  },
  oportunidades: {
    seguranca:          'A estrutura atual já oferece uma boa base de proteção e rastreabilidade. O próximo passo está em ampliar a governança dos dados e fortalecer mecanismos de recuperação e controle de acesso.',
    processos:          'Os processos da clínica apresentam um bom nível de organização, mas ainda existem oportunidades para reduzir atividades manuais e aumentar a previsibilidade operacional.',
    interoperabilidade: 'A integração entre equipamentos e sistemas já reduz parte dos atritos da operação. A principal oportunidade está em simplificar ainda mais os fluxos e diminuir dependências entre ferramentas.',
    inteligencia:       'A clínica já acompanha indicadores importantes, mas existe espaço para ampliar a visibilidade operacional e acelerar a identificação de oportunidades de melhoria.'
  },
  fraquezas: {
    seguranca:          'A operação apresenta vulnerabilidades relacionadas ao armazenamento, recuperação ou rastreabilidade das informações clínicas.',
    processos:          'Parte significativa da operação ainda depende de controles manuais e conhecimento individual, reduzindo previsibilidade e escalabilidade.',
    interoperabilidade: 'Equipamentos, sistemas e equipes ainda operam de forma fragmentada, aumentando a complexidade operacional e o retrabalho.',
    inteligencia:       'A baixa visibilidade dos indicadores limita a capacidade de identificar gargalos e tomar decisões baseadas em dados.'
  }
};

const SWOT_ALERTS = [
  { condition: s => s.seguranca >= 80 && s.processos < 60,           text: 'Apesar da boa proteção das informações, a ausência de processos estruturados pode gerar retrabalho e atrasos operacionais.' },
  { condition: s => s.seguranca >= 80 && s.interoperabilidade < 60,  text: 'Os dados estão protegidos, mas ainda circulam por fluxos fragmentados, reduzindo a eficiência da operação.' },
  { condition: s => s.processos >= 80 && s.inteligencia < 60,        text: 'A operação é consistente, mas a falta de indicadores limita a identificação de gargalos e oportunidades de melhoria.' },
  { condition: s => s.processos >= 80 && s.interoperabilidade < 60,  text: 'Processos bem definidos podem perder eficiência quando dependem de múltiplos sistemas e fluxos desconectados.' },
  { condition: s => s.interoperabilidade < 60 && s.inteligencia < 60,text: 'A combinação de sistemas fragmentados e baixa visibilidade operacional tende a dificultar o crescimento sustentável da clínica.' },
  { condition: s => s.seguranca < 60 && s.interoperabilidade < 60,   text: 'A dispersão das informações entre diferentes sistemas aumenta riscos operacionais e reduz a rastreabilidade dos exames.' },
  { condition: s => s.inteligencia >= 80 && s.processos < 60,        text: 'Os dados ajudam a identificar problemas, mas a falta de processos estruturados dificulta a execução das melhorias necessárias.' },
  { condition: s => s.inteligencia >= 80 && s.interoperabilidade < 60,text: 'Existe capacidade analítica para enxergar oportunidades, mas a fragmentação da operação dificulta capturar esses ganhos.' }
];

// ============================================================
// FUNÇÕES DE CÁLCULO
// ============================================================

function computeScores(answers) {
  const totals = { seguranca: 0, processos: 0, interoperabilidade: 0, inteligencia: 0 };
  for (const q of BENCHMARK_QUESTIONS) {
    const idx = answers[q.id];
    if (idx === undefined || idx === null) continue;
    totals[q.pillar] += (q.options[idx].score || 0);
  }
  return totals;
}

function avg(scores) {
  const vals = Object.values(scores);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getPillarText(pillar, score) {
  const tiers = PILLAR_TEXTS[pillar];
  return tiers.find(t => score >= t.min && score <= t.max)?.text || '';
}

function detectPersona(scores) {
  // NÍVEL 1 — ELITE
  if (Object.values(scores).every(s => s >= 85)) return PERSONAS.find(p => p.id === 'referencia');
  if (Object.values(scores).every(s => s >= 70)) return PERSONAS.find(p => p.id === 'escalar');

  // NÍVEL 2 — DOMINÂNCIA
  // Encontra o score máximo e todos os pilares empatados no topo
  const maxScore = Math.max(...Object.values(scores));
  const topPillars = Object.entries(scores).filter(([, s]) => s === maxScore).map(([p]) => p);
  // Score abaixo dos empatados
  const belowScores = Object.entries(scores).filter(([p]) => !topPillars.includes(p)).map(([, s]) => s);
  const belowMax = belowScores.length > 0 ? Math.max(...belowScores) : 0;

  if (maxScore - belowMax >= 10) {
    // Há dominância. Aplicar tiebreaker por prioridade narrativa.
    const priority = ['interoperabilidade', 'processos', 'inteligencia', 'seguranca'];
    for (const p of priority) {
      if (topPillars.includes(p)) {
        return PERSONAS.find(pe => pe.pillar === p);
      }
    }
  }

  // NÍVEL 3 — EQUILÍBRIO
  const average = avg(scores);
  if (average >= 55) return PERSONAS.find(p => p.id === 'evolucao');
  if (average >= 35) return PERSONAS.find(p => p.id === 'transformacao');
  return PERSONAS.find(p => p.id === 'artesanal');
}

function detectBadges(answers, scores) {
  const unlocked = [];

  // Badges individuais: opção máxima de cada pergunta
  for (const q of BENCHMARK_QUESTIONS) {
    const idx = answers[q.id];
    if (idx !== undefined && idx !== null && idx === q.options.length - 1) {
      unlocked.push(q.badge);
    }
  }

  // Badges especiais: baseados em scores por pilar
  for (const b of SPECIAL_BADGES) {
    if (b.condition(scores)) {
      unlocked.push({ id: b.id, label: b.label });
    }
  }

  return unlocked;
}

function computeSWOT(scores) {
  const forcas = [];
  const oportunidades = [];
  const fraquezas = [];
  const alertas = [];

  const pillars = ['seguranca', 'processos', 'interoperabilidade', 'inteligencia'];

  for (const p of pillars) {
    const s = scores[p];
    if (s >= 80) forcas.push({ pillar: p, text: SWOT_TEXTS.forcas[p] });
    else if (s >= 60) oportunidades.push({ pillar: p, text: SWOT_TEXTS.oportunidades[p] });
    else fraquezas.push({ pillar: p, text: SWOT_TEXTS.fraquezas[p] });
  }

  for (const alert of SWOT_ALERTS) {
    if (alert.condition(scores)) {
      alertas.push(alert.text);
      if (alertas.length >= 2) break;
    }
  }

  if (alertas.length === 0) {
    alertas.push('Sua clínica apresenta um perfil operacional maduro, sem riscos críticos identificados neste diagnóstico.');
  }

  return {
    forcas: forcas.slice(0, 3),
    oportunidades: oportunidades.slice(0, 2),
    fraquezas: fraquezas.slice(0, 2),
    alertas: alertas.slice(0, 2)
  };
}

function generateSlug(nome) {
  const clean = (nome || 'clinica').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${clean}-${rand}`;
}

function getScoreColor(score) {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#06B6D4';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

function getScoreLabel(score) {
  if (score >= 80) return 'Avançado';
  if (score >= 60) return 'Consolidado';
  if (score >= 40) return 'Em desenvolvimento';
  return 'Inicial';
}
