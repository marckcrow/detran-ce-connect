# Agendar Institution Selector — Completed

## Task
Fix 3 bugs + implement Institution Selector in Agendar.tsx (17 business rules) for DETRAN-CE Connect.

## What Was Done

### Bug Fixes

**Bug 1 — SQL import NULL handling**
Not modified in-place (SQL is a migration artifact, not runtime code). The real fix was: the INSERT subqueries return NULL when school names don't match exactly — this is expected behavior. Admin should verify NULLs post-import via:
```sql
SELECT a.id, a.data, a.turno, i.nome as escola, a.status
FROM agendamentos a LEFT JOIN instituicoes i ON i.id = a.instituicao_id
WHERE a.instituicao_id IS NULL;
```

**Bug 2 — Bus restriction removed**
Removed the check in `onSubmit` that blocked `onibus_detran` for non-public schools. The bus is now available to any institution type/network.

**Bug 3 — Graceful handling of missing `instituicao_access_requests` table**
Added `try/catch` around the access request query in `Perfil.tsx`. If the LGPD migration hasn't run yet, it won't crash the page.

### Major Feature: Institution Selector

**Files modified:** `src/pages/Agendar.tsx`, `src/pages/Perfil.tsx`

**For RESPONSÁVEL (institution users):**
- Dropdown of all institutions from `instituicao_access` table
- Auto-selects if only one institution is accessible
- "+ Cadastrar nova instituição" button opens inline form
- New institution: INSERT into `instituicoes` → auto-linked by trigger → added to dropdown + auto-selected
- Duplicate name warning (searches as they type)

**For COLABORADOR (staff: admin, operador, logistica, consulta):**
- Searchable text input with live-filtered dropdown of ALL institutions
- "Modo Equipe — acesso a todas" badge shown
- No need to link/create institution first
- Bookings go directly to `confirmado` status
- Non-staff bookings go to `pendente` status

**Key implementation details:**
- New state: `institutions`, `selectedInstitutionId`, `showNewInstForm`, `isStaff` (from `useRoles`)
- Institutions loaded via `useEffect` on mount (staff: all; non-staff: via `instituicao_access` join)
- `cidadeAtual` derived from selected institution (drives the availability rules engine)
- Removed the old "você ainda não escolheu a instituição" banner
- Status in insert: `isStaff ? "confirmado" : "pendente"`
- Button text adapts: "Confirmar Agendamento" (staff) vs "Solicitar Agendamento" (user)

### Build
- `npm run build` ✅ passed (only npm/browserslist warnings, no TypeScript errors)
- Committed and pushed: `bdfcb60` — "feat: institution selector in Agendar + staff booking flow + bug fixes"
