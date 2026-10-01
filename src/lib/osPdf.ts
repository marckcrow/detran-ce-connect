import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export type RotaOS = {
  data: string; // ISO date
  turno: "manha" | "tarde";
  escola: string;
  endereco: string;
  bairro?: string | null;
  cidade?: string | null;
  responsavel?: string | null;
  telefone?: string | null;
  alunos: number;
  professores: number;
};

export type DadosOS = {
  numero: string;
  ano: number;
  mesExtenso: string;
  unidade: string;
  dataInicio: Date;
  dataFim: Date;
  rotas: RotaOS[];
  empresa?: string;
  empresaEndereco?: string;
  empresaCnpj?: string;
  empresaFone?: string;
  contrato?: string;
};

const VERDE: [number, number, number] = [0, 104, 55]; // DETRAN green #006837
const VERDE_CLARO: [number, number, number] = [0, 140, 75];
const CINZA: [number, number, number] = [90, 90, 90];

const HORARIO: Record<string, string> = { manha: "07h", tarde: "13h" };

export function gerarOSPdf(d: DadosOS) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;

  const empresa = d.empresa ?? import.meta.env.VITE_OS_EMPRESA ?? "JR SERVIÇOS DE TRANSPORTES EIRELI";
  const empresaEndereco = d.empresaEndereco ?? import.meta.env.VITE_OS_ENDERECO ?? "Rua Padre Macedo, 542, Centro, Crateús/CE";
  const empresaCnpj = d.empresaCnpj ?? import.meta.env.VITE_OS_CNPJ ?? "08.269.988/0001-09";
  const empresaFone = d.empresaFone ?? import.meta.env.VITE_OS_FONE ?? "(88) 3692-3636";
  const contrato = d.contrato ?? import.meta.env.VITE_OS_CONTRATO ?? "178/2025";

  const cabecalho = () => {
    // Barra verde superior
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, W, 6, "F");

    // Logo DETRAN-CE (texto estilizado à esquerda)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...VERDE);
    doc.text("DETRAN-CE", M, 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CINZA);
    doc.text("GOVERNO DO ESTADO DO CEARÁ", M, 40);
    doc.text("Diretoria de Educação para o Trânsito – DIET/NUPET", M, 52);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Escola de Trânsito", M, 63);

    // OS number à direita
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...VERDE);
    doc.text(`O.S. N° ${d.numero}/${d.ano}`, W - M, 36, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CINZA);
    doc.text(d.unidade.toUpperCase(), W - M, 50, { align: "right" });

    // Linha separadora verde
    doc.setDrawColor(...VERDE);
    doc.setLineWidth(1);
    doc.line(M, 72, W - M, 72);
  };

  const rodape = () => {
    const y = H - 72;
    // Linha separadora
    doc.setDrawColor(...VERDE);
    doc.setLineWidth(0.8);
    doc.line(M, y, W - M, y);

    // Footer esquerdo - identidade DETRAN
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...VERDE);
    doc.text("Escola de Trânsito / Detran Ceará", M, y + 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text("Unidade: Centro Integrativo de Fortaleza", M, y + 25);
    doc.text("Contato: (85) 98135-9276 (WhatsApp) / (85) 3106-4711 (Fixo)", M, y + 36);
    doc.text("E-mail: escoladetransito@detran.ce.gov.br", M, y + 47);

    // Número da página à direita
    const page = doc.getNumberOfPages();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text(`Página ${doc.getCurrentPageInfo().pageNumber} de ${page}`, W - M, y + 47, { align: "right" });

    // Barra verde inferior
    doc.setFillColor(...VERDE);
    doc.rect(0, H - 6, W, 6, "F");
  };

  // ---------- Página 1: texto de abertura ----------
  cabecalho();
  let y = 100;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(`ORDEM DE SERVIÇO N° ${d.numero}/${d.ano} – ${d.mesExtenso.toUpperCase()}`, W / 2, y, {
    align: "center",
  });
  y += 18;
  doc.setFontSize(11);
  doc.setTextColor(...VERDE);
  doc.text(d.unidade.toUpperCase(), W / 2, y, { align: "center" });
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  const linhas = [
    `Do Núcleo Pedagógico de Educação para o Trânsito – NUPET/DETRAN/CE`,
    `À Empresa ${empresa}`,
    `End.: ${empresaEndereco} • Fone: ${empresaFone}`,
  ];
  linhas.forEach((l) => {
    doc.text(l, M, y);
    y += 13;
  });
  y += 8;
  doc.text(
    `Fortaleza, ${format(d.dataInicio, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
    W - M,
    y,
    { align: "right" }
  );
  y += 22;

  const corpo =
    `Solicitamos a ${empresa}, com sede na ${empresaEndereco}, inscrita no CNPJ/MF sob o N° ${empresaCnpj}, ` +
    `Tel: ${empresaFone}, disponibilizar ônibus executivo rodoviário, de acordo com o Contrato ${contrato}, para prestação ` +
    `de serviços de transporte de alunos e professores para as atividades das escolas de trânsito de Fortaleza, ` +
    `Juazeiro do Norte e Sobral, referente ao período de ` +
    `${format(d.dataInicio, "dd/MM/yyyy")} a ${format(d.dataFim, "dd/MM/yyyy")}.`;
  const wrapped = doc.splitTextToSize(corpo, W - M * 2);
  doc.text(wrapped, M, y, { align: "justify", maxWidth: W - M * 2 });
  y += wrapped.length * 12 + 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...VERDE);
  doc.text(`ESCOLA DE TRÂNSITO – UNIDADE ${d.unidade.toUpperCase()}`, M, y);
  y += 10;

  const body = d.rotas.map((r) => [
    format(parseISO(r.data), "dd/MM"),
    HORARIO[r.turno] ?? "—",
    r.escola,
    [
      [r.endereco, r.bairro, r.cidade].filter(Boolean).join(", "),
      [r.responsavel, r.telefone].filter(Boolean).join(": "),
    ]
      .filter(Boolean)
      .join("\n"),
    String(r.alunos + r.professores),
  ]);

  autoTable(doc, {
    startY: y + 6,
    head: [["DATA", "HORÁRIO", "ROTEIRO", "LOCAL / CONTATO", "PAX"]],
    body: body.length ? body : [["—", "—", "Nenhuma visita confirmada no período", "—", "—"]],
    theme: "grid",
    margin: { left: M, right: M, top: 90, bottom: 80 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: [30, 30, 30], lineColor: [215, 215, 215] },
    headStyles: { fillColor: VERDE, textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [244, 249, 245] },
    columnStyles: {
      0: { cellWidth: 46, halign: "center" },
      1: { cellWidth: 48, halign: "center" },
      2: { cellWidth: 138, fontStyle: "bold" },
      3: { cellWidth: "auto" },
      4: { cellWidth: 34, halign: "center" },
    },
    didDrawPage: () => {
      if (doc.getCurrentPageInfo().pageNumber > 1) cabecalho();
    },
  });

  // Totais
  let ty = (doc as any).lastAutoTable.finalY + 16;
  const totalPax = d.rotas.reduce((s, r) => s + r.alunos + r.professores, 0);
  if (ty > H - 150) {
    doc.addPage();
    cabecalho();
    ty = 100;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text(`TOTAL DO SERVIÇO PRESTADO: ${d.rotas.length} rota(s) • ${totalPax} passageiro(s)`, M, ty);

  // Assinaturas
  let sy = ty + 60;
  if (sy > H - 140) {
    doc.addPage();
    cabecalho();
    sy = 140;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Atenciosamente,", M, sy - 24);

  const colW = (W - M * 2) / 2;
  const assinaturas = [
    ["Milena Maciel Martins", "Núcleo de Apoio Logístico – NUAP", "Gestor do Contrato"],
    ["Jorge Vasconcelos Trindade", "Diretoria de Educação de Trânsito – DIET", "Fiscal do Contrato"],
  ];
  assinaturas.forEach((a, i) => {
    const cx = M + colW * i + colW / 2;
    doc.setDrawColor(120, 120, 120);
    doc.line(cx - 90, sy, cx + 90, sy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(a[0], cx, sy + 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(a[1], cx, sy + 26, { align: "center" });
    doc.text(a[2], cx, sy + 37, { align: "center" });
  });

  // Rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    rodape();
  }

  doc.save(
    `OS_${d.numero}_${d.ano}_${d.unidade.replace(/\s+/g, "-")}_${format(d.dataInicio, "ddMM")}-${format(
      d.dataFim,
      "ddMM"
    )}.pdf`
  );
}
