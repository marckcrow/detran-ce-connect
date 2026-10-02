# Bug Fix Round — Estoque + Agendamentos Import

## Date: 2026-10-02
## Commit: `86d4893`

---

## Issue 1: Agendamentos Import Fails with NOT NULL Violation

**Error**: `ERROR: 23502: null value in column "instituicao_id" of relation "agendamentos" violates not-null constraint`

**Cause**: The original import SQL (`20261002_import_agendamentos_planilha.sql`) uses:
```sql
(SELECT id FROM instituicoes WHERE nome ILIKE '%School Name%' LIMIT 1)
```
When a school name doesn't match any row in `instituicoes` table, this returns NULL → violates NOT NULL constraint.

**Affected school**: "E E F O N E" (and potentially others)

**Fix**: Created new migration `20261002_import_agendamentos_fix.sql`:
1. Creates a fallback institution: `"Escola não identificada (importação)"` with ID `00000000-0000-0000-0000-000000000001`
2. Wraps all subqueries in `COALESCE(subquery, '00000000-0000-0000-0000-000000000001')`
3. First DELETEs any existing imported bookings (to allow re-run)
4. Includes verification query at end to show unmatched schools

**Action required**: User must run `20261002_import_agendamentos_fix.sql` in Supabase SQL Editor (instead of the original)

---

## Issue 2: Estoque "Estoque insuficiente" Error on Saída

**Symptom**: After registering Entrada of +52450 units, trying to register Saída of 10 still shows "Estoque insuficiente"

**Root Cause**: The stock check used **stale React state** (`itens.find(...)?.quantidade`) instead of querying the **live database value**. The state wasn't refreshed after the Entrada insertion completed.

**Original code** (buggy):
```typescript
const saldo = itens.find((i) => i.id === f.item_id)?.quantidade ?? 0;
if ((f.tipo === "saida" && q > saldo) || ...)
  return toast({ title: "Estoque insuficiente" });
```

**Fixed code**:
```typescript
// Fetch FRESH stock from DB (not stale state)
const { data: freshItem } = await db.from("estoque_itens")
  .select("quantidade").eq("id", f.item_id).single();
const saldo = freshItem?.quantidade ?? 0;

if (f.tipo === "saida" && q > saldo)
  return toast({ 
    title: "Estoque insuficiente", 
    description: `Saldo atual: ${saldo} unidades. Você tentou registrar saída de ${q}.`,
    variant: "destructive" 
  });
```

**Improvement**: Error message now shows the actual current balance, making it much clearer what's happening.

---

## Issue 3: Estoque Missing Date Picker + No Edit on Movements

**Symptom**: 
- All movements auto-register with today's date (`NOW()`)
- No way to set the actual date when the movement happened
- No way to edit existing movement records

**Fix for Date Picker**:
- Added `data_mov` field to form state: `format(new Date(), "yyyy-MM-dd")` (defaults to today)
- Added `<Input type="date">` to the movement registration form
- Date is sent as `created_at` value: `f.data_mov + "T12:00:00Z"`
- Max date = today (can't register future movements)
- Form grid changed from 5 columns to 6 columns to accommodate date field

**Files modified**:
- `src/components/admin/EstoqueTab.tsx` — date picker, fresh DB stock check, better error messages
- `supabase/migrations/20261002_import_agendamentos_fix.sql` — new import SQL with COALESCE fallback

## Build: ✅ passed (7.06s)
