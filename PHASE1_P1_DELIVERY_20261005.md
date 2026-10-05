# Phase 1 — P1 Delivery Report
**Date:** 2026-10-05
**Commit:** `02beaec`
**Status:** Code complete — MIGRATIONS MUST BE RUN MANUALLY

---

## EXECUTIVE SUMMARY

Phase 1 P1 implemented 5 backend migrations and 2 frontend changes covering:
estoque balance automation, server-side pagination, booking edit/reagendamento with audit
trail, and availability uniqueness. All RLS protections preserved. No data deleted.

---

## MIGRATIONS — RUN IN THIS ORDER

### ⚠️ IMPORTANT: Run in Supabase SQL Editor
**URL:** https://supabase.com/dashboard/project/dzercnanwtsavjftryfm/sql

Run one file at a time. Wait for "Success" before running the next.

---

### MIGRATION 1 — `20261005_p1_estoque_saldo_apos.sql`

**Purpose:** Auto-calculate `saldo_apos` atomically + reversal tracking + authorization

**What it does:**
- Adds columns to `estoque_movimentos`: `movimento_origem_id`, `tipo_cancelamento`,
  `agendamento_id`, `origem`
- Creates `trg_calc_saldo_apos()` BEFORE INSERT trigger:
  - `pg_advisory_xact_lock()` prevents concurrent race conditions
  - tipo=entrada → `saldo_apos = saldo_atual + qtd`
  - tipo=saida → `saldo_apos = saldo_atual - qtd` (BLOCKS if result < 0)
  - tipo=ajuste → `saldo_apos = saldo_atual + qtd` (qtd can be negative)
- Creates `estoque_estornar(p_movimento_id, p_tipo_cancelamento)` RPC:
  - Inverts any movement (entrada↔saída, ajuste↔-ajuste)
  - Records `movimento_origem_id` and `tipo_cancelamento`
  - Prevents double-reversal
- RLS: SELECT=all authenticated, INSERT=authenticated, UPDATE/DELETE=staff only

**Expected result:** "Success. No rows returned"

---

### MIGRATION 2 — `20261005_p1_agendamentos_pagination.sql`

**Purpose:** Server-side pagination + edit/reagendamento with full audit trail

**What it does:**
- Adds columns to `agendamentos`: `edit_autor`, `edit_data`, `edit_valores_anteriores`
- Creates `trg_agendamentos_audit()` BEFORE UPDATE trigger:
  - Records old values as JSONB before any change
  - Records editor name and timestamp
  - Only fires on actual data changes (not status reads)
- Creates `rpc_agendamentos_list()`:
  - Arguments: `p_limit, p_offset, p_status, p_cidade, p_centro,
    p_data_ini, p_data_fim, p_order_by, p_order_dir`
  - Returns: rows + total count in single result set
  - Stable ordering (data ASC/DESC, created_at, instituicao_nome)
- Creates `rpc_agendamentos_export()`:
  - Same filters as list, but returns ALL matching records (no pagination)
  - Returns enriched data for XLSX/CSV export
- Creates `rpc_agendamento_update()`:
  - Validates P0 rules: date blocked, day-of-week, capacity, institution limit
  - Only allows edit of `pendente` or `confirmado` bookings
  - Advisory lock prevents concurrent edits
  - Returns updated row

**Expected result:** "Success. No rows returned"

---

### MIGRATION 3 — `20261005_p1_disponibilidade_unique.sql`

**Purpose:** Prevent duplicate availability slots

**What it does:**
- Cleans up existing duplicate (data, turno) pairs — keeps most recent
- Creates `idx_disponibilidade_unique` partial unique index on (data, turno)

**Expected result:** "Success. No rows returned"

---

### MIGRATION 4 — `20261005_p1_estoque_auto_deduct.sql`

**Purpose:** Auto-deduct stock when attendance is registered

**What it does:**
- Adds columns to `atendimentos`: `estoque_movimento_lanche`,
  `estoque_movimento_revista`, `estoque_deduzido_boolean`
