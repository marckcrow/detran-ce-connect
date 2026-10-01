# DETRAN-CE Connect — Batch Fixes 2026-10-01

## O que foi feito

### 1. ✅ SQL Import Fix (CRÍTICO)
- Arquivo: `supabase/migrations/20261001_import_escolas.sql`
- Removida coluna `updated_at` dos 400 INSERTs — a tabela `instituicoes` não tinha essa coluna
- Corrigido: agora insere apenas `created_at` (um `now()` por registro)

### 2. ✅ Migration `updated_at` na `instituicoes`
- Arquivo: `supabase/migrations/20261001_fix_instituicoes_updated_at.sql`
- Adiciona coluna `updated_at` à tabela `instituicoes`
- Cria trigger `instituicoes_updated_at` para auto-update

### 3. ✅ Tabelas `noticias` e `logs_sistema`
- Arquivo: `supabase/migrations/20261001_noticias_logs_tables.sql`
- Cria tabela `noticias` (id, titulo, conteudo, resumo, categoria, imagem_url, tags, status, data_publicacao, autor_id, created_at, updated_at)
- Cria tabela `logs_sistema` (id, usuario_id, usuario_nome, acao, tabela, registro_id, detalhes, ip_address, created_at)
- RLS configurado: staff full access, users autenticados leem notícias publicadas

### 4. ✅ `NoticiasTab.tsx` (novo componente)
- Local: `src/components/admin/NoticiasTab.tsx`
- CRUD completo: listar, criar, editar, excluir com confirmação
- Campos: título, conteúdo, resumo, categoria (Educação/Campanha/Unidades/Outros), URL da imagem, tags, data de publicação, status
- Preview da imagem ao informar URL
- Badge de categoria e status com cores diferenciadas

### 5. ✅ `LogsTab.tsx` (novo componente)
- Local: `src/components/admin/LogsTab.tsx`
- Lista logs do sistema com paginação (50 por página)
- Filtros: período (de/até), tabela, ação, usuário
- Dialog de detalhes com JSON dos detalhes
- Cores por tipo de ação (insert=verde, update=azul, delete=vermelho, etc.)

### 6. ✅ `Admin.tsx` — novas abas
- Adicionadas abas "Notícias" e "Logs" (após Disponibilidade)
- Importados componentes `NoticiasTab` e `LogsTab`

### 7. ✅ `Footer.tsx` — informações de contato atualizadas
- Telefone WhatsApp: (85) 98135-9276
- Telefone fixo: (85) 3106-4711
- E-mail: escoladetransito@detran.ce.gov.br
- Unidade: Centro Integrativo de Fortaleza (lista reduzida)

### 8. ✅ `osPdf.ts` — identidade visual DETRAN-CE
- Header atualizado com branding DETRAN-CE
- Footer oficial com: Escola de Trânsito/Detran Ceará, unidade, contatos
- Cor verde DETRAN: #006837
- Barra verde em cima e embaixo de cada página

### 9. ✅ `OSTransporteTab.tsx` — numeração incremental
- Auto-incrementa número da OS baseado em unidade + ano
- Busca próximo número ao mudar unidade
- Botão ↻ para buscar próximo número manualmente
- Rotas canceladas agora ficam com fundo vermelho claro (`bg-red-50`)

### 10. ✅ `AgendamentosTab.tsx` — botões de confirmação
- Botão "Enviar confirmação por e-mail" (mailto: com template pré-preenchido)
- Botão "Enviar confirmação por WhatsApp" (wa.me com mensagem formatada)
- Mensagem inclui: nome da escola, data, hora, status, transporte, contatos DETRAN
- Visíveis apenas para agendamentos pendentes ou confirmados

## Commits GitHub
1. `6aa3a5f` — fix: remove updated_at from import SQL + add updated_at migration
2. `beaeaf0` — feat: add NoticiasTab (full CRUD) and LogsTab (audit log with filters)
3. `00b9789` — feat: update footer and OS PDF with DETRAN-CE official branding
4. `e8692cb` — feat: OS auto-increment by unidade+ano, red highlights, email+WhatsApp confirmation

## Verificação
- `npx tsc --noEmit` → **0 erros**
- Todos os commits pushados para `main`
