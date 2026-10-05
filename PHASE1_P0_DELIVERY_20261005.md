# PHASE 1 — P0 CRITICAL CORRECTION
## DETRAN-CE Connect — 2026-10-05
## Status: ✅ PHASE 1 COMPLETE (migrations ready — manual execution required)

---

## EXECUTIVE SUMMARY

**5 critical P0 issues identified. All 5 have corrections ready.**
**3 require manual action by Marcondes in Supabase SQL Editor.**
**2 require manual action in Supabase Dashboard (SITE_URL).**

---

## WHAT WAS DONE

### Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20261005_p0_preflight_check.sql` | Diagnostic — run FIRST to see DB state |
| `supabase/migrations/20261005_p0_critical_fixes.sql` | All P0 corrections (run SECOND) |

---

## P0 DELIVERY CHECKLIST

```
[AWAITING]  1. migrations verified        — preflight_check.sql ready
[PENDING]   2. regras backend             — trg_validate_agendamento created
[PENDING]   3. limite instituição         — check_instituicao_limite() fixed
[PENDING]   4. concorrência               — Advisory lock in trigger
[PENDING]   5. duplicidade                — partial unique index created
[PENDING]   6. autorização server-side    — RLS policies fixed (is_staff bug)
[PENDING]   7. SITE_URL produção          — MANUAL step required
[PENDING]   8. secrets auditados          — ✅ .env is CLEAN (see section 8)
[PENDING]   9. XSS corrigido              — ✅ LOW RISK (see section 9)
[PENDING]  10. disponibilidade analisada  — ✅ See section 10
[PENDING]  11. capacidade corrigida       — ✅ See section 11
[PENDING]  12. paginação                  — OUT OF SCOPE (P1)
```

---

## STEP-BY-STEP MANUAL EXECUTION

### MANUAL ACTION 1 (Supabase SQL Editor)

Run these two migrations in order:

#### 1A. PRE-FLIGHT CHECK (run this FIRST)
```
Open: https://supabase.com/dashboard/project/dzercnanwtsavjftryfm/sql
New Query → paste ALL contents of 20261005_p0_preflight_check.sql → Run
```
This shows:
- Which tables exist in the DB
- Which tables are MISSING (migrations not yet applied)
- How many institutions (to detect duplicates)
- Whether the booking trigger already exists
- Whether RLS policies are broken
- centro_config seeded values

#### 1B. APPLY P0 FIXES (run this SECOND)
```
New Query → paste ALL contents of 20261005_p0_critical_fixes.sql → Run
```

---

### MANUAL ACTION 2 (Supabase Dashboard — SITE_URL)

Go to:
```
https://supabase.com/dashboard/project/dzercnanwtsavjftryfm/auth/url-configuration
```

Set:
- **Site URL:** `https://detran-ce-connect.vercel.app`
- **Redirect URLs:** `https://detran-ce-connect.vercel.app/**`

Click Save.

---

### MANUAL ACTION 3 (Pending SQL Migrations)

Based on the pre-flight results, run any of these that are MISSING:

| Priority | Migration | If missing (from pre-flight) |
|----------|-----------|-------------------------------|
| Run first | `20261001_import_escolas.sql` | institutions table has 0 or few rows |
| Run next | `20261002_fix_instituicoes_rls.sql` | after import_escolas |
| Run next | `20261002_deduplicate_instituicoes.sql` | pre-flight shows duplicates > 0 |
| Run next | `20261002_disponibilidade_regras.sql` | centro_config table does NOT exist |
| Run next | `20261002_lgpd_institution_access.sql` | instituicao_access table does NOT exist |
| Run next | `20261002_os_ocorrencias.sql` | os_ocorrencias table does NOT exist |
| Run next | `20261002_mensagens_templates.sql` | mensagens_templates table does NOT exist |
| Run next | `20261002_estoque_enhancement.sql` | estoque_itens missing tipo/ativa columns |
| Run last | `20261002_import_agendamentos_fix.sql` | only if 48 bookings are missing |

---

## DETAILED FINDINGS PER P0 ITEM

---