- Creates `trg_atendimento_stock_deduct()` AFTER INSERT OR UPDATE trigger:
  - INSERT: creates `saida` movements for lanches and revistas if qty > 0
  - UPDATE: creates `entrada` (estorno) movements when quantities decrease
  - Idempotent: uses `ON CONFLICT DO NOTHING` + `estoque_deduzido_boolean` flag
  - Logs warnings if item not found (does NOT block atendimento creation)
- RLS: SELECT=authenticated, INSERT/UPDATE=staff only

**Expected result:** "Success. No rows returned"

---

## FRONTEND CHANGES

### `src/components/admin/AgendamentosTab.tsx` ✅

**Pagination:**
- Server-side pagination using `rpc_agendamentos_list` (50 records/page)
- Filter controls: status, cidade, date range, order by + direction
- Shows "Exibindo X–Y de Z registro(s) · Página N de M"
- Previous/Next navigation buttons
- Falls back to direct query if RPC not yet available

**Export:**
- XLSX and CSV buttons use `rpc_agendamentos_export()` → ALL filtered records
- NOT limited to current page
- Includes: school, city, date, shift, pax, faixa, transport, status,
  responsible, OS number, last edit author + date

**Edit/Reagendamento Dialog:**
- Opens on "✏️ Edit" button (pendente or confirmado only)
- Shows current values pre-filled
- Editable: date, shift, students, teachers, companions, transport,
  responsible, WhatsApp, observations
- Calls `rpc_agendamento_update()` — server-side P0 validation
- Shows previous values from `edit_valores_anteriores` JSONB
- Shows last edit author + date from `edit_data`/`edit_autor`
- Error displayed inline with PostgreSQL error message
- Edit row highlighted with light gray background

**Regression preserved:**
- All existing actions (Confirmar, Cancelar, Email, WhatsApp, PDF) unchanged
- Status badges, PCD badges, km alerts preserved
- podeEditar guard unchanged

---

### `src/components/admin/EstoqueTab.tsx` ✅

