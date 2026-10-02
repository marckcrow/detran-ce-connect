# DETRAN-CE Connect — Major Feature Implementation Plan

## Date: 2026-10-02
## Scope: 7 major feature areas

---

## 📋 FEATURE 1: Editable Message Templates System
**Goal**: Admin can edit ALL messages sent to schools (email/WhatsApp), OS text, certificate text, and create new templates for new situations/triggers.

### What needs to happen:
1. **New SQL table**: `mensagens_templates` 
   - id, chave (unique slug), titulo, assunto, corpo (rich text), canal (email/whatsapp/os_pdf/certificado/pdf_lista), gatilho (confirmacao/cancelamento/lembrete/os_emitida/revisao/etc), ativo, created_at, updated_at
   - Seed data with current hardcoded messages from AgendamentosTab.tsx and OSTransporteTab.tsx
2. **New Admin tab**: "Mensagens" (or integrate into existing "Relatórios" or new tab)
   - List all templates with filters by canal/gatilho
   - Edit template (subject + body) with variable placeholders guide
   - Create new template for custom situations
   - Preview with sample data
3. **Refactor AgendamentosTab**: Replace hardcoded email/WhatsApp strings with template lookups
4. **Refactor osPdf.ts**: Make OS text configurable via template (empresa, contrato, header, footer)
5. **Variables system**: `{escola}`, `{data}`, `{hora}`, `{responsavel}`, `{endereco}`, `{pax}`, `{os_numero}`, `{unidade}`, etc.

### Files:
- NEW: `supabase/migrations/20261002_mensagens_templates.sql`
- NEW: `src/components/admin/MensagensTab.tsx`
- EDIT: `src/components/admin/AgendamentosTab.tsx` (use templates)
- EDIT: `src/components/admin/OSTransporteTab.tsx` (use templates for resumo)
- EDIT: `src/lib/osPdf.ts` (accept configurable text)
- EDIT: `src/pages/Admin.tsx` (add Mensagens tab)

---

## 📋 FEATURE 2: Student Attendance List (Lista de Presença)
**Goal**: Generate a student list document per booking — either pre-filled or blank for day-of-visit attendance tracking. LGPD-compliant (no sensitive data).

### What needs to happen:
1. **New PDF generator**: `src/lib/listaPresencaPdf.ts`
   - Header: DETRAN-CE branding, OS number, date, time, school
   - Table columns: Nº, Nome do Aluno, Idade, Turma/Série, Assinatura (or Presente/Ausente checkbox)
   - Two modes: 
     a) Blank template (for teacher to fill on visit day)
     b) With pre-filled student names if provided
   - Footer: Teacher signature line, total count, date
2. **UI in AgendamentosTab/OS dialog**: "📋 Lista de Presença" button → downloads PDF
3. **Optional**: In Perfil/MinhaEscola, allow school to upload student list before visit

### LGPD-safe fields only:
- Nome (first name or initials OK)
- Idade (age range, not birth date)
- Turma/Série (class/grade)
- Assinatura (signature)
- NO: CPF, RG, endereço completo, nome dos pais, telefone

### Files:
- NEW: `src/lib/listaPresencaPdf.ts`
- EDIT: `src/components/admin/AgendamentosTab.tsx` (add download button)
- EDIT: `src/components/admin/OSTransporteTab.tsx` (add download button per rota)

---

## 📋 FEATURE 3: OS Status & Occurrence System
**Goal**: OS should have proper lifecycle statuses and an occurrence/incident logging system.

### Current OS statuses (from screenshot):
Rascunho → Agendamento solicitado → Confirmado → Programado → Em andamento → Realizado / Cancelado / Não realizado

### New: Occurrences/Incidents table
1. **New SQL table**: `os_ocorrencias`
   - id, os_transporte_id, tipo (atraso/onibus_quebrado/motorista_ausente/aluno_doente/acidente_vias/outro), descricao, data_hora, reportado_por, gravidade (baixa/media/alta), resolvido, resolucao, created_at
2. **OS Dialog enhancement**: 
   - Status dropdown with all 9 statuses (not just confirmado/cancelado)
   - "Ocorrências" section in OS dialog — list + add new occurrence
   - Each occurrence: type selector, description, severity, resolved toggle
