const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UNIDADES = ["Fortaleza", "Sobral", "Juazeiro do Norte"];
const MAX_PESSOAS = 46;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    unidade: { type: "string", enum: UNIDADES },
    tipo_instituicao: { type: "string", enum: ["escola", "empresa", "orgao_publico", "outros"] },
    faixa_etaria: { type: "string", enum: ["criancas", "adolescentes", "adultos", "idosos"] },
    turno: { type: "string", enum: ["manha", "tarde"] },
    transporte_status: { type: "string", enum: ["onibus_detran", "proprio"] },
    quantidade_alunos: { type: "integer" },
    quantidade_professores: { type: "integer" },
    datas_sugeridas: {
      type: "array",
      items: { type: "string", description: "Data no formato YYYY-MM-DD, dia util" },
    },
    observacoes: { type: "string", description: "Resumo das necessidades especiais citadas; string vazia se nao houver" },
    justificativa: { type: "string", description: "Explicacao curta em portugues das escolhas" },
  },
  required: [
    "unidade",
    "tipo_instituicao",
    "faixa_etaria",
    "turno",
    "transporte_status",
    "quantidade_alunos",
    "quantidade_professores",
    "datas_sugeridas",
    "observacoes",
    "justificativa",
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Serviço de IA não configurado." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { descricao, cidadeAtual } = await req.json();
    if (!descricao || typeof descricao !== "string" || descricao.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Descreva a visita desejada com mais detalhes." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hoje = new Date().toISOString().slice(0, 10);

    const instrucoes = [
      "Você é assistente de agendamento da Escola Pública de Trânsito do Detran-CE.",
      `Unidades disponíveis: ${UNIDADES.join(", ")}.`,
      `Capacidade máxima por visita: ${MAX_PESSOAS} pessoas (alunos + professores somados nunca podem passar de ${MAX_PESSOAS}).`,
      "Turnos: manha ou tarde. Faixas: criancas, adolescentes, adultos, idosos.",
      "Transporte: onibus_detran (ônibus cedido pelo Detran) ou proprio.",
      `Hoje é ${hoje}. Toda data sugerida deve ser dia útil (segunda a sexta) e ter no mínimo 3 dias de antecedência.`,
      "Sugira de 2 a 3 datas em formato YYYY-MM-DD.",
      cidadeAtual ? `A instituição costuma ser atendida na unidade de ${cidadeAtual}; prefira-a se o texto não indicar outra.` : "",
      "Se o texto indicar mais pessoas que a capacidade, ajuste os números ao limite e explique na justificativa (em português).",
      "Responda em português do Brasil.",
    ]
      .filter(Boolean)
      .join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low" },
        instructions: instrucoes,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: `Descrição da visita desejada:\n${descricao.slice(0, 2000)}` }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "sugestao_visita",
            strict: true,
            schema,
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      const mensagens: Record<number, string> = {
        402: "Os créditos de IA do projeto acabaram. Recarregue para continuar usando a sugestão automática.",
        429: "Muitas solicitações no momento. Tente novamente em alguns instantes.",
      };
      console.error("Erro do gateway de IA", res.status, detail);
      return new Response(
        JSON.stringify({ error: mensagens[res.status] ?? "Não foi possível gerar a sugestão agora." }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Lê o SSE e acumula apenas o texto final.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let texto = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
              texto += evt.delta;
            } else if (evt.type === "response.completed" && evt.response?.output_text) {
              texto = evt.response.output_text;
            }
          } catch {
            // ignora eventos parciais
          }
        }
      }
    }

    let sugestao: unknown;
    try {
      sugestao = JSON.parse(texto);
    } catch {
      console.error("Resposta não era JSON válido", texto.slice(0, 500));
      return new Response(JSON.stringify({ error: "Não conseguimos interpretar a sugestão. Tente reescrever a descrição." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sugestao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Falha inesperada", e);
    return new Response(JSON.stringify({ error: "Falha inesperada ao gerar a sugestão." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
