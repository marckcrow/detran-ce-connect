import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type AlunoPresenca = {
  nome: string;
  idade?: string | number;
  turma?: string;
};

export type DadosListaPresenca = {
  osNumero: string;
  ano: number;
  data: string; // ISO date string or display string
  turno: "manha" | "tarde";
  escola: string;
  endereco: string;
  cidade?: string;
  alunosPrevistos: number;
  professorResponsavel?: string;
  alunos?: AlunoPresenca[];
};

const VERDE: [number, number, number] = [0, 104, 55];
const VERDE_HEADER: [number, number, number] = [0, 140, 75];
const CINZA: [number, number, number] = [90, 90, 90];
const PRETO: [number, number, number] = [20, 20, 20];

const TURNO_LABEL: Record<string, string> = { manha: "Manhã (07h)", tarde: "Tarde (13h)" };

export function gerarListaPresencaPdf(d: DadosListaPresenca) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const H = doc.internal.pageSize.getHeight();

  const dadosAlunos: AlunoPresenca[] = d.alunos ?? [];

  // ---- Cabecalho em cada pagina ----
  const cabecalho = () => {
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, W, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...VERDE);
    doc.text("DETRAN-CE", M, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CINZA);
    doc.text("GOVERNO DO ESTADO DO CEARÁ", M, 40);
    doc.text("Diretoria de Educação para o Trânsito – DIET/NUPET", M, 52);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...VERDE);
    doc.text("LISTA DE PRESENÇA", W - M, 28, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CINZA);
    doc.text(`OS ${d.osNumero}/${d.ano}`, W - M, 42, { align: "right" });

    doc.setDrawColor(...VERDE);
    doc.setLineWidth(1);
    doc.line(M, 60, W - M, 60);
  };

  // ---- Rodape em cada pagina ----
  const rodape = (pageNum: number, totalPages: number) => {
    const y = H - 72;
    doc.setDrawColor(...VERDE);
    doc.setLineWidth(0.8);
    doc.line(M, y, W - M, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...VERDE);
    doc.text("Escola de Trânsito / Detran Ceará", M, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...CINZA);
    doc.text("Contato: (85) 98135-9276 (WhatsApp) / (85) 3106-4711", M, y + 25);
    doc.text("E-mail: escoladetransito@detran.ce.gov.br", M, y + 36);
    doc.text(
      `Página ${pageNum} de ${totalPages}`,
      W - M, y + 47, { align: "right" }
    );

    doc.setFillColor(...VERDE);
    doc.rect(0, H - 6, W, 6, "F");
  };

  // ---- Pagina 1 ----
  cabecalho();
  let y = 80;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...VERDE);
  doc.text("LISTA DE PRESENÇA", W / 2, y, { align: "center" });
  y += 20;

  // Info box
  const infoData = [
    ["Escola:", d.escola],
    ["Endereço:", [d.endereco, d.cidade].filter(Boolean).join(" – ")],
    ["Data:", d.data],
    ["Turno:", TURNO_LABEL[d.turno] ?? d.turno],
    ["Participantes previstos:", String(d.alunosPrevistos)],
  ];

  doc.setFillColor(244, 249, 245);
  const infoBoxY = y;
  const infoBoxH = infoData.length * 16 + 16;
  doc.roundedRect(M, infoBoxY, W - M * 2, infoBoxH, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...VERDE);
  doc.text("INFORMAÇÕES DA VISITA", M + 12, infoBoxY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PRETO);
  infoData.forEach(([label, valor], i) => {
    const ry = infoBoxY + 28 + i * 16;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...CINZA);
    doc.text(label, M + 12, ry);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PRETO);
    doc.text(valor, M + 100, ry);
  });

  y = infoBoxY + infoBoxH + 16;

  // ---- Tabela de alunos ----
  const totalRows = Math.max(d.alunosPrevistos, 20);
  const rows: Array<[string, string, string, string]> = [];

  for (let i = 0; i < totalRows; i++) {
    const a = dadosAlunos[i];
    rows.push([
      String(i + 1),
      a?.nome ?? "",
      a?.idade != null ? String(a.idade) : "",
      a?.turma ?? "",
      "",
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Nº", "Nome do Aluno", "Idade", "Turma / Série", "Presente / Ausente"]],
    body: rows,
    theme: "grid",
    margin: { left: M, right: M, top: 90, bottom: 100 },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: PRETO,
      lineColor: [215, 215, 215],
    },
    headStyles: {
      fillColor: VERDE_HEADER,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [244, 249, 245] },
    columnStyles: {
      0: { cellWidth: 24, halign: "center", fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 44, halign: "center" },
      3: { cellWidth: 80, halign: "center" },
      4: { cellWidth: 80, halign: "center" },
    },
    didDrawPage: ({ pageNumber, pageCount }) => {
      if (pageNumber > 1) cabecalho();
      rodape(pageNumber, pageCount);
    },
  });

  // ---- Totais e assinatura ----
  let finalY = (doc as any).lastAutoTable.finalY + 20;
  if (finalY > H - 120) {
    doc.addPage();
    cabecalho();
    finalY = 80;
  }

  // Total de presentes
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(PRETO);
  doc.text("Total de presentes: __________ / " + String(d.alunosPrevistos), M, finalY);
  finalY += 20;

  // Professor responsavel
  doc.text(
    `Professor responsável: ${d.professorResponsavel ?? "________________________________"}`,
    M, finalY
  );
  finalY += 20;

  // Data
  doc.text("Data: ___/___/_________", M, finalY);
  finalY += 24;

  // Nota LGPD
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...CINZA);
  doc.text(
    "Documento para uso interno da atividade educativa. Não armazenar dados pessoais além do necessário.",
    M, finalY
  );

  // Nota LGPD na primeira pagina tb
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (p === 1) {
      const lgpdY = H - 20;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...CINZA);
      doc.text(
        "Documento para uso interno da atividade educativa. Não armazenar dados pessoais além do necessário.",
        W / 2, lgpdY, { align: "center" }
      );
    }
  }

  const dataFormatada = d.data.replace(/\//g, "-");
  doc.save(
    `ListaPresenca_OS${d.osNumero}_${d.ano}_${dataFormatada}_${d.turno}.pdf`
  );
}