3. **OS PDF**: Include occurrence summary if any exist

### Files:
- NEW: `supabase/migrations/20261002_os_ocorrencias.sql`
- EDIT: `src/components/admin/OSTransporteTab.tsx` (status dropdown + occurrences section)

---

## 📋 FEATURE 4: Logistics Approval by Bus Company (NOT by DETRAN units)
**Goal**: The bus company (empresa de ônibus) approves logistics, not the DETRAN unidade. Currently "Aprovação logística" is managed internally.

### Current state (from screenshot):
- OS dialog shows: Aprovação logística dropdown (Pendente/Aprovado/Exceção autorizada/Reprovado)
- Veículo/ônibus field, Motorista field
- But this is being done by DETRAN staff, not the bus company

### What needs to happen:
1. **Bus company portal access** (phase 1 = simple, phase 2 = full portal):
   - New role: `empresa_transporte` (or use existing `logistica` but scoped)
   - Bus company sees ONLY their assigned OS
   - Can approve/reject, fill vehicle/driver info, add occurrences
2. **For now (MVP)**: Keep approval in admin panel but make it clear it's "on behalf of company"
3. **Contract/Termos de Referência import**:
   - Upload field for contract PDF, termo de referencia
   - Stored in `os_transporte` or new `empresa_contratos` table
   - OS PDF pulls empresa data from contract (CNPJ, address, phone, contract number)

### Files:
- NEW: `supabase/migrations/20261002_empresa_contratos.sql`
- EDIT: `src/components/admin/OSTransporteTab.tsx` (contract upload/display)
- EDIT: `src/lib/osPdf.ts` (use contract data)

---

## 📋 FEATURE 5: Fix "Ônibus indisponível" Error for Private Schools
**Problem**: Screenshot shows red banner "O ônibus do DETRAN está disponível apenas para escolas da rede pública" when private school tries to select onibus_detran.

**Current code location**: `Agendar.tsx` — validation rule blocking private schools

**Fix needed**: User previously said "o onibus pode ser para rede privada tbm" — this was supposedly fixed but screenshot shows it's still happening. Need to verify the fix is deployed and working.

---

## 📋 FEATURE 6: Fix "instituicao_access_requests" Table Missing Error
**Problem**: Screenshot shows error "Could not find the table 'public.instituicao_access_requests' in the schema cache"

**Cause**: SQL migration `20261002_lgpd_institution_access.sql` has NOT been run in Supabase yet

**Fix**: User needs to run the pending migration. OR add better error handling so the app doesn't crash when table doesn't exist.

---

## 📋 FEATURE 7: Admin Tabs — "OS da empresa de ônibus" Tab Enhancement
**Current state**: OSTransporteTab exists and works

**Enhancements from this request**:
- Integrate Features 3 (occurrences), 4 (logistics approval flow, contract upload)
- Better status management
- Company data management (upload contrato, termo de referencia)

---

## IMPLEMENTATION ORDER (Priority)

### Phase 1 — Quick Fixes (do first)
1. **FEATURE 5**: Verify/fix bus restriction for private schools
2. **FEATURE 6**: Add try/catch around instituicao_access_requests query (prevent crash)

### Phase 2 — Core Functionality
3. **FEATURE 3**: OS statuses + occurrences system (high user value)
4. **FEATURE 2**: Student attendance list PDF (high user value)
5. **FEATURE 4 (partial)**: Contract upload for OS company data

### Phase 3 — Template System (largest feature)
6. **FEATURE 1**: Full message templates system (SQL + Admin tab + refactor)

### Phase 4 — Logistics Flow
7. **FEATURE 4 (full)**: Bus company approval workflow

---

## ESTIMATED EFFORT
- Phase 1: ~15 min (quick fixes)
- Phase 2: ~2-3 hours (SQL + components + PDF)
- Phase 3: ~2-3 hours (templates CRUD + refactoring)
- Phase 4: ~2 hours (company portal/approval flow)
- **Total: ~6-8 hours of work**

## TECHNICAL NOTES
- All new tables need RLS policies
- Use `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS` pattern
- PDF generation uses jsPDF + jspdf-autotable (already installed)
- File uploads can use Supabase Storage (bucket: contratos)
- Message templates body should support variables like {{escola}}, {{data}}, etc.