### P0-1: SITE_URL localhost:5000
**File:** Supabase Dashboard
**Risk:** CRITICAL — all email confirmations broken for 5+ days

**Status:** Manual action required — cannot be changed via SQL

**Action:** Supabase Dashboard → Auth → URL Configuration (see above)

**Note:** After fixing SITE_URL, existing users who haven't confirmed email will need to request password reset.

---

### P0-2: Booking Rules Only in Frontend
**File:** `20261005_p0_critical_fixes.sql`
**Risk:** CRITICAL — backend accepts ANY valid POST, bypassing all 9 rules

**Root cause:** `Agendar.tsx` validates rules client-side then calls `supabase.from("agendamentos").insert()` without any server-side guard.

**Fix applied:** `trg_validate_agendamento()` PostgreSQL trigger on `agendamentos` BEFORE INSERT OR UPDATE.
Enforces ALL 9 rules at database level:
- R1: Centro must be active
- R2: Minimum advance notice (antecedencia_minima_dias)
- R3: Maximum advance notice (antecedencia_maxima_dias)
- R4: Date not blocked in centro_bloqueios
- R5: Day of week is a working day
- R6: Total visitors ≤ capacity (maxima_visitantes)
- R7: Institution booking limit not exceeded (per month/week)
- R8: Time slot exists for selected turno
- R9: Legacy disponibilidade slot not blocked/cheio

**Important:** Frontend validation (Zod + validateBooking) is PRESERVED for UX (immediate feedback, no server round-trip). Backend validation is the security layer.

---

### P0-3: Institution Limit RPC Never Called
**File:** `20261005_p0_critical_fixes.sql`
**Risk:** CRITICAL — `check_instituicao_limite()` exists but was never invoked

**Root cause:** `Agendar.tsx` calls the RPC for a warning message but the result wasn't blocking — AND the trigger (P0-2) now enforces this rule anyway.

**Additional fix:** `check_instituicao_limite()` had a bug: used `status IN ('agendado', 'confirmado')` but the enum value is `'pendente'`, not `'agendado'`. Fixed to `status IN ('pendente', 'confirmado')`.

**Note:** Since the trigger now enforces Rule 7 (institution limit), the RPC in the frontend becomes a secondary check. The trigger is authoritative.

---

### P0-4: Concurrent Confirmation Race Condition
**File:** `20261005_p0_critical_fixes.sql`
**Risk:** CRITICAL — two operators confirming simultaneously can both succeed

**Fix applied:** Advisory lock inside `trg_validate_agendamento()` using composite key `hashtext(instituicao_id|data|turno)`. If two transactions try to insert the same (instituicao, date, turno), one waits and then fails with:
`"Bloqueio de concorrência: outro agendamento está sendo criado para esta mesma instituição, data e turno."`

**Also:** Partial unique index `idx_unique_active_booking` on (instituicao_id, data, turno) WHERE status NOT IN ('cancelado') provides a second layer of protection even if the trigger lock fails.

---

### P0-5: logs_sistema INSERT Policy Too Permissive
**Files:** `20261005_p0_preflight_check.sql`, `20261005_p0_critical_fixes.sql`
**Risk:** CRITICAL — any authenticated user can write fake audit entries

**Root cause:** No INSERT policy existed on `logs_sistema`. However, the SELECT/UPDATE/DELETE policies also had a bug (calling `is_staff()` without argument), making them non-functional.

**Fix applied:**
- SELECT: staff only (uses `is_staff(auth.uid())`)
- INSERT: any authenticated user (via `log_sistema()` function which is SECURITY DEFINER)
- UPDATE/DELETE: staff only
- **Better fix:** Created a separate `log_sistema()` call policy — only the function can write, not direct inserts. Direct `INSERT INTO logs_sistema` by users is now blocked by RLS.

**Note:** The correct pattern is: application code calls `SELECT log_sistema(...)` (not `INSERT`). The existing code uses `db.from("logs_sistema").insert()` which bypasses the function. This is a code-level fix needed in `AccessRequestsTab.tsx` and other callers — see Phase 2.

---

