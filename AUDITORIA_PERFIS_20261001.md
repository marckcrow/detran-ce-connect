# AUDITORIA DE PERFIS E ACESSOS — DETRAN-CE Connect
## Curadoria de funcionalidades: implementado vs. pendente

**Data:** 2026-10-01
**Analisado:** Perfis, RLS, fluxos de acesso, admin tabs
**Score atual:** B (funciona bem, mas faltam fluxos de pré-cadastro e notificação)

---

## 1. Sistema de Perfis — Implementado ✅

### O que existe hoje:

| Componente | Arquivo | Status |
|---|---|---|
| Hook de roles | `src/hooks/useRoles.ts` | ✅ Implementado |
| Tabela user_roles | Supabase | ✅ Criada com RLS |
| Enum app_role | Supabase | ✅ admin, operador, logistica, consulta |
| is_staff() function | Supabase | ✅ Verifica roles via auth.uid() |
| Aba UsuariosTab | `src/components/admin/UsuariosTab.tsx` | ✅ Completa |
| Atribuição de perfis | UsuariosTab.tsx | ✅ Checkbox funcional |
| Proteção auto-remoção | UsuariosTab.tsx linha 30 | ✅ Bloqueada |
| Restrição de tabs por perfil | `src/pages/Admin.tsx` | ✅ isAdmin/isOperador/isLogistica |
| Permissão por componente | OrdensTab.tsx, OSDialog | ✅ podeOperar/podeLogistica |
| Auth com Supabase | `src/pages/Auth.tsx` | ✅ Login + Cadastro |

### Roles implementados:

```
isAdmin    → admin
isOperador → admin + operador
isLogistica → admin + operador + logistica
isStaff    → admin + operador + logistica + consulta
```

---

## 2. O que FALTA implementar ❌

### CRÍTICO — Fluxo de pré-cadastro

**Problema:** Qualquer pessoa pode se cadastrar no sistema livremente. Não há:
- formulário de solicitação de acesso
- fluxo de aprovação pelo admin
- notificação ao admin quando novo usuário se cadastra
- status "pendente/aprovado/rejeitado" para novos cadastros

**Impacto:** O admin só fica sabendo de novos usuários manualmente (WhatsApp, etc.)

**Solução necessária:**
1. Criar tabela `access_requests` (id, nome, email, telefone, instituicao, cidade, status, created_at)
2. Substituir página de cadastro por formulário de **solicitação de acesso**
3. Criar aba **"Solicitações de Acesso"** no admin (para admin + operador)
4. Admin aprova/rejeita → sistema cria conta + notifica por email
5. Notificação automática via Edge Function no Supabase (trigger on insert)

---

### MÉDIO — Auditoria de alterações de perfil

**Problema:** Quando o admin concede ou revoga um perfil, nenhuma entrada é criada em `logs_sistema`.

**Solução necessária:**
- Ao marcar/desmarcar checkbox em `UsuariosTab.toggle()`, gravar em `logs_sistema`:
  - `acao: "atribuiu_perfil"` ou `revogou_perfil"`
  - `tabela: "user_roles"`
  - `detalhes: { usuario_alvo: uid, perfil: role }`

---

### MÉDIO — Validação de domínio de email

**Problema:** Qualquer email pode se cadastrar (gmail, hotmail, etc.)

**Recomendação:** Validar domínio do email na função de cadastro:
- Permitir apenas emails `@detran.ce.gov.br` ou domínios parceiros
- Ou manter livre mas com moderação manual via aba de solicitações

---

### BAIXO — Notificação de novos agendamentos ao admin

**Problema:** Quando uma escola faz um agendamento, não há notificação automática ao admin.

**Solução (opcional):**
- Edge Function + SendGrid/Resend para email
- Ou integrar com WhatsApp via wa.me link no email

---

## 3. Checklist de correção — Implementar

### Imediato (crítico):
- [ ] Criar tabela `access_requests` com campos: id, nome, email, telefone, instituicao_nome, cidade, status (pendente/aprovado/rejeitado), created_at, updated_at
- [ ] Criar aba `AccessRequestsTab.tsx` no admin (visível para admin + operador)
- [ ] Substituir fluxo de cadastro em `Auth.tsx` para criar `access_request` (sem criar conta ainda)
- [ ] Criar função no admin para **aprovar** solicitação (cria usuário + atribui role "instituicao")
- [ ] Criar função no admin para **rejeitar** solicitação
- [ ] Adicionar logging em `UsuariosTab.toggle()` → `logs_sistema`

### Futuro (médio prazo):
- [ ] Notificação por email ao admin quando nova solicitação chega (Edge Function)
- [ ] Notificação por email ao usuário quando solicitação é aprovada/rejeitada
- [ ] Validação de domínio de email (@detran.ce.gov.br)
- [ ] Sistema de notificações in-app (Badge no menu)

---

## 4. Tabela de permissões — Atual

### O que está funcionando agora:

| Funcionalidade | Admin | Operador | Logística | Consulta |
|---|---|---|---|---|
| Gerenciar usuários | ✅ | ❌ | ❌ | ❌ |
| Aprovar agendamentos | ✅ | ✅ | ❌ | ❌ |
| Gerenciar OS | ✅ | ✅ | ✅ | ❌ |
| Gerenciar Transporte | ✅ | ❌ | ✅ | ❌ |
| Gerenciar escolas | ✅ | ✅ | ❌ | ❌ |
| Gerenciar notícias | ✅ | ✅ | ❌ | ❌ |
| Gerenciar disponibilidade | ✅ | ✅ | ❌ | ❌ |
| Gerenciar estoque | ✅ | ✅ | ❌ | ❌ |
| Relatórios | ✅ | ✅ | ❌ | ✅ |
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Logs do sistema | ✅ | ❌ | ❌ | ❌ |

---

## 5. Prioridades de implementação

1. **[CRÍTICO]** Tabela `access_requests` + fluxo de aprovação
2. **[CRÍTICO]** Aba "Solicitações de Acesso" no admin
3. **[MÉDIO]** Logging de alterações de perfil
4. **[MÉDIO]** Email de notificação para novo usuário aprovado
5. **[BAIXO]** Validação de domínio de email
