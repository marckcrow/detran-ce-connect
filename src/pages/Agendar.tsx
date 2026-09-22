import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SugestaoIA, type SugestaoVisita } from "@/components/agendar/SugestaoIA";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type FaixaEtaria = Database["public"]["Enums"]["faixa_etaria"];
type Turno = Database["public"]["Enums"]["turno"];
type TransporteStatus = Database["public"]["Enums"]["transporte_status"];

const MAX_PESSOAS = 46;
const MIN_ANTECEDENCIA_DIAS = 3;

const agendamentoSchema = z.object({
  data: z.date({ required_error: "Selecione uma data" }).refine(
    (d) => d >= addDays(new Date(), MIN_ANTECEDENCIA_DIAS),
    `A data deve ter no mínimo ${MIN_ANTECEDENCIA_DIAS} dias de antecedência`
  ),
  turno: z.enum(["manha", "tarde"] as const, { required_error: "Selecione o turno" }),
  faixa_etaria: z.enum(["criancas", "adolescentes", "adultos", "idosos"] as const, { required_error: "Selecione a faixa etária" }),
  quantidade_alunos: z.coerce.number().int().min(1, "Mínimo 1 aluno").max(MAX_PESSOAS, `Máximo ${MAX_PESSOAS} pessoas no total`),
  quantidade_professores: z.coerce.number().int().min(1, "Mínimo 1 professor"),
  transporte_status: z.enum(["onibus_detran", "proprio"] as const, { required_error: "Selecione o transporte" }),
  observacoes: z.string().max(500, "Máximo 500 caracteres").optional(),
}).refine(
  (d) => d.quantidade_alunos + d.quantidade_professores <= MAX_PESSOAS,
  { message: `Capacidade do ônibus excedida: o total de alunos + professores não pode passar de ${MAX_PESSOAS} pessoas`, path: ["quantidade_alunos"] }
);

type AgendamentoForm = z.infer<typeof agendamentoSchema>;

export default function Agendar() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [instituicaoId, setInstituicaoId] = useState<string | null>(null);

  const form = useForm<AgendamentoForm>({
    resolver: zodResolver(agendamentoSchema),
    defaultValues: {
      quantidade_alunos: 20,
      quantidade_professores: 2,
      transporte_status: "onibus_detran",
      observacoes: "",
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("instituicao_id").eq("id", user.id).maybeSingle();
      if (!data?.instituicao_id) return;
      setInstituicaoId(data.instituicao_id);
      const { data: inst } = await supabase
        .from("instituicoes")
        .select("cidade")
        .eq("id", data.instituicao_id)
        .maybeSingle();
      if (inst?.cidade) setCidadeAtual(inst.cidade);
    })();
  }, [user]);

  const aplicarSugestao = (sugestao: SugestaoVisita, data?: Date) => {
    form.setValue("turno", sugestao.turno, { shouldValidate: true });
    form.setValue("faixa_etaria", sugestao.faixa_etaria, { shouldValidate: true });
    form.setValue("transporte_status", sugestao.transporte_status, { shouldValidate: true });
    form.setValue("quantidade_alunos", sugestao.quantidade_alunos, { shouldValidate: true });
    form.setValue("quantidade_professores", sugestao.quantidade_professores, { shouldValidate: true });
    if (sugestao.observacoes) form.setValue("observacoes", sugestao.observacoes.slice(0, 500));
    if (data) form.setValue("data", data, { shouldValidate: true });
    toast({ title: "Formulário preenchido", description: "Revise os dados antes de enviar a solicitação." });
  };


  const onSubmit = async (values: AgendamentoForm) => {
    if (!instituicaoId) {
      toast({ title: "Perfil incompleto", description: "Cadastre sua instituição no Meu Perfil antes de agendar.", variant: "destructive" });
      navigate("/perfil");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("agendamentos").insert({
      instituicao_id: instituicaoId,
      data: format(values.data, "yyyy-MM-dd"),
      turno: values.turno,
      faixa_etaria: values.faixa_etaria,
      quantidade_alunos: values.quantidade_alunos,
      quantidade_professores: values.quantidade_professores,
      transporte_status: values.transporte_status,
      observacoes: values.observacoes || null,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: "Erro ao agendar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento solicitado!", description: "Você receberá a confirmação em breve." });
      form.reset();
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const faixaLabels: Record<FaixaEtaria, string> = {
    criancas: "Crianças",
    adolescentes: "Adolescentes",
    adultos: "Adultos",
    idosos: "Idosos",
  };

  const turnoLabels: Record<Turno, string> = {
    manha: "Manhã",
    tarde: "Tarde",
  };

  const transporteLabels: Record<TransporteStatus, string> = {
    onibus_detran: "Ônibus do Detran",
    proprio: "Transporte Próprio",
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl">Agendar Visita</CardTitle>
              <CardDescription>
                Preencha o formulário para solicitar uma visita educativa. Capacidade máxima de {MAX_PESSOAS} pessoas por visita.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!instituicaoId && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                  <span>Você ainda não escolheu a instituição que fará a visita.</span>
                  <Button variant="outline" size="sm" onClick={() => navigate("/perfil")}>
                    Definir instituição
                  </Button>
                </div>
              )}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Data */}
                  <FormField
                    control={form.control}
                    name="data"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data da Visita</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? format(field.value, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < addDays(new Date(), MIN_ANTECEDENCIA_DIAS) ||
                                date.getDay() === 0 ||
                                date.getDay() === 6
                              }
                              locale={ptBR}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>Mínimo de {MIN_ANTECEDENCIA_DIAS} dias de antecedência. Somente dias úteis.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Turno */}
                  <FormField
                    control={form.control}
                    name="turno"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Turno</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o turno" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(turnoLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Faixa Etária */}
                  <FormField
                    control={form.control}
                    name="faixa_etaria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Faixa Etária</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a faixa etária" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(faixaLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Quantidade de Alunos */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="quantidade_alunos"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Qtd. Alunos</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={MAX_PESSOAS} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="quantidade_professores"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Qtd. Professores</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={MAX_PESSOAS} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Transporte */}
                  <FormField
                    control={form.control}
                    name="transporte_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transporte</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o transporte" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(transporteLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Observações */}
                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Informações adicionais sobre a visita (PCDs, necessidades especiais, etc.)"
                            className="resize-none"
                            maxLength={500}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>Opcional. Máximo 500 caracteres.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full bg-gradient-hero" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Solicitar Agendamento"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
