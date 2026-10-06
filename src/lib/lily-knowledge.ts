export type ArticleCategory =
  | "agendamentos"
  | "disponibilidade"
  | "ordens-servico"
  | "estoque"
  | "relatorios"
  | "acesso"
  | "perfil"
  | "mensagens"
  | "geral";

export type Article = {
  id: string;
  category: ArticleCategory;
  title: string;
  keywords: string[];
  requiredRole?: "admin" | "operador" | "logistica" | "consulta" | "instituicao" | "any";
  relatedScreen?: string;
  steps: string[];
  whatHappensNext?: string;
  restrictions?: string[];
  errorResolution?: string[];
};

export const KNOWLEDGE_BASE: Article[] = [
  // ── AGENDAMENTOS ──────────────────────────────────────────────────────────
  {
    id: "ag-01",
    category: "agendamentos",
    title: "Como funciona o agendamento de visitas?",
    keywords: ["agendar", "visita", "solicitar", "escola", "instituição", "formulário"],
    requiredRole: "any",
    relatedScreen: "/agendar",
    steps: [
      "1. Acesse a página Agendar Visita.",
      "2. Selecione a instituição que realizará a visita (ou cadastre uma nova).",
      "3. Escolha a data no calendário — dias indisponíveis ficam bloqueados.",
      "4. Escolha o turno (Manhã ou Tarde).",
      "5. Preencha: faixa etária dos visitantes, quantidade de alunos, professores e acompanhantes.",
      "6. Informe o responsável pela escola e um telefone/WhatsApp com DDD.",
      "7. Se houver alunos PCD, marque 'Sim' e preencha os campos que aparecerão.",
      "8. Escolha o transporte: Ônibus do Detran ou Transporte Próprio.",
      "9. Opcionalmente adicione observações.",
      "10. Clique em 'Solicitar Agendamento' (equipe Detran) ou 'Confirmar Agendamento' (Modo Equipe).",
    ],
    whatHappensNext:
      "Se você for da equipe Detran, o agendamento é confirmado na hora. Caso contrário, ele fica como 'pendente' e é analisado pela equipe.",
    restrictions: [
      "A antecedência mínima é de 3 dias (pode variar por centro).",
      "A antecedência máxima é de 60 dias (pode variar por centro).",
      "Não é possível agendar para domingos e feriados do centro.",
      "A capacidade máxima é 46 pessoas (alunos + professores + acompanhantes).",
    ],
    errorResolution: [
      "Se a data não aparece no calendário: ela pode estar bloqueada, fora do limite de antecedência, ou o centro não funciona naquele dia.",
      "Se aparecer erro de capacidade: reduza o número de pessoas ou verifique se outro agendamento já ocupou as vagas.",
      "Se aparecer 'Limite por instituição': sua escola já atingiu o máximo de agendamentos permitidos no período.",
    ],
  },
  {
    id: "ag-02",
    category: "agendamentos",
    title: "O que acontece após solicitar um agendamento?",
    keywords: ["pendente", "confirmado", "status", "aprovação", "após solicitar"],
    requiredRole: "any",
    relatedScreen: "/agendar",
    steps: [
      "1. Ao clicar em 'Solicitar Agendamento', o sistema verifica todas as regras.",
      "2. Se tudo estiver correto, o agendamento é criado com status 'pendente'.",
      "3. Um operador da equipe DETRAN analisa o pedido.",
      "4. Se aprovado, o status muda para 'confirmado' e você recebe confirmação.",
      "5. Se necessário, um operador pode entrar em contato pelo WhatsApp informado.",
    ],
    whatHappensNext: "Aguarde a análise. Você pode acompanhar o status na aba Agendamentos do painel Admin.",
  },
  {
    id: "ag-03",
    category: "agendamentos",
    title: "Como funcionam as regras de disponibilidade?",
    keywords: ["regras", "disponibilidade", "centro", "capacidade", "limite", "antecedência"],
    requiredRole: "any",
    relatedScreen: "/agendar",
    steps: [
      "1. Cada centro (Fortaleza, Sobral, Crato) tem suas próprias regras.",
      "2. As regras incluem: capacidade máxima de visitantes, antecedência mínima e máxima, limite por instituição e horários de funcionamento.",
      "3. Algumas datas podem estar bloqueadas por motivo de evento ou manutenção.",
      "4. Cada instituição tem um limite de agendamentos por mês ou semana.",
      "5. Você pode consultar as regras na faixa azul no topo do formulário de agendamento.",
    ],
    restrictions: [
      "Domingos e feriados do centro não estão disponíveis.",
      "Datas com 'cheio' não aceitam mais agendamentos.",
    ],
  },
  {
    id: "ag-04",
    category: "agendamentos",
    title: "Como cadastrar uma nova instituição?",
    keywords: ["cadastrar", "instituição", "escola", "nova", "criar"],
    requiredRole: "any",
    relatedScreen: "/agendar",
    steps: [
      "1. Na página Agendar, clique em 'Cadastrar nova instituição'.",
      "2. Preencha: nome, tipo (escola, empresa, etc.), cidade e rede (se for escola).",
      "3. Telefone é opcional.",
      "4. Clique em 'Criar e selecionar'.",
      "5. A instituição será criada e já estará selecionada para o agendamento.",
    ],
    whatHappensNext: "Ao criar, você se torna automaticamente o proprietário e já pode fazer agendamentos.",
  },
  {
    id: "ag-05",
    category: "agendamentos",
    title: "Como funciona o Modo Equipe (staff)?",
    keywords: ["modo equipe", "staff", "operador", "logistica", "qualquer instituição"],
    requiredRole: "operador",
    relatedScreen: "/agendar",
    steps: [
      "1. Usuários com perfil Operador, Logística ou Consulta têm acesso ao Modo Equipe.",
      "2. Nesse modo, ao agendar, aparece um campo de busca para selecionar qualquer instituição.",
      "3. O agendamento feito por staff é confirmado automaticamente (status: confirmado).",
      "4. Não há limite por instituição para staff.",
      "5. O nome e instituição de quem faz o agendamento ficam registrados.",
    ],
  },
  // ── DISPONIBILIDADE ───────────────────────────────────────────────────────
  {
    id: "disp-01",
    category: "disponibilidade",
    title: "Como funciona a gestão de disponibilidade?",
    keywords: ["disponibilidade", "bloquear", "data", "horário", "calendário", "centro"],
    requiredRole: "operador",
    relatedScreen: "disponibilidade",
    steps: [
      "1. Acesse a aba 'Disponibilidade' no painel Admin.",
      "2. Visualize os agendamentos confirmados e pendentes organizados por data.",
      "3. Você pode bloquear datas específicas para manutenção ou eventos.",
      "4. Cada centro (Fortaleza, Sobral, Crato) tem suas próprias regras.",
    ],
  },
  {
    id: "disp-02",
    category: "disponibilidade",
    title: "Como configurar as regras de agendamento (Regras do Centro)?",
    keywords: ["regras", "centro", "capacidade", "antecedência", "limite", "admin"],
    requiredRole: "operador",
    relatedScreen: "regras",
    steps: [
      "1. Acesse a aba 'Regras' no painel Admin.",
      "2. Selecione o centro (Fortaleza, Sobral ou Crato).",
      "3. Configure: capacidade máxima de visitantes, antecedência mínima e máxima.",
      "4. Configure o limite de agendamentos por instituição por período.",
      "5. Ative ou desative o centro.",
      "6. Adicione ou remova horários de funcionamento.",
      "7. Adicione bloqueios de datas especiais.",
    ],
    restrictions: [
      "Apenas operadores e administradores podem alterar as regras.",
      "Alterar regras não afeta agendamentos já confirmados.",
    ],
    errorResolution: [
      "Se as regras não carregam: recarregue a página e tente novamente.",
      "Se não conseguir salvar: verifique sua conexão e tente novamente.",
    ],
  },
  // ── ORDENS DE SERVIÇO ──────────────────────────────────────────────────────
  {
    id: "os-01",
    category: "ordens-servico",
    title: "Como criar e gerenciar Ordens de Serviço?",
    keywords: ["ordem", "serviço", "os", "transporte", "veículo", "agendamento"],
    requiredRole: "operador",
    relatedScreen: "os",
    steps: [
      "1. Acesse a aba 'Ordens de Serviço' no painel Admin.",
      "2. Para criar uma OS, é necessário ter um agendamento pendente ou confirmado.",
      "3. Clique em 'Nova OS' e associe-a a um agendamento.",
      "4. Selecione o veículo/transporte responsável.",
      "5. Preencha data, horário e observações.",
      "6. Acompanhe o status: pendente → em andamento → concluída.",
    ],
    restrictions: [
      "Apenas operadores e logística podem criar e editar OS.",
      "Cada agendamento pode ter uma ou mais OS associadas.",
    ],
  },
  {
    id: "os-02",
    category: "ordens-servico",
    title: "Como funciona a OS de Transporte (ônibus DETRAN)?",
    keywords: ["ônibus", "transporte", "os empresa", "veículo"],
    requiredRole: "logistica",
    relatedScreen: "transporte",
    steps: [
      "1. Acesse a aba 'OS da empresa de ônibus' no painel Admin.",
      "2. A OS de transporte é criada automaticamente ao selecionar 'Ônibus do Detran' no agendamento.",
      "3. A equipe de logística acompanha e executa o transporte.",
      "4. O status da OS de transporte reflete o andamento do serviço.",
    ],
  },
  // ── ESTOQUE ────────────────────────────────────────────────────────────────
  {
    id: "est-01",
    category: "estoque",
    title: "Como funciona o controle de estoque?",
    keywords: ["estoque", "material", "inventário", "quantidade", "movimentação"],
    requiredRole: "operador",
    relatedScreen: "estoque",
    steps: [
      "1. Acesse a aba 'Estoque' no painel Admin.",
      "2. Visualize a lista de materiais com suas quantidades atuais.",
      "3. Para registrar uma movimentação, clique em 'Registrar' ao lado do item.",
      "4. Escolha o tipo: entrada (adição) ou saída (uso).",
      "5. Informe a quantidade e uma descrição da movimentação.",
      "6. O saldo é atualizado automaticamente após cada registro.",
    ],
    restrictions: [
      "Apenas operadores podem registrar movimentações.",
      "Não é possível ter saldo negativo.",
    ],
    errorResolution: [
      "Se o saldo ficar negativo: a movimentação foi rejeitada. Verifique a quantidade disponível.",
    ],
  },
  // ── RELATÓRIOS ──────────────────────────────────────────────────────────────
  {
    id: "rel-01",
    category: "relatorios",
    title: "Como gerar relatórios de agendamentos?",
    keywords: ["relatório", "agendamentos", "exportar", "filtro", "pdf", "excel"],
    requiredRole: "consulta",
    relatedScreen: "relatorios",
    steps: [
      "1. Acesse a aba 'Relatórios' no painel Admin.",
      "2. Selecione o período (data início e fim).",
      "3. Opcionalmente filtre por centro, instituição ou status.",
      "4. Clique em 'Gerar Relatório'.",
      "5. O relatório será exibido na tela e estará disponível para exportação.",
      "6. Use os botões de exportação para baixar em PDF ou CSV.",
    ],
    whatHappensNext: "O relatório reflete os dados do banco no momento da geração.",
  },
  // ── ACESSO ─────────────────────────────────────────────────────────────────
  {
    id: "acesso-01",
    category: "acesso",
    title: "Como solicitar acesso de colaborador (staff)?",
    keywords: ["colaborador", "staff", "operador", "logistica", "acesso", "solicitar"],
    requiredRole: "any",
    relatedScreen: "/perfil",
    steps: [
      "1. Acesse a página 'Meu Perfil'.",
      "2. Role até o cartão 'Acesso como Colaborador'.",
      "3. Escolha o perfil desejado: Operador, Logística ou Consulta/Gestão.",
      "4. Clique no botão do perfil escolhido para enviar a solicitação.",
      "5. Aguarde a análise da administração.",
      "6. Quando aprovado, você recebe acesso ao painel Admin e ao Modo Equipe.",
    ],
    whatHappensNext:
      "Após aprovação, você verá a aba 'Admin' no menu e poderá usar o Modo Equipe no agendamento.",
    restrictions: [
      "A solicitação fica como 'pendente' até ser analisada por um administrador.",
      "Apenas administradores podem aprovar ou recusar solicitações.",
    ],
    errorResolution: [
      "Se a solicitação não for enviada: verifique sua conexão e tente novamente.",
      "Se você já tem um perfil, não é necessário solicitar novamente.",
    ],
  },
  {
    id: "acesso-02",
    category: "acesso",
    title: "Como solicitar acesso a uma instituição existente?",
    keywords: ["instituição", "acesso", "vincular", "permissão", "solicitar"],
    requiredRole: "any",
    relatedScreen: "/perfil",
    steps: [
      "1. Acesse a página 'Meu Perfil'.",
      "2. Clique em 'Solicitar acesso existente'.",
      "3. Digite o nome da instituição que você trabalha.",
      "4. Selecione o resultado correspondente.",
      "5. Clique em 'Solicitar'.",
      "6. O proprietário da instituição receberá sua solicitação e poderá aprová-la.",
    ],
    whatHappensNext:
      "Quando aprovado, a instituição fica vinculada à sua conta e você pode fazer agendamentos em nome dela.",
  },
  // ── PERFIL ─────────────────────────────────────────────────────────────────
  {
    id: "perfil-01",
    category: "perfil",
    title: "Como atualizar meus dados pessoais?",
    keywords: ["perfil", "nome", "telefone", "responsável", "editar", "dados"],
    requiredRole: "any",
    relatedScreen: "/perfil",
    steps: [
      "1. Acesse a página 'Meu Perfil'.",
      "2. No cartão 'Responsável', edite seu nome completo e telefone/WhatsApp.",
      "3. Clique em 'Salvar dados do responsável'.",
      "4. O telefone informado é usado para contatar você sobre agendamentos.",
    ],
  },
  {
    id: "perfil-02",
    category: "perfil",
    title: "Como cadastrar ou editar os dados da instituição?",
    keywords: ["instituição", "editar", "dados", "escola", "endereço", "cadastro"],
    requiredRole: "any",
    relatedScreen: "/perfil",
    steps: [
      "1. Acesse a página 'Meu Perfil'.",
      "2. Na aba 'Dados da instituição', preencha ou atualize os campos.",
      "3. Clique em 'Salvar alterações'.",
      "4. Campos opcionais: bairro, endereço, telefone e e-mail.",
    ],
    restrictions: [
      "Se seu acesso for 'Visualizador', você não pode editar — solicite ao proprietário.",
    ],
  },
  // ── MENSAGENS ──────────────────────────────────────────────────────────────
  {
    id: "msg-01",
    category: "mensagens",
    title: "Como funciona o sistema de mensagens?",
    keywords: ["mensagem", "template", "modelo", "enviar", "comunicação", "whatsapp"],
    requiredRole: "operador",
    relatedScreen: "mensagens",
    steps: [
      "1. Acesse a aba 'Mensagens' no painel Admin.",
      "2. Crie modelos de mensagem (templates) que podem ser reutilizados.",
      "3. Use variáveis como {{nome}}, {{instituicao}} para personalização.",
      "4. Para enviar uma mensagem, associe um template a um agendamento ou instituição.",
      "5. O histórico de envios fica registrado na aba 'Log de Mensagens'.",
    ],
    restrictions: [
      "Apenas operadores e administradores podem criar e enviar mensagens.",
      "Mensagens são simuladas (log) — não são enviadas automaticamente.",
    ],
  },
  // ── GERAL ──────────────────────────────────────────────────────────────────
  {
    id: "geral-01",
    category: "geral",
    title: "O que é o DETRAN CE Connect?",
    keywords: ["detran", "connect", "sobre", "escola", "trânsito", "educação"],
    requiredRole: "any",
    steps: [
      "1. O DETRAN CE Connect é a plataforma online da Escola de Trânsito do Detran Ceará.",
      "2. Permite que instituições solicitem visitas educativas de forma simples.",
      "3. A equipe do Detran gerencia agendamentos, disponibilidade e visitas.",
      "4. Oferece também painel administrativo para a equipe do Detran.",
    ],
  },
  {
    id: "geral-02",
    category: "geral",
    title: "Quais são os perfis/permissões no sistema?",
    keywords: ["perfis", "permissões", "admin", "operador", "logistica", "consulta", "instituição"],
    requiredRole: "any",
    steps: [
      "Administrador: acesso total a todas as funcionalidades.",
      "Operador: pode gerenciar agendamentos, disponibilidade, OS, estoque, mensagens e relatórios.",
      "Logística: focado em OS de transporte e relatórios.",
      "Consulta/Gestão: pode visualizar relatórios e dados sem editar.",
      "Instituição: pode solicitar agendamentos para sua própria escola.",
    ],
  },
  {
    id: "geral-03",
    category: "geral",
    title: "Como entrar em contato com a equipe do Detran?",
    keywords: ["contato", "suporte", "ajuda", "whatsapp", "telefone", "equipe"],
    requiredRole: "any",
    steps: [
      "1. Use o botão do WhatsApp disponível no canto inferior direito do site.",
      "2. Ou entre em contato pelo telefone da Escola de Trânsito do Detran Ceará.",
    ],
    whatHappensNext: "A equipe responde em horário comercial.",
  },
];

