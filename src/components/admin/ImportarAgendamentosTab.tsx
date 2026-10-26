"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Upload, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { db } from "@/lib/operacao";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Unidade {
  id: string;
  nome: string;
  sigla: string;
  cidade: string;
  macrorregiao: string;
}

interface FileColumn {
  key: string;
  label: string;
}

interface ColumnMapping {
  [fieldKey: string]: string; // fieldKey → column key (empty string = "Ignorar")
}

interface PreviewRow {
  linha: number;
  id_externo: string;
  instituicao_nome: string;
  data: string;
  horario: string;
  turno: string;
  quantidade_alunos: number;
  quantidade_professores: number;
  quantidade_acompanhantes: number;
  faixa_etaria: string;
  transporte: string;
  status: string;
  responsavel: string;
  responsavel_whatsapp: string;
  email: string;
  telefone: string;
  cidade: string;
  observacoes: string;
  excluded: boolean;
  result: "valid" | "duplicate" | "error";
  errorMsg: string;
}

interface ImportResult {
  success: boolean;
  import_id: string;
  total: number;
  importadas: number;
  duplicadas: number;
  com_erro: number;
  erros: Array<{
    linha: number;
    erro: string;
    detalhe: { id_externo: string; instituicao: string; data: string };
  }>;
  error?: string;
  code?: string;
}

// ─── Field definitions ────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  default?: string;
}

