# Colaborador Registration Flow + Staff Request on Perfil

## Task
Implement "Colaborador" (staff) registration flow where users can sign up as DETRAN team members, request staff roles, and have those requests appear in Admin's "Solicitações de Acesso" tab for approval.

## What Was Done

### 1. Auth Page (`src/pages/Auth.tsx`) — Account Type Selector

**New UI on "Cadastrar" tab:**
- **Two account type buttons** at top of form:
  - 👤 **Responsável** (default) — "Escola / Instituição" — original flow, goes to Perfil to link institution
  - 💼 **Colaborador** — "Equipe DETRAN" — new flow, creates access request for admin approval

- **When "Colaborador" is selected:**
  - Profile selector appears: ⚡ Operador / 🚚 Logística / 👁️ Consulta (radio buttons)
  - Submit button changes to: "Solicitar acesso como Colaborador"
  - Form label changes: "Nome do Colaborador"

- **Registration behavior:**
  - `responsavel` → creates profile → navigates to `/perfil` (original flow)
  - `colaborador` → creates profile **+** inserts into `access_requests` table with `status='pendente'` + `perfil_solicitado` → navigates to `/perfil`

### 2. Perfil Page (`src/pages/Perfil.tsx`) — Staff Access Card

**New card: "Acesso como Colaborador"** (after Institution card)

**If user has a staff request:**
| Status | Display |
|--------|---------|
| `pendente` | ⏳ Yellow banner: "Solicitação em análise — Você solicitou acesso como [Operador/Logística/Consulta]. Aguarde aprovação." |
| `aprovado` | ✅ Green banner: "Acesso aprovado! Você já pode usar o Modo Equipe." + "Ir para Agendamento →" button |
| `rejeitado` | ❌ Red banner: "Solicitação rejeitada. Entre em contato com a administração." |

**If user has NO staff request:**
- Description text explaining what colaborador access means
- **3 request buttons** (grid layout):
  - ⚡ **Operador** — "Solicitar acesso"
  - 🚚 **Logística** — "Solicitar acesso"
  - 👁️ **Consulta/Gestão** — "Solicitar acesso"
- Each button inserts into `access_requests` table and updates UI instantly to show "pendente" status

**Data loading:**
- New state: `staffRequest` — loads from `access_requests` table (latest request for current user)
- Wrapped in try/catch (table may not exist if migration not run yet)

### 3. Integration with Existing Admin Tab (`AccessRequestsTab.tsx`)
- **No changes needed** — already reads from `access_requests` table
- When a user registers as Colaborador or requests from Perfil → request appears in Admin → "Solicitações de Acesso" tab
- Admin can Approve (with role selection) or Reject (with reason)
- Approval grants roles in `user_roles` table → user immediately gets `isStaff = true`

### Complete User Flow

```
New Colaborador:
  Auth (/auth) → Cadastrar → Select "Colaborador" → Choose perfil → Submit
    → Creates auth user + profile + access_request (pendente)
    → Redirects to /perfil
    → Sees "⏳ Solicitação em análise" card

Admin:
  /admin → "Solicitações de Acesso" tab
    → Sees pending request
    → Clicks "Aprovar" → Selects roles to grant → Confirms
    → User gets roles in user_roles

Colaborador (after approval):
  /perfil → Sees "✅ Acesso aprovado!" card
  /agendar → Sees "Modo Equipe" badge
    → Can search ALL institutions
    → Bookings go to "confirmado" status
```

## Files Modified
- `src/pages/Auth.tsx` — Account type selector (Responsavel/Colaborador) + perfil radio buttons + conditional registration logic
- `src/pages/Perfil.tsx` — "Acesso como Colaborador" card with status display + 3 request buttons + staff request loading

## Build: ✅ passes clean (5.09s)
## Commit: `8925ec2`
