# Features Implementadas — 2026-10-02

## Commit: 3857680

### FEATURE A: Sistema de Ocorrências (`os_ocorrencias`)

**SQL:** `supabase/migrations/20261002_os_ocorrencias.sql`
- Tabela `os_ocorrencias` com campos: id, os_transporte_id, tipo, descricao, data_hora, gravidade, resolvido, resolucao, reportado_por, timestamps
- RLS habilitada (staff full access, authenticated read)
- Índice em `os_transporte_id`

**UI:** `src/components/admin/OSTransporteTab.tsx` — OSTDialog
- Estado `ocorrencias` + useEffect para carregar ocorrências da OS aberta
- Seção "Ocorrências" entre preview e email/whatsapp:
  - Badge com contagem de abertas
  - Formulário "Adicionar": tipo (8 opções), gravidade (3 níveis), data/hora, descrição
  - Lista de ocorrências com badges de tipo/gravidade/resolvido
  - Cada ocorrência aberta tem campo de resolução + botão "Marcar como resolvida"
- Ícones novos: `AlertTriangle, PlusCircle, CheckCircle2`

### FEATURE B: Lista de Presença PDF

**Arquivo:** `src/lib/listaPresencaPdf.ts`
- Função `gerarListaPresencaPdf(params)` — usa jsPDF + jspdf-autotable (já instalados)
- Gera PDF com:
  - Header DETRAN-CE verde + título "LISTA DE PRESENÇA"
  - Info box: escola, endereço, data, turno, previstos
  - Tabela com 20 linhas em branco (Nº, Nome, Idade, Turma, Presente/Ausente)
  - Se `alunos` for passado, pré-preenche as linhas
  - Rodapé: total de presentes, professor responsável, data
  - Nota LGPD: "Documento para uso interno... Não armazenar dados pessoais além do necessário"
- Campos LGPD-safe: ONLY nome, idade (faixa etária), turma, assinatura

**Integração UI:**
- `AgendamentosTab.tsx`: botão 📄 ao lado de email/WhatsApp por agendamento
- `OSTransporteTab.tsx`: botão "📥 Baixar Lista de Presença" na seção email/whatsapp da OSTDialog (calcula pax das rotas ativas)

### FEATURE C: Sistema de Templates de Mensagens

**SQL:** `supabase/migrations/20261002_mensagens_templates.sql`
- Tabela `mensagens_templates` com: id, chave, titulo, assunto, corpo, canal, gatilho, variaveis, ativo, ordem, timestamps
- RLS: admin full access, authenticated read active
- Seed data: 4 templates (confirmacao_email, confirmacao_whatsapp, os_corpo_email, lista_presenca_cabecalho)

**UI:** `src/components/admin/MensagensTab.tsx` (novo)
- Full CRUD: criar, editar, excluir, ativar/desativar
- Filtros: canal (7 opções), gatilho (7 opções), status ativo/inativo, busca por título/chave
- Editor: chave (slug, readonly após criação), título, assunto (email), corpo (textarea mono)
- Guide de variáveis: chips clicáveis que inserem `{\w+}` no cursor
- Pré-visualização: renderiza template com dados de exemplo
- "Restaurar padrão": reinsere seeds do SEED_TEMPLATES

**Refatoração:** `src/components/admin/AgendamentosTab.tsx`
- Carrega templates ativos do banco em `templates[]`
- `enviarConfirmacaoEmail/WhatsApp`: busca template por canal/gatilho → interpola variáveis → fallback para texto hardcoded (backward compatible)
- Nova função `baixarListaPresenca(a)` integrada à tabela

**Admin.tsx:** Tab "Mensagens" adicionado para administradores

## Validação
- `npm run build` passa ✓
- Commit: `3857680` — 7 arquivos, 1096 linhas adicionadas, 46 removidas
