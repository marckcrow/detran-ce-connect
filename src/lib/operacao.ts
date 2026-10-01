import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Cliente sem tipagem estrita para as tabelas operacionais
export const db = supabase as any;

export const PCD_TIPOS = [
  "Autista",
  "Cadeirante",
  "Deficiência visual",
  "Deficiência auditiva",
  "Deficiência intelectual",
  "Mobilidade reduzida",
  "Outros",
] as const;

export const OS_STATUS: Record<string, string> = {
  rascunho: "Rascunho",
  solicitado: "Agendamento solicitado",
  confirmado: "Confirmado",
  programado: "Programado",
  em_andamento: "Em andamento",
  realizado: "Realizado",
  cancelado: "Cancelado",
  nao_realizado: "Não realizado",
};

export const LOGISTICA_STATUS: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  excecao_autorizada: "Exceção autorizada",
  reprovado: "Reprovado",
};

export const FAIXA: Record<string, string> = {
  criancas: "Crianças",
  adolescentes: "Adolescentes",
  adultos: "Adultos",
  idosos: "Idosos",
};

export const REDE: Record<string, string> = { publica: "Pública", privada: "Privada", outra: "Outra" };
export const TURNO_HORA: Record<string, string> = { manha: "07h", tarde: "13h" };

export const osNumero = (os: { numero?: number | null; ano?: number }) =>
  `${String(os.numero ?? 0).padStart(3, "0")}/${os.ano}`;

export type Coluna = { key: string; label: string };

const linhas = (rows: any[], cols: Coluna[]) =>
  rows.map((r) => Object.fromEntries(cols.map((c) => [c.label, r[c.key] ?? ""])));

export function exportarXLSX(nome: string, rows: any[], cols: Coluna[]) {
  const ws = XLSX.utils.json_to_sheet(linhas(rows, cols));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `${nome}.xlsx`);
}

export function exportarCSV(nome: string, rows: any[], cols: Coluna[]) {
  const ws = XLSX.utils.json_to_sheet(linhas(rows, cols));
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${nome}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportarPDF(titulo: string, nome: string, rows: any[], cols: Coluna[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("GOVERNO DO ESTADO DO CEARÁ — DETRAN-CE — Escola Pública de Trânsito", 40, 30);
  doc.setFontSize(14);
  doc.setTextColor(14, 140, 58);
  doc.text(titulo, 40, 52);
  autoTable(doc, {
    startY: 64,
    head: [cols.map((c) => c.label)],
    body: rows.map((r) => cols.map((c) => String(r[c.key] ?? ""))),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [14, 140, 58] },
  });
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, h - 20);
  doc.save(`${nome}.pdf`);
}

export function mensagemWhatsApp(os: any) {
  const ag = os.agendamentos ?? {};
  const inst = ag.instituicoes ?? {};
  const data = ag.data ? ag.data.split("-").reverse().join("/") : "";
  const total = (ag.quantidade_alunos ?? 0) + (ag.quantidade_professores ?? 0) + (ag.quantidade_acompanhantes ?? 0);
  return [
    `Olá${ag.responsavel_nome ? `, ${ag.responsavel_nome}` : ""}! Aqui é a Escola Pública de Trânsito do DETRAN-CE.`,
    ``,
    `Sua visita está *confirmada*:`,
    `• Escola: ${inst.nome ?? ""}`,
    `• Data: ${data}`,
    `• Horário: ${ag.horario || TURNO_HORA[ag.turno] || ""}`,
    `• Visitantes previstos: ${total}`,
    `• OS nº ${osNumero(os)}`,
    ag.transporte_status === "onibus_detran" ? `• Transporte: ônibus do DETRAN (esteja pronto 15 min antes)` : `• Transporte: próprio`,
    ``,
    `Orientações: levar a lista de alunos, usar roupas confortáveis e informar com antecedência qualquer necessidade de acessibilidade.`,
    ``,
    `Por favor, responda esta mensagem confirmando o agendamento.`,
  ].join("\n");
}

export const soDigitos = (s?: string | null) => (s ?? "").replace(/\D/g, "");
export const waLink = (tel: string, msg: string) => {
  let d = soDigitos(tel);
  if (d && !d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`;
};

export const TIPO_PUBLICO: Record<string, string> = {
  escola: "Escola",
  universidade: "Universidade",
  empresa: "Empresa",
  ong: "ONG",
  igreja: "Igreja",
  orgao_publico: "Órgão público",
  outros: "Outros",
};