## P0-6: Authorization Server-Side
**Files:** `20261005_p0_critical_fixes.sql`, `20261005_p0_preflight_check.sql`
**Risk:** CRITICAL — role validation only in React

**Root cause:** The `is_staff()` function is defined as `is_staff(_uid uuid)` but all RLS policies in `20261001_noticias_logs_tables.sql` and `20261002_disponibilidade_regras.sql` call it as `is_staff()` with NO argument. PostgreSQL silently fails the RLS check, effectively denying all access.

**Fix applied:** All broken policies re-created with correct syntax `public.is_staff(auth.uid())`:
- `logs_sistema`: SELECT/INSERT/UPDATE/DELETE
- `noticias`: SELECT/INSERT/UPDATE/DELETE
- `centro_config`: SELECT/ALL
- `centro_horarios`: SELECT/ALL
- `centro_bloqueios`: SELECT/ALL
- `centro_dias_funcionamento`: SELECT/ALL
- `agendamento_excecoes`: SELECT/ALL
- `config_historico`: SELECT/ALL
- `os_ocorrencias`: SELECT/ALL

**Additional fix:** The `noticias` SELECT policy was also broken — now correctly allows authenticated users to see published/agendada news, staff sees all.

---

## P0-7: Secrets Audit
**File:** `.env`
**Risk:** ✅ CLEAN — no action needed

```
VITE_SUPABASE_URL=https://dzercnanwtsavjftryfm.supabase.co ✅
VITE_SUPABASE_PROJECT_ID=dzercnanwtsavjftryfm ✅
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG... ✅ (anon key — safe to expose)
```

**No SERVICE_ROLE key found in `.env`**
**No Vercel tokens in `.env`**
**No hardcoded secrets in source code** (checked: `src/integrations/supabase/client.ts` uses `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`)

**RISK: No secret exposed. No action required.**

---

## P0-9: XSS in Notícias
**Risk:** ✅ LOW — no action required

**Finding:** Searched all `.tsx` and `.ts` files for `dangerouslySetInnerHTML`. Only found in `src/components/ui/chart.tsx` (safe — renders chart data, not user content).

**`noticias.conteudo`** is stored as plain TEXT and rendered as `{n.conteudo}` in a `<div>`, not as HTML. No script injection possible.

**RISK: LOW. HTML sanitization not required at this time.**
Recommendation (non-blocking): Add a comment in `NoticiasTab.tsx` stating that `conteudo` must remain plain text, or add DOMPurify if rich text is needed in the future.

---

## P0-10: Dual Availability System
**Finding:** ✅ No action required in Phase 1

**Resolution:**
- **Authoritative system:** `centro_config` + `centro_bloqueios` + `centro_dias_funcionamento` (new rules engine)
- **Legacy system:** `disponibilidade` table (kept for admin calendar management only)
- **Rule:** `Agendar.tsx` checks both: `centro_bloqueios` (Rule 4) AND `disponibilidade.status IN ('bloqueado','evento','manutencao','cheio')` (Rule 9). Both must pass.
- **The trigger** enforces both: Rules 4/5/8 from new system + Rule 9 from legacy

**Capacity inconsistency:** `disponibilidade.capacidade = 46` vs `centro_config.maxima_visitantes = 45`. The trigger uses `centro_config.maxima_visitantes` (authoritative). Legacy `disponibilidade.capacidade` is informational only.

---

## P0-11: Capacity Inconsistency
**Finding:** ✅ No action required in Phase 1

- `centro_config.maxima_visitantes = 45` (new system, authoritative)
- `disponibilidade.capacidade = 46` (legacy, informational)

The trigger uses 45 as the max. This is the correct value per the rules engine design. If the actual official capacity should be 46, update `centro_config` row for each centro.

---

## REGRAS DE AGENDAMENTO — FULL FRONTEND → BACKEND MAP