// ── Search function ──────────────────────────────────────────────────────────
export function searchKnowledge(query: string, limit = 5): Article[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const scored = KNOWLEDGE_BASE.map((article) => {
    let score = 0;
    const titleLower = article.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const contentLower = article.steps.join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (titleLower.includes(q)) score += 10;
    if (titleLower.startsWith(q)) score += 5;
    for (const kw of article.keywords) {
      if (kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)) score += 3;
    }
    if (contentLower.includes(q)) score += 2;
    return { article, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.article);
}

// ── Context-aware articles ─────────────────────────────────────────────────────
export function getContextualArticles(
  route: string,
  role: "admin" | "operador" | "logistica" | "consulta" | "instituicao" | "any" = "any"
): Article[] {
  const routeMap: Record<string, ArticleCategory[]> = {
    "/agendar": ["agendamentos", "geral"],
    "/admin": ["geral"],
    "/admin/agendamentos": ["agendamentos"],
    "/admin/disponibilidade": ["disponibilidade"],
    "/admin/regras": ["disponibilidade"],
    "/admin/os": ["ordens-servico"],
    "/admin/transporte": ["ordens-servico"],
    "/admin/estoque": ["estoque"],
    "/admin/relatorios": ["relatorios"],
    "/admin/mensagens": ["mensagens"],
    "/admin/solicitacoes": ["acesso"],
    "/admin/usuarios": ["acesso"],
    "/perfil": ["perfil", "acesso"],
    "/minha-escola": ["agendamentos", "perfil"],
    "/ajuda": ["geral"],
  };

  const categories = routeMap[route] ?? ["geral"];

  return KNOWLEDGE_BASE.filter((a) => {
    if (!categories.includes(a.category)) return false;
    if (!a.requiredRole || a.requiredRole === "any" || role === "admin") return true;
    const roleHierarchy = ["consulta", "logistica", "operador", "admin"];
    const requiredIdx = roleHierarchy.indexOf(a.requiredRole);
    const userIdx = roleHierarchy.indexOf(role);
    return userIdx <= requiredIdx;
  });
}

// ── Build Lily response from article ─────────────────────────────────────────
export type LilyResponse = {
  text: string;
  article: Article;
  suggestedAction?: "navigate" | "tutorial" | "helpCenter";
  navigateTo?: string;
  tutorialId?: string;
};

export function buildLilyResponse(article: Article): LilyResponse {
  return {
    text: article.steps.join("\n"),
    article,
    suggestedAction: "helpCenter",
    navigateTo: "/ajuda",
  };
}