const FIELD_DEFS: FieldDef[] = [
  { key: "id_externo", label: "ID Externo", required: false },
  { key: "instituicao_nome", label: "Nome da Instituição *", required: true },
  { key: "responsavel", label: "Responsável", required: false },
  { key: "responsavel_whatsapp", label: "WhatsApp Responsável", required: false },
  { key: "email", label: "E-mail", required: false },
  { key: "telefone", label: "Telefone", required: false },
  { key: "cidade", label: "Cidade", required: false },
  { key: "data", label: "Data da Visita *", required: true },
  { key: "horario", label: "Horário", required: false },
  { key: "turno", label: "Turno *", required: true },
  { key: "quantidade_alunos", label: "Qtd. Alunos *", required: true },
  { key: "quantidade_professores", label: "Qtd. Professores", required: false, default: "0" },
  { key: "quantidade_acompanhantes", label: "Qtd. Acompanhantes", required: false, default: "0" },
  { key: "faixa_etaria", label: "Faixa Etária", required: false, default: "criancas" },
  { key: "transporte", label: "Transporte", required: false, default: "onibus_detran" },
  { key: "status", label: "Status", required: false, default: "pendente" },
  { key: "observacoes", label: "Observações", required: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadTemplate() {
  const headers = [
    "id_externo", "instituicao_nome", "responsavel", "responsavel_whatsapp",
    "email", "telefone", "cidade", "data", "horario", "turno",
    "quantidade_alunos", "quantidade_professores", "quantidade_acompanhantes",
    "faixa_etaria", "transporte", "status", "observacoes",
  ];
  const sample = [
    "EXT001", "Colégio São José", "João Silva", "85999999999",
    "joao@escola.com", "8530000000", "Fortaleza", "15/03/2026", "08:00", "manha",
    "30", "2", "1", "criancas", "onibus_detran", "confirmado", "Visita programada",
  ];
  const csv = [headers.join(","), sample.join(",")].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo_importacao_agendamentos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseDate(raw: string): Date | null {
  if (!raw || String(raw).trim() === "") return null;
  const s = String(raw).trim();

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dm) {
    const d = new Date(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // Try YYYY-MM-DD
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // Try MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) {
    const d = new Date(Number(mdy[3]), Number(mdy[1]) - 1, Number(mdy[2]));
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback: try native Date parse
  const fallback = new Date(s);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateBR(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${m}/${d.getFullYear()}`;
}

function parseTurno(raw: string): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "m" || s === "manhã" || s === "manha" || s === "morning" || s === "am") return "manha";
  if (s === "t" || s === "tarde" || s === "tarde" || s === "afternoon" || s === "pm") return "tarde";
  return null;
}

function parseIntOr(str: unknown, fallback: number): number {
  const n = parseInt(String(str ?? "").replace(/\D/g, ""), 10);
  return isNaN(n) ? fallback : n;
}

function toNullable(str: unknown): string | null {
  const s = String(str ?? "").trim();
  return s === "" ? null : s;
}

function parseWorkbook(file: File): { columns: FileColumn[]; rows: Record<string, string>[] } {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: false, cellNF: false });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const raw: Record<string, string | number | null>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (raw.length === 0) {
          reject(new Error("Planilha vazia"));
          return;
        }

        const headers = Object.keys(raw[0]);
        const columns: FileColumn[] = headers.map((h) => ({
          key: h,
          label: String(h),
        }));

        // Normalize rows: flatten all values to strings
        const rows = raw.map((r) => {
          const normalized: Record<string, string> = {};
          headers.forEach((h) => {
            const val = r[h];
            normalized[h] = val == null ? "" : String(val).trim();
          });
          return normalized;
        });

        resolve({ columns, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  }) as unknown as { columns: FileColumn[]; rows: Record<string, string>[] };
}

function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  defaultValues: Record<string, string>
): Record<string, string>[] {
  return rows.map((raw) => {
    const mapped: Record<string, string> = {};
    FIELD_DEFS.forEach((fd) => {
      const colKey = mapping[fd.key];
      if (colKey && colKey !== "") {
        const rawVal = raw[colKey];
        mapped[fd.key] = rawVal ?? "";
      } else {
        mapped[fd.key] = defaultValues[fd.key] ?? "";
      }
    });
    return mapped;
  });
}

function validateRow(mapped: Record<string, string>, linha: number): { result: PreviewRow["result"]; errorMsg: string } {
  const nome = toNullable(mapped["instituicao_nome"]);
  if (!nome) return { result: "error", errorMsg: `Linha ${linha}: Nome da instituição é obrigatório` };

  const dataRaw = mapped["data"];
  const parsedDate = parseDate(dataRaw);
  if (!parsedDate) return { result: "error", errorMsg: `Linha ${linha}: Data inválida ou vazia ("${dataRaw}")` };

  const turnoRaw = mapped["turno"];
  const parsedTurno = parseTurno(turnoRaw);
  if (!parsedTurno) return { result: "error", errorMsg: `Linha ${linha}: Turno inválido ("${turnoRaw}"). Usar: manha ou tarde` };

  const alunosRaw = mapped["quantidade_alunos"];
  const alunos = parseInt(alunosRaw, 10);
  if (isNaN(alunos) || alunos <= 0) return { result: "error", errorMsg: `Linha ${linha}: Qtd. alunos deve ser > 0 ("${alunosRaw}")` };

  return { result: "valid", errorMsg: "" };
}

function buildPreviewRow(
  mapped: Record<string, string>,
  linha: number,
  result: PreviewRow["result"],
  errorMsg: string
): PreviewRow {
  return {
    linha,
    id_externo: toNullable(mapped["id_externo"]) ?? "",
    instituicao_nome: toNullable(mapped["instituicao_nome"]) ?? "",
    data: formatDateBR(parseDate(mapped["data"]) ?? new Date()),
    horario: toNullable(mapped["horario"]) ?? "",
    turno: parseTurno(mapped["turno"]) ?? toNullable(mapped["turno"]) ?? "",
    quantidade_alunos: parseIntOr(mapped["quantidade_alunos"], 0),
    quantidade_professores: parseIntOr(mapped["quantidade_professores"], 0),
    quantidade_acompanhantes: parseIntOr(mapped["quantidade_acompanhantes"], 0),
    faixa_etaria: toNullable(mapped["faixa_etaria"]) ?? "criancas",
    transporte: toNullable(mapped["transporte"]) ?? "onibus_detran",
    status: toNullable(mapped["status"]) ?? "pendente",
    responsavel: toNullable(mapped["responsavel"]) ?? "",
    responsavel_whatsapp: toNullable(mapped["responsavel_whatsapp"]) ?? "",
    email: toNullable(mapped["email"]) ?? "",
    telefone: toNullable(mapped["telefone"]) ?? "",
    cidade: toNullable(mapped["cidade"]) ?? "",
    observacoes: toNullable(mapped["observacoes"]) ?? "",
    excluded: false,
    result,
    errorMsg,
  };
}

function downloadErrorReport(
  errors: Array<{
    linha: number;
    erro: string;
    detalhe: { id_externo: string; instituicao: string; data: string };
  }>
) {
  const headers = ["linha", "erro", "id_externo", "instituicao_nome", "data", "turno"];
  const rows = errors.map((e) => [
    String(e.linha),
    `"${(e.erro ?? "").replace(/"/g, '""')}"`,
    `"${(e.detalhe?.id_externo ?? "").replace(/"/g, '""')}"`,
    `"${(e.detalhe?.instituicao ?? "").replace(/"/g, '""')}"`,
    `"${(e.detalhe?.data ?? "").replace(/"/g, '""')}"`,
    "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_erros_importacao_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ImportarAgendamentosTabProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type ImportStep = 1 | 2 | 3 | 4;

export function ImportarAgendamentosTab({ open, onClose, onImported }: ImportarAgendamentosTabProps) {
  const [step, setStep] = useState<ImportStep>(1);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [fileColumns, setFileColumns] = useState<FileColumn[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Load unidades ─────────────────────────────────────────────────────────
  const loadUnidades = useCallback(async () => {
    setLoadingUnidades(true);
    try {
      const { data, error: err } = await db.rpc("rpc_unidades_list");
      if (err) throw err;
      setUnidades((data as Unidade[]) ?? []);
    } catch {
      setUnidades([]);
    } finally {
      setLoadingUnidades(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadUnidades();
      resetState();
    }
  }, [open, loadUnidades]);

  function resetState() {
    setStep(1);
    setSelectedUnidadeId("");
    setFile(null);
    setFileColumns([]);
    setRawRows([]);
    setMapping({});
    setPreviewRows([]);
    setImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setImportResult(null);
    setShowErrors(false);
    setError("");
  }

  // ─── Step 1: File selected ────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");
    parseFile(f);
  }

  async function parseFile(f: File) {
    try {
      const { columns, rows } = await parseWorkbook(f) as { columns: FileColumn[]; rows: Record<string, string>[] };
      setFileColumns(columns);
      setRawRows(rows);

      // Auto-map by header name similarity
      const autoMapping: ColumnMapping = {};
      FIELD_DEFS.forEach((fd) => {
        const normalizedLabel = fd.label.replace(/[*\s]/g, "").toLowerCase();
        const matched = columns.find((c) => {
          const cNorm = c.label.replace(/[*\s]/g, "").toLowerCase();
          return cNorm === normalizedLabel || c.key.toLowerCase() === fd.key.toLowerCase();
        });
        autoMapping[fd.key] = matched?.key ?? "";
      });
      setMapping(autoMapping);
    } catch (err) {
      setError(`Erro ao processar arquivo: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleProceedToStep2() {
    if (!selectedUnidadeId) {
      setError("Selecione a unidade para continuar.");
      return;
    }
    if (!file) {
      setError("Selecione um arquivo para continuar.");
      return;
    }
    if (fileColumns.length === 0) {
      setError("Nenhuma coluna detectada no arquivo.");
      return;
    }
    setError("");
    setStep(2);
  }

  // ─── Step 2: Column mapping → Step 3 preview ─────────────────────────────
  function handleMappingChange(fieldKey: string, colKey: string) {
    setMapping((prev) => ({ ...prev, [fieldKey]: colKey }));
  }

  function handleProceedToStep3() {
    // Validate required fields are mapped
    const requiredMissing = FIELD_DEFS
      .filter((fd) => fd.required && !mapping[fd.key])
      .map((fd) => fd.label);
    if (requiredMissing.length > 0) {
      setError(`Campos obrigatórios não mapeados: ${requiredMissing.join(", ")}`);
      return;
    }

    setError("");
    setLoadingPreview(true);
    setStep(3);

    // Build mapped rows and validate
    const defaultValues: Record<string, string> = {};
    FIELD_DEFS.forEach((fd) => { defaultValues[fd.key] = fd.default ?? ""; });

    const mappedRows = applyMapping(rawRows, mapping, defaultValues);

    // Check duplicates against DB (institution name + data + turno)
    checkDuplicatesAndPreview(mappedRows);
  }

  async function checkDuplicatesAndPreview(mappedRows: Record<string, string>[]) {
    const previews: PreviewRow[] = [];
    const errors_out: { linha: number; erro: string }[] = [];

    // Batch lookup: get all institution names from the mapped rows
    const instituicaoNomes = mappedRows
      .map((r) => toNullable(r["instituicao_nome"]))
      .filter(Boolean) as string[];

    // Lookup institution IDs
    const instNameToId: Record<string, string> = {};
    if (instituicaoNomes.length > 0) {
      const uniqueNomes = [...new Set(instituicaoNomes)];
      const { data: insts } = await db
        .from("instituicoes")
        .select("id, nome")
        .or(`nome.ilike.%${uniqueNomes.join(",nome.ilike.%")}%`);

      if (insts) {
        insts.forEach((i: { id: string; nome: string }) => {
          instNameToId[i.nome.toLowerCase()] = i.id;
        });
      }
    }

    // For each row, validate and check duplicate
    for (let i = 0; i < mappedRows.length; i++) {
      const mapped = mappedRows[i];
      const linha = i + 2; // row number (1-indexed, header is row 1)

      const { result, errorMsg } = validateRow(mapped, linha);

      if (result === "error") {
        previews.push(buildPreviewRow(mapped, linha, "error", errorMsg));
        continue;
      }

      const instNome = toNullable(mapped["instituicao_nome"]) ?? "";
      const instId = instNameToId[instNome.toLowerCase()];
      const parsedDate = parseDate(mapped["data"]);
      const parsedTurno = parseTurno(mapped["turno"]);
      const dateISO = parsedDate ? formatDateISO(parsedDate) : "";

      if (!instId || !parsedDate || !parsedTurno) {
        previews.push(buildPreviewRow(mapped, linha, "error", `Linha ${linha}: dados insuficientes para verificar duplicata`));
        continue;
      }

      // Check if already exists in DB
      const { data: existing } = await db
        .from("agendamentos")
        .select("id")
        .eq("instituicao_id", instId)
        .eq("data", dateISO)
        .eq("turno", parsedTurno)
        .limit(1);

      if (existing && existing.length > 0) {
        previews.push(buildPreviewRow(mapped, linha, "duplicate", `Já existe agendamento para esta instituição nesta data/turno`));
      } else {
        previews.push(buildPreviewRow(mapped, linha, "valid", ""));
      }
    }

    setPreviewRows(previews);
    setLoadingPreview(false);
  }

  function toggleExcludeRow(idx: number) {
    setPreviewRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, excluded: !r.excluded } : r))
    );
  }

  function toggleExcludeErrors() {
    setPreviewRows((prev) =>
      prev.map((r) => (r.result === "error" ? { ...r, excluded: true } : r))
    );
  }

  // ─── Step 4: Import ───────────────────────────────────────────────────────
  const selectedUnidade = unidades.find((u) => u.id === selectedUnidadeId);

  async function handleImport() {
    const toImport = previewRows.filter((r) => !r.excluded && r.result === "valid");
    if (toImport.length === 0) {
      setError("Nenhum registro válido para importar.");
      return;
    }

    setError("");
    setImporting(true);
    setImportProgress({ current: 0, total: toImport.length });

    // Build the p_linhas array for the RPC
    const defaultValues: Record<string, string> = {};
    FIELD_DEFS.forEach((fd) => { defaultValues[fd.key] = fd.default ?? ""; });
    const mappedRows = applyMapping(rawRows, mapping, defaultValues);

    // Filter to only valid non-excluded rows, preserving order
    const validMappedRows = previewRows
      .filter((r) => !r.excluded && r.result === "valid")
      .map((r) => mappedRows[r.linha - 2]);

    // For each row, normalize dates to ISO and turns to lowercase
    const normalizedRows = validMappedRows.map((r) => {
      const parsedDate = parseDate(r["data"]);
      return {
        ...r,
        data: parsedDate ? formatDateISO(parsedDate) : r["data"],
        turno: parseTurno(r["turno"]) ?? r["turno"],
        quantidade_alunos: parseIntOr(r["quantidade_alunos"], 1),
        quantidade_professores: parseIntOr(r["quantidade_professores"], 0),
        quantidade_acompanhantes: parseIntOr(r["quantidade_acompanhantes"], 0),
      };
    });

    try {
      const { data, error: rpcError } = await db.rpc("rpc_importar_agendamentos", {
        p_linhas: normalizedRows,
        p_unidade_id: selectedUnidadeId,
        p_sistema_origem: `Importação Planilha ${new Date().getFullYear()}`,
        p_arquivo_nome: file?.name ?? "desconhecido.csv",
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      const result = data as ImportResult;
      setImportResult(result);
      setImportProgress({ current: toImport.length, total: toImport.length });
    } catch (err) {
      setError(`Erro na importação: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    if (importResult?.success) {
      toast({ title: "Importação concluída!", description: `${importResult.importadas} registro(s) importado(s) com sucesso.` });
      onImported?.();
    }
    resetState();
    onClose();
  }

  // ─── Summary counts ───────────────────────────────────────────────────────
  const validCount = previewRows.filter((r) => !r.excluded && r.result === "valid").length;
  const duplicateCount = previewRows.filter((r) => !r.excluded && r.result === "duplicate").length;
  const errorCount = previewRows.filter((r) => !r.excluded && r.result === "error").length;
  const excludedCount = previewRows.filter((r) => r.excluded).length;
  const totalToImport = validCount;

  // ─── Column mapping options (with "Ignorar") ──────────────────────────────
  const colOptions = [{ key: "", label: "— Ignorar —" }, ...fileColumns];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Agendamentos (CSV / XLSX)
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Selecione a unidade, o arquivo e baixe o modelo de referência."}
            {step === 2 && "Mapeie as colunas do arquivo para os campos do sistema."}
            {step === 3 && "Revise cada registro antes de importar."}
            {step === 4 && "Resultado da importação."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-sm">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`}>
                {step > s ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
              </div>
              <span className={step === s ? "font-medium" : "text-muted-foreground"}>
                {s === 1 ? "Arquivo" : s === 2 ? "Mapeamento" : s === 3 ? "Revisão" : "Resultado"}
              </span>
              {s < 4 && <div className="w-6 h-px bg-border mx-0.5" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: File selection ── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Unidade selector */}
            <div className="space-y-1.5">
              <Label htmlFor="unidade-select">
                Unidade Responsável <span className="text-destructive">*</span>
              </Label>
              {loadingUnidades ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando unidades...
                </div>
              ) : (
                <select
                  id="unidade-select"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedUnidadeId}
                  onChange={(e) => setSelectedUnidadeId(e.target.value)}
                >
                  <option value="">Selecione a unidade...</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} — {u.cidade}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* File input */}
            <div className="space-y-1.5">
              <Label htmlFor="file-input">
                Arquivo CSV ou XLSX <span className="text-destructive">*</span>
              </Label>
              <input
                id="file-input"
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border file:border-input file:text-sm file:font-medium hover:file:bg-muted cursor-pointer"
                onChange={handleFileChange}
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2">
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <span className="shrink-0 ml-auto text-xs">{formatBytes(file.size)}</span>
                </div>
              )}
            </div>

            {/* Template download */}
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Modelo de importação</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Baixe o modelo CSV com todos os campos e um exemplo.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1.5" />Baixar modelo
              </Button>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Column mapping ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              {file?.name} — {rawRows.length} linha(s) detectada(s)
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-3 font-medium">Campo do Sistema</th>
                    <th className="text-left py-2 px-3 font-medium">Coluna do Arquivo</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELD_DEFS.map((fd) => (
                    <tr key={fd.key} className="border-b border-border/50">
                      <td className="py-2 pr-3 align-top">
                        <span className={fd.required ? "font-medium" : ""}>
                          {fd.label}
                          {fd.required && <span className="text-destructive ml-0.5">*</span>}
                        </span>
                      </td>
                      <td className="py-2 px-3 align-top">
                        <select
                          className="w-full rounded border border-input bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          value={mapping[fd.key] ?? ""}
                          onChange={(e) => handleMappingChange(fd.key, e.target.value)}
                        >
                          {colOptions.map((opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Preview ── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 font-medium dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />{validCount} válidas
              </span>
              {duplicateCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-3 py-1 font-medium dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />{duplicateCount} duplicadas
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-3 py-1 font-medium dark:bg-red-900/30 dark:text-red-400">
                  <AlertCircle className="h-3.5 w-3.5" />{errorCount} com erro
                </span>
              )}
              {excludedCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-3 py-1">
                  {excludedCount} excluída(s)
                </span>
              )}
            </div>

            {/* Actions bar */}
            <div className="flex flex-wrap items-center gap-2">
              {errorCount > 0 && (
                <Button size="sm" variant="outline" onClick={toggleExcludeErrors}>
                  Excluir todos com erro
                </Button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                Marque as linhas que deseja excluir da importação
              </span>
            </div>

            {/* Preview table */}
            {loadingPreview ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Verificando duplicatas no banco de dados...</span>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-10">
                        <span title="Excluir">✕</span>
                      </TableHead>
                      <TableHead className="w-12">Linha</TableHead>
                      <TableHead>Instituição</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead className="text-center">Alunos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, idx) => (
                      <TableRow
                        key={idx}
                        className={
                          row.excluded
                            ? "opacity-40 bg-muted/20"
                            : row.result === "error"
                            ? "bg-red-50 dark:bg-red-950/20"
                            : row.result === "duplicate"
                            ? "bg-amber-50 dark:bg-amber-950/20"
                            : ""
                        }
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={row.excluded}
                            onChange={() => toggleExcludeRow(idx)}
                            className="rounded accent-primary"
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.linha}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{row.instituicao_nome || "—"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{row.data}</TableCell>
                        <TableCell className="text-sm capitalize">{row.turno}</TableCell>
                        <TableCell className="text-center text-sm">{row.quantidade_alunos}</TableCell>
                        <TableCell className="text-sm capitalize">{row.status}</TableCell>
                        <TableCell>
                          {row.excluded ? (
                            <span className="text-xs text-muted-foreground italic">Excluída</span>
                          ) : row.result === "valid" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Válida
                            </span>
                          ) : row.result === "duplicate" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" /> Duplicada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
                              <AlertCircle className="h-3.5 w-3.5" />
                              <span title={row.errorMsg}>Erro</span>
                            </span>
                          )}
                          {!row.excluded && row.errorMsg && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-0.5 max-w-[250px] truncate" title={row.errorMsg}>
                              {row.errorMsg}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4: Result ── */}
        {step === 4 && (
          <div className="space-y-4">
            {importing ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  Importando {importProgress.current} de {importProgress.total}...
                </p>
                <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ) : importResult ? (
              <div className="space-y-4">
                <div className={`rounded-lg border p-6 text-center ${importResult.success ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"}`}>
                  {importResult.success ? (
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 dark:text-green-400 mb-2" />
                  ) : (
                    <AlertCircle className="h-12 w-12 mx-auto text-red-600 dark:text-red-400 mb-2" />
                  )}
                  <p className={`text-lg font-semibold ${importResult.success ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}`}>
                    {importResult.success ? "Importação concluída!" : "Erro na importação"}
                  </p>
                  {importResult.success && (
                    <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-700 dark:text-green-300">{importResult.importadas}</span>
                        <span className="text-green-600 dark:text-green-400">importada(s)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-amber-700 dark:text-amber-300">{importResult.duplicadas}</span>
                        <span className="text-amber-600 dark:text-amber-400">duplicada(s)</span>
                      </div>
                      {importResult.com_erro > 0 && (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <span className="font-medium text-red-700 dark:text-red-300">{importResult.com_erro}</span>
                          <span className="text-red-600 dark:text-red-400">com erro</span>
                        </div>
                      )}
                    </div>
                  )}
                  {importResult.error && (
                    <p className="mt-2 text-sm text-red-700 dark:text-red-300">{importResult.error}</p>
                  )}
                </div>

                {/* Error details */}
                {importResult.erros && importResult.erros.length > 0 && (
                  <div className="space-y-2">
                    <button
                      className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300 hover:underline"
                      onClick={() => setShowErrors((v) => !v)}
                    >
                      {showErrors ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      Ver detalhes dos {importResult.erros.length} erro(s)
                    </button>
                    {showErrors && (
                      <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 divide-y divide-red-200 dark:divide-red-800 max-h-48 overflow-y-auto">
                        {importResult.erros.map((err, i) => (
                          <div key={i} className="px-3 py-2 text-sm">
                            <span className="font-medium text-red-800 dark:text-red-200">Linha {err.linha}: </span>
                            <span className="text-red-700 dark:text-red-300">{err.erro}</span>
                            {err.detalhe && (
                              <div className="text-xs text-red-500 mt-0.5 ml-4">
                                {err.detalhe.id_externo ? `ID: ${err.detalhe.id_externo} · ` : ""}
                                {err.detalhe.instituicao ? `${err.detalhe.instituicao} · ` : ""}
                                {err.detalhe.data ? err.detalhe.data : ""}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadErrorReport(importResult.erros)}
                      className="mt-1"
                    >
                      <Download className="h-4 w-4 mr-1.5" />Baixar relatório de erros (CSV)
                    </Button>
                  </div>
                )}
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                {error}
              </div>
            ) : null}
          </div>
        )}

        {/* ── Footer actions ── */}
        <DialogFooter className="gap-2 flex-wrap">
          {step > 1 && step < 4 && (
            <Button
              variant="outline"
              onClick={() => { setStep((s) => (s - 1) as ImportStep); setError(""); }}
              disabled={importing}
            >
              <ChevronRight className="h-4 w-4 rotate-180 mr-1" />Voltar
            </Button>
          )}

          {step === 1 && (
            <>
              <div className="flex-1" />
              <Button
                onClick={handleProceedToStep2}
                disabled={!selectedUnidadeId || !file || loadingUnidades}
              >
                Continuar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex-1" />
              <Button onClick={handleProceedToStep3}>
                Revisar {rawRows.length} registro(s) <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === 3 && !importing && (
            <>
              <div className="flex-1 text-sm text-muted-foreground">
                {totalToImport > 0
                  ? `${totalToImport} registro(s) serão importado(s) para ${selectedUnidade?.nome ?? "a unidade selecionada"}`
                  : "Nenhum registro válido para importar."}
              </div>
              <Button
                onClick={handleImport}
                disabled={totalToImport === 0 || loadingPreview}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Importar {totalToImport} registro{totalToImport !== 1 ? "s" : ""}
              </Button>
            </>
          )}

          {step === 4 && !importing && (
            <>
              <div className="flex-1" />
              {importResult?.com_erro > 0 && (
                <Button
                  variant="outline"
                  onClick={() => downloadErrorReport(importResult.erros ?? [])}
                >
                  <Download className="h-4 w-4 mr-1.5" />Baixar relatório de erros
                </Button>
              )}
              <Button onClick={handleClose}>
                <X className="h-4 w-4 mr-1" />Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
