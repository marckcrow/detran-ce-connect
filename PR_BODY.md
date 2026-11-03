## Summary

Comprehensive P1/P2 DB security and consistency fix — **single self-contained migration file**.
No code changes — pure schema/policy work.

**Live production verification (2026-10-22):**
- `rpc_agendamentos_list`: BROKEN — `column "sort_data" does not exist` (confirmed via REST API)
- `public.unidades`: EMPTY — workaround VALUES in `rpc_unidades_list` (confirmed)
- `rpc_unidades_list`: returns 8 columns correctly (live RPC call)
- `get_user_unidades()`, `get_user_instituicao_id(_user_id)`, `user_can_access_unidade(uuid_col UUID)`: ALL EXIST
- UUIDs 11111111-1111-1111-1111-111111111101/102/103: NOT referenced by any existing data

## What Changed

### Problem 1: `public.unidades` table empty
`rpc_unidades_list()` returns hardcoded VALUES workaround instead of reading from the table.
**Fix:** Seed 3 DETRAN-CE units with stable UUIDs (matching VALUES), restore table-based function.

### Problem 2: `rpc_agendamentos_list` BROKEN — CTE scoping bug
**Live error confirmed:** `column "sort_data" does not exist` (status 400)
The deployed function has `ORDER BY sort_data` outside the CTE where it was defined.
**Fix:** Subquery wrapper pattern — `SELECT * FROM (WITH base AS (...) SELECT * FROM base) AS ordered LIMIT/OFFSET`.
This guarantees sort aliases are always in the same query level as `ORDER BY`.

### Problem 3: `profiles_lotacao_lock_own` — SECURITY FLAW
`USING(true) WITH CHECK(true)` — any authenticated user could UPDATE any profile's lotacao.
**Fix:** 3-policy defense-in-depth:
- Policy A (`lock_own`): allow owner OR staff to initiate UPDATE
- Policy B (`lock_update`): block non-admin owners from changing lotacao columns
- Policy C (`lock_insert`): block any user from setting lotacao on INSERT

### Problem 4: INSERT policies missing unit isolation
Any staff member could INSERT records into ANY unidade (only SELECT had unit isolation).
**Fix:** Unit isolation added to 9 INSERT/UPDATE/DELETE policies across 6 tables:
`ordens_servico`, `atendimentos`, `estoque_movimentos`, `disponibilidade`, `visitas`, `agendamentos`

## File

**Single file to apply:** `supabase/migrations/20261022_p1_p2_correcao_consolidada.sql`

Prior migration files are **DISPENSED** (superseded):
- `20261021_seed_unidades.sql` ❌
- `20261021_fix_rpc_agendamentos_list.sql` ❌
- `20261021_fix_profiles_lotacao_lock_policy.sql` ❌
- `20261021_unit_isolation_and_security.sql` ❌

## Execution

1. Open **Supabase SQL Editor** for project `dzercnanwtsavjftryfm`
2. Paste entire contents of `20261022_p1_p2_correcao_consolidada.sql`
3. Click **Run**
4. Watch NOTICE output — should end: `MIGRATION COMPLETE`
5. If error: **do not proceed** — report the message

## Post-Migration Verification

```sql
-- V1: 3 active unidades seeded
SELECT COUNT(*) FROM public.unidades WHERE ativo = true;  -- expect 3

-- V2: rpc_unidades_list returns 3 rows
SELECT COUNT(*) FROM public.rpc_unidades_list();  -- expect 3

-- V3: rpc_agendamentos_list works (NO CTE error)
SELECT public.rpc_agendamentos_list(
  1, 0, NULL, NULL, NULL, '2026-01-01', '2026-12-31', 'data', 'DESC', NULL
);  -- expect: empty result, NO ERROR

-- V4: 3 profiles_lotacao policies
SELECT COUNT(*) FROM pg_policies
WHERE schemaname='public' AND tablename='profiles'
  AND policyname LIKE 'profiles_lotacao%';  -- expect 3

-- V5: Old permissive policy gone
SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'
  AND tablename='profiles' AND policyname='profiles_lotacao_lock_own'
  AND qual LIKE '%USING (true)%';  -- expect 0

-- V6: 9+ unit isolation policies
SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'
  AND policyname IN (
    'os_insert_staff','atendimentos_insert_staff','estoque_movimentos_insert_staff',
    'disponibilidade_insert_staff','disponibilidade_update_staff','disponibilidade_delete_staff',
    'visitas_insert_staff','agendamentos_delete_staff','agendamentos_insert_own'
  );  -- expect 9

-- V7: rpc_unidades_list has 8 columns (including aceita_solicitacoes)
SELECT COUNT(*) FROM information_schema.parameters
WHERE specific_schema='public' AND routine_name='rpc_unidades_list';  -- expect 8
```

## Function Contract (important)

`rpc_unidades_list()` lists active unidades for UI dropdowns. **It does NOT grant access** to records in those unidades. Authorization remains enforced per-table via RLS policies.

## Blocked / Pending

| Test | Status |
|------|--------|
| Browser test: Agendamentos tab loads | ⏳ After migration |
| Browser test: admin access | ⏳ After migration |
| Cross-unit isolation (Fortaleza staff blocked from Sobral) | ⏳ Need 3 test accounts |
| Full flow: agendamento → OS → atendimento → estoque | ⏳ Need test data |
| rpc_set_lotacao admin enforcement | ⏳ Need admin session |

## Recovery (Emergency Only)

The file contains a commented recovery block at the end. Uncomment and execute ONLY if critical issues arise.
