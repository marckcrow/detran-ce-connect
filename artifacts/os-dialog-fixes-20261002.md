# OS Dialog Bug Fixes — Cancel, Edit, Save, Preview

## Date: 2026-10-02
## Commit: `ca414da`
## File: `src/components/admin/OSTransporteTab.tsx`

---

## Issues Fixed

### 1. "Cancelar OS inteira" Error — No Prompt for Motivo
**Problem**: Clicking "Cancelar OS inteira" showed error toast "Informe o motivo do cancelamento" if the motivo field was empty. User had no indication they needed to fill the field first.

**Fix**: `cancelarOS()` now uses `window.prompt("Motivo do cancelamento da OS inteira:")` if motivo is empty, instead of showing an error toast. The prompt appears inline and captures the reason directly.

### 2. "Salvar e gerar versão atualizada" Button Disabled When No Changes
**Problem**: The save button was `disabled={!alterado}` — meaning if you just opened an OS to re-download or re-send it, the button was disabled. You couldn't re-save without making a change first.

**Fix**: Button now has **dual behavior**:
- **No changes (`!alterado`)**: Shows "📥 Baixar PDF atual" — downloads current version without creating a new revision
- **Has changes (`alterado`)**: Shows "💾 Salvar e gerar versão atualizada" — creates new revision with motivo

### 3. Email/WhatsApp Buttons Blocked by Unsaved Changes
**Problem**: Both "Enviar por e-mail" and "Enviar por WhatsApp" had `disabled={alterado}` — you couldn't send the OS if there were unsaved edits, even if you just wanted to send the current version.

**Fix**: Removed `disabled={alterado}` from both buttons. They now always work and send the **current saved version** (ignoring unsaved edits in the UI).

### 4. No "Visualizar/Preview" Option
**Problem**: Only "Baixar PDF da versão atual" existed. No way to preview the OS content inside the dialog before downloading.

**Fix**: Added **"👁️ Visualizar OS"** button that toggles a preview panel inside the dialog showing:
- OS header info (Unidade, Período, Status, Revisão)
- Full rotas table with Data, Hora, Escola (with endereço), Pax, Status (Ativa/Cancelada badge)
- Summary: active routes count, cancelled count, total pax

### 5. Edit Rota "Concluir" Button Unclear
**Problem**: After clicking ✏️ to edit a rota, the "Concluir" button was a plain outline button that didn't clearly indicate it saves changes.

**Fix**: Changed to **"💾 Salvar alterações da rota"** with `variant="default"` (green/filled) + Save icon. Much more visible and clear about its action.

---

## Summary of UI Changes

| Element | Before | After |
|---------|--------|-------|
| Cancelar OS button | Error toast if motivo empty | `window.prompt()` asks for motivo |
| Main action button | Disabled when no changes | Dual mode: Download (no changes) / Save (with changes) |
| Email/WhatsApp buttons | Disabled when unsaved changes | Always enabled |
| Preview | None | 👁️ Visualizar OS toggle with full preview panel |
| Edit rota save | "Concluir" (outline) | "💾 Salvar alterações da rota" (filled) |

## Build: ✅ passed (5.24s)
