import type { TutorialDefinition, TutorialStep } from "@/components/lily/TutorialOverlay";
import { isRoleAtLeast } from "./lily-knowledge";

export type Tutorial = {
  id: string;
  title: string;
  description: string;
  route?: string;
  requiredRole?: "admin" | "operador" | "logistica" | "consulta" | "any";
  steps: TutorialStep[];
};

export const TUTORIALS: Tutorial[] = [
  {
    id: "primeiro-agendamento",
    title: "Primeiro Agendamento",
    description: "Aprenda a solicitar uma visita educativa do zero.",
    route: "/agendar",
    requiredRole: "any",
    steps: [
      {
        target: "#institution-selector",
        title: "Selecione a instituição",
        content: "Comece selecionando a instituição que vai realizar a visita. Se ainda não tem uma, clique em 'Cadastrar nova instituição' logo abaixo.",
        action: "Selecione ou cadastre uma instituição.",
        position: "bottom",
      },
      {
        target: "#unidade-selector",
        title: "Escolha a unidade do DETRAN-CE",
        content: "Agora escolha a unidade do DETRAN-CE que receberá a visita. Cada unidade tem suas próprias regras de disponibilidade, capacidade e funcionamento. Esta escolha define quais horários e datas estarão disponíveis.",
        action: "Selecione a unidade desejada clicando em um dos cartões.",
        position: "bottom",
      },
      {
        target: "#data-selector",
        title: "Escolha a data",
        content: "Clique no campo de data para abrir o calendário. Apenas datas disponíveis são clicáveis — dias bloqueados, domingos ou fora do limite de antecedência ficam desabilitados.",
        action: "Escolha uma data disponível.",
        position: "top",
      },
      {
        target: "#turno-selector",
        title: "Selecione o turno",
        content: "Escolha entre Manhã (07h) ou Tarde (13h). A disponibilidade depende das regras da unidade selecionada.",
        action: "Selecione o turno desejado.",
        position: "bottom",
      },
      {
        target: "button[type='submit']",
        title: "Envie o formulário",
        content: "Depois de preencher todos os campos obrigatórios (faixa etária, quantidades, responsável, transporte), clique no botão final. Se você é da equipe Detran, o agendamento já é confirmado na hora!",
        action: "Revise os dados e clique para enviar.",
        position: "top",
      },
    ],
  },
  {
    id: "acompanhar-agendamentos",
    title: "Acompanhar Agendamentos",
    description: "Veja, filtre e acompanhe o status dos agendamentos.",
    route: "/admin",
    requiredRole: "operador",
    steps: [
      {
        // Radix TabsTrigger renders as <button role="tab"> with data-radix-tabs-trigger attr
        target: 'button[role="tab"][data-radix-tabs-trigger]',
        title: "Abra a aba Agendamentos",
        content: "Clique na aba 'Agendamentos' no painel administrativo. Lá você verá todos os agendamentos da sua equipe.",
        action: "Clique na aba Agendamentos.",
        position: "bottom",
      },
      {
        // Fixed: was [data-testid="filter-controls"] — use filter bar parent container
        target: "form:has(input[type='date']), div.flex.flex-wrap.gap-2",
        title: "Use os filtros",
        content: "Use os filtros de status, centro e data para encontrar agendamentos específicos. Agendamentos pendentes aparecem destacados em amarelo.",
        position: "bottom",
      },
      {
        target: "table", // fallback to table container
        title: "Veja o status",
        content: "Cada agendamento tem um status: Pendente (amarelo), Confirmado (verde), Cancelado (vermelho) ou Concluído (azul).",
        position: "right",
      },
    ],
  },
  {
    id: "disponibilidade-regras",
    title: "Gerenciar Disponibilidade e Regras",
    description: "Configure regras, horários e bloqueios de cada centro.",
    route: "/admin",
    requiredRole: "operador",
    steps: [
      {
        target: 'button[role="tab"][data-radix-tabs-trigger]',
        title: "Abra a aba Regras",
        content: "Clique na aba 'Regras' para configurar as regras de agendamento do centro selecionado.",
        action: "Clique na aba Regras.",
        position: "bottom",
      },
      {
        target: "[data-radix-tabs-trigger]", // any tab trigger for centro selector
        title: "Selecione o centro",
        content: "Escolha o centro: Fortaleza, Sobral ou Crato. Cada um tem suas próprias regras.",
        position: "right",
      },
      {
        target: "form",
        title: "Configure as regras",
        content: "Defina: capacidade máxima de visitantes, antecedência mínima e máxima, limite por instituição por período, horários de funcionamento e se o centro está ativo.",
        position: "right",
      },
      {
        target: "[data-radix-dialog-content], dialog", // Dialog component for bloqueio form
        title: "Gerencie bloqueios",
        content: "Adicione bloqueios de datas especiais (feriados, eventos, manutenção).Datas bloqueadas não aparecem no calendário de agendamento.",
        position: "top",
      },
    ],
  },
  {
    id: "ordens-servico",
    title: "Ordens de Serviço",
    description: "Crie e acompanhe ordens de serviço dos agendamentos.",
    route: "/admin",
    requiredRole: "operador",
    steps: [
      {
        target: 'button[role="tab"][data-radix-tabs-trigger]',
        title: "Abra a aba Ordens de Serviço",
        content: "Clique na aba 'Ordens de Serviço' para gerenciar as OS.",
        action: "Clique na aba Ordens de Serviço.",
        position: "bottom",
      },
      {
        // Fixed: was button:has-text() — use aria-label partial match
        target: "button[aria-label*='nova'], button[aria-label*='Nova'], button[aria-label*='ordem'], button[aria-label*='Ordem']",
        title: "Crie uma nova OS",
        content: "Clique em 'Nova OS'. Selecione o agendamento associado, o veículo/transporte e preencha os dados.",
        action: "Clique em Nova OS.",
        position: "bottom",
      },
      {
        target: "table",
        title: "Acompanhe o status",
        content: "Siga o ciclo: Pendente → Em Andamento → Concluída. Cada mudança de status é registrada no histórico.",
        position: "right",
      },
    ],
  },
  {
    id: "estoque",
    title: "Controle de Estoque",
    description: "Gerencie materiais, registre entradas e saídas.",
    route: "/admin",
    requiredRole: "operador",
    steps: [
      {
        target: 'button[role="tab"][data-radix-tabs-trigger]',
        title: "Abra a aba Estoque",
        content: "Clique na aba 'Estoque' para visualizar todos os materiais.",
        action: "Clique na aba Estoque.",
        position: "bottom",
      },
      {
        target: "[class*='grid']", // grid layout for item cards
        title: "Veja os itens",
        content: "Cada item mostra: nome, quantidade atual, última movimentação. Itens com saldo baixo aparecem destacados.",
        position: "right",
      },
      {
        target: "button[aria-label*='Registrar'], button[aria-label*='registrar']",
        title: "Registre uma movimentação",
        content: "Clique em 'Registrar' ao lado do item. Escolha: Entrada (adição) ou Saída (uso). Informe a quantidade e uma descrição. O saldo é atualizado automaticamente.",
        action: "Clique em Registrar em qualquer item.",
        position: "left",
      },
    ],
  },
  {
    id: "relatorios",
    title: "Gerar Relatórios",
    description: "Crie relatórios de agendamentos com filtros e exportação.",
    route: "/admin",
    requiredRole: "consulta",
    steps: [
      {
        target: 'button[role="tab"][data-radix-tabs-trigger]',
        title: "Abra a aba Relatórios",
        content: "Clique na aba 'Relatórios' para gerar análises.",
        action: "Clique na aba Relatórios.",
        position: "bottom",
      },
      {
        target: "input[type='date']",
        title: "Selecione o período",
        content: "Escolha a data de início e fim para o relatório. Quanto maior o período, mais dados serão incluídos.",
        position: "bottom",
      },
      {
        target: "button[type='submit']",
        title: "Gere o relatório",
        content: "Clique em 'Gerar Relatório'. Use os filtros adicionais de centro e status para refinar. Após gerar, use os botões de exportação.",
        position: "top",
      },
    ],
  },
  {
    id: "solicitar-acesso",
    title: "Solicitar Acesso de Colaborador",
    description: "Peça acesso como staff/equipe DETRAN pelo seu perfil.",
    route: "/perfil",
    requiredRole: "any",
    steps: [
      {
        target: "section, [class*='card']",
        title: "Cartão de Acesso Colaborador",
        content: "No perfil, localize o cartão 'Acesso como Colaborador'. Nele você pode solicitar um dos três perfis: Operador, Logística ou Consulta/Gestão.",
        action: "Role até o cartão e clique em um perfil.",
        position: "top",
      },
      {
        target: "button[aria-label*='Operador'], button[aria-label*='Logistica'], button[aria-label*='Consulta'], button[aria-label*='perfil']",
        title: "Escolha o perfil",
        content: "Clique no botão do perfil desejado. Sua solicitação será enviada para a administração analisar.",
        action: "Clique no perfil que melhor descreve sua função.",
        position: "bottom",
      },
    ],
  },
  {
    id: "gerenciar-usuarios",
    title: "Gerenciar Usuários",
    description: "Aprovar solicitações e configurar acessos.",
    route: "/admin",
    requiredRole: "admin",
    steps: [
      {
        target: 'button[role="tab"][data-radix-tabs-trigger]',
        title: "Aba Solicitações de Acesso",
        content: "Clique na aba 'Solicitações de Acesso' para ver os pedidos pendentes de colaboradores.",
        action: "Clique na aba Solicitações.",
        position: "bottom",
      },
      {
        target: "button[aria-label*='Aprovar'], button[aria-label*='aprovar'], button[aria-label*='Recusar']",
        title: "Aprovar ou recusar",
        content: "Veja os dados do solicitante. Clique em 'Aprovar' para dar acesso ou 'Recusar' se não for o caso. Aprovar envia automaticamente um papel para o solicitante.",
        action: "Clique em Aprovar ou Recusar.",
        position: "left",
      },
      {
        target: 'button[role="tab"][data-radix-tabs-trigger]',
        title: "Gerenciar usuários",
        content: "Na aba 'Usuários e config.', você pode ver todos os usuários, seus perfis e vincular/desvincular instituições.",
        action: "Clique na aba Usuários.",
        position: "bottom",
      },
    ],
  },
  {
    id: "mensagens",
    title: "Sistema de Mensagens",
    description: "Crie templates e envie mensagens para instituições.",
    route: "/admin",
    requiredRole: "operador",
    steps: [
      {
        target: 'button[role="tab"][data-radix-tabs-trigger]',
        title: "Abra a aba Mensagens",
        content: "Clique na aba 'Mensagens' para acessar o sistema de comunicação.",
        action: "Clique na aba Mensagens.",
        position: "bottom",
      },
      {
        target: "button[aria-label*='Novo'], button[aria-label*='Template'], button[aria-label*='template'], button[aria-label*='Modelo']",
        title: "Crie um template",
        content: "Clique em 'Novo Template'. Dê um nome e escreva o texto usando variáveis como {{nome}}, {{instituicao}} e {{data}}.",
        action: "Clique em Novo Template.",
        position: "bottom",
      },
      {
        target: "table",
        title: "Log de mensagens",
        content: "Acesse a aba 'Log de Mensagens' para ver o histórico de comunicações enviadas. Mensagens ficam registradas com data, destinatário e template usado.",
        position: "right",
      },
    ],
  },
];

export function getAllTutorials(
  role: "admin" | "operador" | "logistica" | "consulta" | "instituicao" | "any"
): Tutorial[] {
  return TUTORIALS.filter((t) => {
    if (!t.requiredRole) return true;
    return isRoleAtLeast(role, t.requiredRole);
  });
}

export function getTutorialById(id: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}