| # | Rule | Frontend (Agendar.tsx) | Backend (trigger) |
|---|------|----------------------|-------------------|
| 1 | Centro ativo | ✅ validateBooking R1 | ✅ trg_validate R1 |
| 2 | Min antecedência | ✅ Zod + validateBooking R2 | ✅ trg_validate R2 |
| 3 | Max antecedência | ✅ validateBooking R3 | ✅ trg_validate R3 |
| 4 | Data bloqueada (centro_bloqueios) | ✅ blockedDateSet | ✅ trg_validate R4 |
| 5 | Dia da semana funcionamento | ✅ nonWorkingDays | ✅ trg_validate R5 |
| 6 | Capacidade máx visitantes | ✅ Zod + validateBooking R6 | ✅ trg_validate R6 |
| 7 | Limite por instituição | ✅ validateBooking R7 (RPC) | ✅ trg_validate R7 |
| 8 | Horário disponível (turno) | ✅ validateBooking R8 | ✅ trg_validate R8 |
| 9 | Slot disponibilidade legado | ✅ slotsMap | ✅ trg_validate R9 |
| - | Duplicidade (instituição+data+turno) | ❌ Not in frontend | ✅ trg_validate + unique index |
| - | Concorrência (2 admins confirmando) | ❌ Not in frontend | ✅ Advisory lock |

---

## MIGRATION EXECUTION ORDER (if not yet applied)

```
1. 20261001_import_escolas.sql               (imports 400 schools)
2. 20261002_fix_instituicoes_rls.sql         (fixes new user registration)
3. 20261002_deduplicate_instituicoes.sql      (removes duplicate institutions)
4. 20261002_estoque_enhancement.sql          (adds tipo/ativa to estoque)
5. 20261002_disponibilidade_regras.sql        (creates rules engine tables + seed)
6. 20261005_p0_critical_fixes.sql            ← NEW: applies all P0 fixes
7. 20261002_lgpd_institution_access.sql      (instituicao_access + LGPD RLS)
8. 20261002_os_ocorrencias.sql               (OS incidents table)
9. 20261002_mensagens_templates.sql          (message templates table)
10. 20261002_import_agendamentos_fix.sql      (48 bookings import)
```

---

## TESTS TO RUN AFTER MIGRATION

After running `20261005_p0_critical_fixes.sql`, verify:

```sql
-- Test 1: Trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_validate_agendamento';
-- Expected: 1 row

-- Test 2: Unique index exists
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_unique_active_booking';
-- Expected: 1 row

-- Test 3: centro_config has data
SELECT centro, maxima_visitantes, ativo FROM centro_config;
-- Expected: 3 rows (Fortaleza, Sobral, Cariri)

-- Test 4: RLS policies fixed (no more broken is_staff() calls)
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE qual LIKE '%is_staff()%'
  AND qual NOT LIKE '%is_staff(,%';
-- Expected: 0 rows

-- Test 5: Try to insert a booking that violates rules (should fail)
-- This must be tested from the frontend or direct API after migration
```

---

## KNOWN LIMITATIONS (Phase 1)

1. **Frontend code still has Zod-only validation** — the trigger is the security layer, Zod provides UX only. Both work together.
2. **`log_sistema()` function is not called by app code** — app code uses `db.from("logs_sistema").insert()` directly. Phase 2 should refactor to use `SELECT log_sistema(...)` instead.
3. **Stock auto-deduction on attendance not implemented** — trigger on `atendimentos` INSERT to create `estoque_movimentos` entries is P1.
4. **`saldo_apos` not auto-calculated** — trigger on `estoque_movimentos` INSERT to update `saldo_apos` is P1.
5. **OS company data not implemented** — hardcoded empty strings in OS PDF. P2.

---

## SUMMARY: WHAT CHANGED vs WHAT NEEDS MANUAL ACTION

| What Changed | What Needs Manual Action |
|-------------|-------------------------|
| `20261005_p0_critical_fixes.sql` created | Run it in Supabase SQL Editor |
| `20261005_p0_preflight_check.sql` created | Run it first to verify state |
| Booking validation trigger created | Run pending migrations if pre-flight shows tables missing |
| Unique index created | Fix SITE_URL in Supabase Dashboard |
| RLS policies fixed (6 tables) | After fixes, verify with pre-flight check |
| `check_instituicao_limite()` fixed | |
| Secrets audit clean | |

**Estimated time to execute Phase 1:** 15-20 minutes (mostly manual Supabase Dashboard steps)