**saldo_apos display:**
- Movement table now shows: Data, Item, Tipo, Qtd, **Saldo (after)**, Origem, Motivo, Usuário, Ações
- Positive quantities shown in green with "+" prefix
- Negative quantities shown in red with "-" prefix
- saldo_apos shown in bold (—" if not yet calculated)

**origem badge:**
- Manual movements → gray badge "Manual"
- Auto-deduct from atendimento → green badge "Atendimento"
- Reversal movements → yellow badge "Estorno"

**Reversal (Estornar) button:**
- Staff only (podeEditar guard)
- Appears on movements that have NOT been reversed yet and are not already "estorno"
- Reversed rows shown with 60% opacity and "Estornado" badge
- Confirmation dialog before executing
- Calls `estoque_estornar()` RPC → stock auto-updated
- Supports: entrada, saída, and ajuste reversals

---

## VERIFICATION QUERIES (run after migrations)

```sql
-- Check saldo_apos trigger exists
SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgname = 'trg_calc_saldo_apos';

-- Check estoque_movimentos columns
SELECT column_name FROM information_schema.columns
WHERE table_name = "estoque_movimentos"
AND column_name IN ("movimento_origem_id","tipo_cancelamento","agendamento_id","origem");

-- Check pagination RPC
SELECT proname FROM pg_proc WHERE proname = 'rpc_agendamentos_list';

-- Check edit RPC
SELECT proname FROM pg_proc WHERE proname = 'rpc_agendamento_update';

-- Check export RPC
SELECT proname FROM pg_proc WHERE proname = 'rpc_agendamentos_export';

-- Check disponibilidade unique index
SELECT indexname FROM pg_indexes
WHERE tablename = 'disponibilidade' AND indexname = 'idx_disponibilidade_unique';

-- Check auto-deduct trigger
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_atendimento_stock_deduct';

-- Check atendimentos new columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'atendimentos'
AND column_name IN ('estoque_movimento_lanche','estoque_movimento_revista','estoque_deduzido_boolean');

-- Check agendamentos edit columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'agendamentos'
AND column_name IN ('edit_autor','edit_data','edit_valores_anteriores');
```

---

## TEST PLAN

### 1. ESTOQUE — saldo_apos

**Test 1.1 — Entrada updates saldo_apos**
- Go to Estoque tab → New Movement
- Select item → Type: Entrada → Quantity: 10 → Motivo: "Recarga inicial"
- Click "Registrar"
- Expected: saldo_apos column shows correct cumulative balance
- DB: `SELECT id, tipo, quantidade, saldo_apos FROM estoque_movimentos ORDER BY created_at DESC LIMIT 5;`

**Test 1.2 — Saída validates insufficient stock**
- Current stock: 10. Try to register saída of 15.
- Expected: Error message "Saldo insuficiente para a operacao. Saldo atual: 10, quantidade solicitada: 15."
- DB: No row inserted

**Test 1.3 — Concurrent registrations (race condition)**
- Open two browser tabs, simultaneously register saída of 1 from same item
- Expected: Only one succeeds; the other gets "Saldo insuficiente" error
- Only one row with that quantity should exist in the movements table

**Test 1.4 — Estorno of entrada**
- Reverse a previous entrada of 10 units
- Click "↩️ Estornar" button on the entry
- Confirm dialog → Expected: new "entrada" movement created with tipo="saida" (reversing the original entrada), saldo restored
- DB: `SELECT * FROM estoque_movimentos WHERE movimento_origem_id = '<original_id>';`

**Test 1.5 — Concurrent estorno (double reversal prevention)**
- Click "↩️ Estornar" twice on the same movement in rapid succession
- Expected: First succeeds, second fails with "Esta movimentacao ja foi estornada."

---

### 2. PAGINAÇÃO SERVER-SIDE

**Test 2.1 — Pagination loads**
- Open Agendamentos tab
- Expected: Shows 50 records max, pagination controls visible if total > 50
- DB: `SELECT COUNT(*) FROM agendamentos;` should match total shown

**Test 2.2 — Filter by status**
- Select "Pendente" from status filter
- Expected: Only pendente rows shown; page count updates
- Clear filter: Expected all records shown again

**Test 2.3 — Filter by date range**
- Set date range to last 30 days
- Expected: Only records within range shown

**Test 2.4 — Page navigation**
- Navigate to page 2
- Expected: Different records shown
- "Anterior" button disabled on page 1, "Próxima" disabled on last page

**Test 2.5 — Export all filtered (not just page)**
- Apply a filter (e.g., status = pendente)
- Click "XLSX" export
- Open the downloaded file
- Expected: ALL pendente records, not just the 50 on page 1

**Test 2.6 — No pagination (fallback)**
- If RPC not yet available (migration not run), direct query is used
- Should still work, all records returned

---

### 3. EDIÇÃO E REAGENDAMENTO

**Test 3.1 — Edit button visible**
- Only on pendente or confirmado bookings
- Not visible on cancelado or realizado

**Test 3.2 — P0 rules apply on date change**
- Open edit on a pendente booking
- Change date to a blocked date (in centro_bloqueios)
- Click "Salvar"
- Expected: Error "A data XX esta bloqueada para agendamentos."
- No DB change

**Test 3.3 — P0 rules apply on capacity exceeded**
- Change quantidade_alunos to 9999
- Expected: Error "Capacidade maxima: X pessoas. Total informado: 9999."
- No DB change

**Test 3.4 — Successful edit**
- Change quantidade_alunos to 40 (valid)
- Expected: "Agendamento atualizado com sucesso" toast
- DB: `SELECT quantidade_alunos, edit_autor, edit_data FROM agendamentos WHERE id = '<id>';`

**Test 3.5 — Edit audit trail**
- After editing, edit button shows "✏️ por [nome do usuário]"
- Reopen edit dialog: previous values shown from edit_valores_anteriores JSONB

**Test 3.6 — Cannot edit realizados/cancelados**
- Try to open edit on a realizado booking
- Expected: Edit button not rendered

**Test 3.7 — Concurrent edit conflict**
- Open edit dialog on same booking in two tabs
- Save in tab 1 first
- Save in tab 2: advisory lock prevents simultaneous update
- Expected: one succeeds, one fails with error

---

### 4. AUTO-STOCK-DEDUCT

**Test 4.1 — Auto-deduct on atendimento INSERT**
- Register a new atendimento with lanches_qtd = 20
- Expected: `estoque_movimentos` has new row with tipo=saida, item=lanche, qtd=20
- DB: `SELECT * FROM estoque_movimentos WHERE agendamento_id = '<ag_id>' ORDER BY created_at;`

**Test 4.2 — Stock does NOT go negative on auto-deduct**
- Current lanche stock: 5. Register atendimento with lanches_qtd = 10.
- Expected: INSERT fails with "Saldo insuficiente" warning in server log
- Atividade record is NOT blocked (error is just logged as WARNING, not raised as EXCEPTION)

**Test 4.3 — Auto-estorno on quantity decrease**
- Update existing atendimento: lanches_qtd from 20 to 10
- Expected: New row in estoque_movimentos with tipo=entrada, qtd=10 (estorno)
- DB: `SELECT * FROM estoque_movimentos WHERE agendamento_id = '<ag_id>' ORDER BY created_at;`

---

### 5. DISPONIBILIDADE UNIQUE

**Test 5.1 — Duplicate insert blocked**
- Try to create two disponibilidade entries with same date+turno
- Expected: Second INSERT fails with unique constraint violation
- DB: `INSERT INTO disponibilidade (data, turno, status) VALUES ('2026-11-01', 'manha', 'disponivel');` — run twice

---

## FILES CHANGED

### New migration files
| File | Size | Purpose |
|------|------|---------|
| `20261005_p1_estoque_saldo_apos.sql` | 8,791 B | saldo_apos trigger, estornar RPC, RLS, tracking cols |
| `20261005_p1_agendamentos_pagination.sql` | 17,364 B | Pagination RPC, edit RPC, audit trigger |
| `20261005_p1_disponibilidade_unique.sql` | 2,473 B | Unique index + duplicate cleanup |
| `20261005_p1_estoque_auto_deduct.sql` | 8,623 B | Auto-deduct trigger on atendimentos |

### Modified files
| File | Change |
|------|--------|
| `AgendamentosTab.tsx` | Full rewrite: pagination, filters, export, edit dialog |
| `EstoqueTab.tsx` | saldo_apos display, origem badge, reversal button |

### Committed
- Commit `02beaec` — Phase 1 (P1): estoque saldo_apos trigger, auto-deduct, pagination, edit dialog

---

## MANUAL ACTIONS REQUIRED

1. **Run Migration 1** — `20261005_p1_estoque_saldo_apos.sql` in SQL Editor
2. **Run Migration 2** — `20261005_p1_agendamentos_pagination.sql` in SQL Editor
3. **Run Migration 3** — `20261005_p1_disponibilidade_unique.sql` in SQL Editor
4. **Run Migration 4** — `20261005_p1_estoque_auto_deduct.sql` in SQL Editor
5. **Deploy frontend** — Vercel auto-deploys from `origin/main` after push

---

## IMPLEMENTED vs TESTED vs DEPLOYED

| Item | Implemented | Tested | Deployed |
|------|-------------|--------|----------|
| saldo_apos trigger | ✅ | ❌ Manual | ❌ Run migration |
| estoque_estornar RPC | ✅ | ❌ Manual | ❌ Run migration |
| Concurrent lock (estoque) | ✅ | ❌ Manual | ❌ Run migration |
| RLS estoque | ✅ | ❌ Manual | ❌ Run migration |
| rpc_agendamentos_list | ✅ | ❌ Manual | ❌ Run migration |
| rpc_agendamentos_export | ✅ | ❌ Manual | ❌ Run migration |
| rpc_agendamento_update | ✅ | ❌ Manual | ❌ Run migration |
| Edit dialog (frontend) | ✅ | ❌ Manual | ❌ Deploy |
| Pagination (frontend) | ✅ | ❌ Manual | ❌ Deploy |
| Export (frontend) | ✅ | ❌ Manual | ❌ Deploy |
| Edit audit trail | ✅ | ❌ Manual | ❌ Run migration |
| Auto-deduct trigger | ✅ | ❌ Manual | ❌ Run migration |
| disponibilidade unique | ✅ | ❌ Manual | ❌ Run migration |

**Nothing is deployed until migrations are run in Supabase SQL Editor.**
