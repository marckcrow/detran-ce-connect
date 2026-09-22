import { useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Sparkles, Wand2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type SugestaoVisita = {
  unidade: string;
  tipo_instituicao: string;
  faixa_etaria: "criancas" | "adolescentes" | "adultos" | "idosos";
  turno: "manha" | "tarde";
  transporte_status: "onibus_detran" | "proprio";
  quantidade_alunos: number;
  quantidade_professores: number;
  datas_sugeridas: string[];
  observacoes: string;
  justificativa: string;
};

const faixaLabels: Record<SugestaoVisita["faixa_etaria"], string> = {
  criancas: "Crianças",
  adolescentes: "Adolescentes",
  adultos: "Adultos",
  idosos: "Idosos",
};

const turnoLabels: Record<SugestaoVisita["turno"], string> = {
  manha: "Manhã",
  tarde: "Tarde",
};

const transporteLabels: Record<SugestaoVisita["transporte_status"], string> = {
  onibus_detran: "Ônibus do Detran",
  proprio: "Transporte próprio",
};

interface Props {
  cidadeAtual?: string | null;
  onAplicar: (sugestao: SugestaoVisita, data?: Date) => void;
}

export function SugestaoIA({ cidadeAtual, onAplicar }: Props) {
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [sugestao, setSugestao] = useState<SugestaoVisita | null>(null);

  const gerar = async () => {
    if (descricao.trim().length < 10) {
      toast({ title: "Conte um pouco mais", description: "Descreva a visita com pelo menos uma frase.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSugestao(null);
    const { data, error } = await supabase.functions.invoke("sugerir-visita", {
      body: { descricao, cidadeAtual },
    });
    setLoading(false);

    if (error) {
      let mensagem = "Não foi possível gerar a sugestão agora.";
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) mensagem = body.error;
        } catch {
          // mantém mensagem padrão
        }
      }
      toast({ title: "Sugestão indisponível", description: mensagem, variant: "destructive" });
      return;
    }

    if (data?.sugestao) {
      setSugestao(data.sugestao as SugestaoVisita);
    } else {
      toast({ title: "Sugestão indisponível", description: data?.error ?? "Tente novamente.", variant: "destructive" });
    }
  };

  const datasValidas = (sugestao?.datas_sugeridas ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Descreva a visita e receba uma sugestão
        </CardTitle>
        <CardDescription>
          Escreva com suas palavras o que você deseja (turma, quantidade de pessoas, período, cidade, necessidades especiais)
          e preencheremos o formulário para você.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={1000}
          rows={4}
          className="resize-none bg-background"
          placeholder="Ex.: Somos uma escola municipal de Sobral e queremos levar 30 alunos do 3º ano, com 3 professoras, de manhã, em abril. Dois alunos usam cadeira de rodas e precisamos do ônibus do Detran."
        />
        <Button type="button" onClick={gerar} disabled={loading} className="bg-gradient-hero">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Sugerir agendamento
            </>
          )}
        </Button>

        {sugestao && (
          <div className="space-y-4 rounded-lg border bg-background p-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Unidade: {sugestao.unidade}</Badge>
              <Badge variant="secondary">{turnoLabels[sugestao.turno] ?? sugestao.turno}</Badge>
              <Badge variant="secondary">{faixaLabels[sugestao.faixa_etaria] ?? sugestao.faixa_etaria}</Badge>
              <Badge variant="secondary">
                {sugestao.quantidade_alunos} alunos + {sugestao.quantidade_professores} professores
              </Badge>
              <Badge variant="secondary">{transporteLabels[sugestao.transporte_status] ?? sugestao.transporte_status}</Badge>
            </div>

            <p className="text-sm text-muted-foreground">{sugestao.justificativa}</p>

            {cidadeAtual && sugestao.unidade !== cidadeAtual && (
              <p className="text-sm">
                Sua instituição está cadastrada na unidade de <strong>{cidadeAtual}</strong>. Para mudar para{" "}
                <strong>{sugestao.unidade}</strong>, ajuste em{" "}
                <Link to="/perfil" className="text-primary underline">
                  Meu Perfil
                </Link>
                .
              </p>
            )}

            {datasValidas.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Datas sugeridas — escolha uma para preencher o formulário:</p>
                <div className="flex flex-wrap gap-2">
                  {datasValidas.map((d) => (
                    <Button key={d} type="button" variant="outline" size="sm" onClick={() => onAplicar(sugestao, parseISO(d))}>
                      {format(parseISO(d), "dd 'de' MMMM", { locale: ptBR })}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => onAplicar(sugestao)}>
                Preencher formulário
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
