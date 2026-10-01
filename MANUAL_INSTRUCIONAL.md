# MANUAL DE INSTRUÇÕES — DETRAN-CE Connect
## Sistema de Agendamento de Visitas à Escola de Trânsito

**Versão:** 1.1 — Outubro 2026
**Plataforma:** DETRAN-CE Connect
**Última atualização:** 2026-10-01

---

## Índice

1. [Perfis de Acesso](#1-perfis-de-acesso)
2. [Como solicitar acesso](#2-como-solicitar-acesso)
3. [Como o admin analisa e concede acesso](#3-como-o-admin-analisa-e-concede-acesso)
4. [Guia por perfil de usuário](#4-guia-por-perfil-de-usuário)
5. [Tabela de permissões por funcionalidade](#5-tabela-de-permissões-por-funcionalidade)
6. [Como atualizar este manual](#6-como-atualizar-este-manual)
7. [Fluxo de Solicitação de Acesso](#7-fluxo-de-solicitação-de-acesso)

---

## 1. Perfis de Acesso

O sistema possui **4 perfis de acesso**, cada um com permissões específicas:

| Perfil | Descrição | Quem atribui |
|---|---|---|
| **Administrador** | Acesso completo a todas as funcionalidades | Admin (via aprovação de solicitação) |
| **Operador** | Gerencia agendamentos, escolas, notícias, estoque e relatórios | Admin |
| **Logística** | Gerencia OS de transporte (ônibus, rotas, motoristas) | Admin |
| **Consulta/Gestão** | Visualiza dados, relatórios e dashboards | Admin |

> **Importante:** Um usuário pode ter **mais de um perfil** ao mesmo tempo. Ex: um operador também pode ter acesso à logística.

---

## 2. Como solicitar acesso

### Fluxo de solicitação (novo — 2026-10-01):

> **A partir de 01/10/2026, o fluxo de acesso mudou.** Agora existe uma fila de aprovação.

1. Acesse **https://detran-ce-connect.vercel.app**
2. Clique em **"Cadastrar"**
3. Preencha os campos:
   - Nome da Instituição
   - Cidade
   - Nome do Responsável
   - E-mail
   - Telefone
   - Senha (mínimo 6 caracteres)
4. Clique em **"Cadastrar"**
5. **Confirme seu e-mail** (o Supabase envia um link de confirmação)
6. Após a confirmação, sua **solicitação de acesso entra na fila** do administrador
7. Você verá a mensagem: _"Sua solicitação de acesso foi enviada para análise. Você receberá um e-mail quando aprovada."_
8. **Aguarde** — o admin analisa e aprova/rejeita a solicitação
9. Quando aprovada, você recebe o acesso ao painel administrativo com o perfil concedido

### Status da solicitação:

| Status | Significado |
|---|---|
| **Pendente** | Aguardando análise do admin |
| **Aprovado** | Perfis concedidos — acesso liberado |
| **Rejeitado** | Solicitação negada (com motivo) |

### Se sua solicitação for rejeitada:
Entre em contato com o admin para entender o motivo ou solicitar uma nova análise.

---

## 3. Como o admin analisa e concede acesso

### Passo a passo (nova aba — 2026-10-01):

1. Faça login em **https://detran-ce-connect.vercel.app**
2. Acesse o **Painel Admin** (link no menu superior)
3. Vá para a aba **"Solicitações de Acesso"**
4. Você verá a lista de solicitações pendentes, aprovadas e rejeitadas
5. Use os filtros no topo para buscar por status
6. Para **aprovar**: clique em "Aprovar" → selecione os perfis → "Confirmar aprovação"
7. Para **rejeitar**: clique em "Rejeitar" → informe o motivo → "Confirmar rejeição"
8. Toda ação é **registrada nos logs do sistema**

### Regras importantes:

- ❌ **Não é possível remover o próprio perfil de Administrador**
- ❌ **Não é possível remover o último administrador do sistema** (proteção contra perda de acesso)
- ✅ Um usuário pode ter múltiplos perfis marcados
- ✅ Remover uma caixinha **revoga** o acesso imediatamente e é registrado no log

### Configurações de logística (mesma aba):

- **Limite diário (km):** Define o limite de km por viagem do ônibus
- **Ponto de saída/retorno:** Endereço base do ônibus para cálculos de distância

---

## 4. Guia por perfil de usuário

### 👑 ADMINISTRADOR

Acesso: **tudo**

| O que fazer | Como acessar |
|---|---|
| Analisar solicitações de acesso | Painel Admin → aba "Solicitações de Acesso" |
| Gerenciar usuários e perfis | Painel Admin → aba "Usuários e config." |
| Configurar logística | Painel Admin → aba "Usuários e config." (card de configurações) |
| Gerenciar agendamentos | Painel Admin → aba "Agendamentos" |
| Gerenciar notícias | Painel Admin → aba "Notícias" |
| Visualizar relatórios | Painel Admin → aba "Relatórios" |
| Aprovar/rejeitar OS | Painel Admin → aba "Ordens de Serviço" |
| Gerenciar disponibilidade | Painel Admin → aba "Disponibilidade" |
| Ver logs de auditoria | Painel Admin → aba "Logs do Sistema" |

---

### 🟡 OPERADOR

Acesso: **agendamentos, escolas, notícias, estoque, relatórios, disponibilidade**

| O que fazer | Como acessar |
|---|---|
| Visualizar todos os agendamentos | Painel Admin → aba "Agendamentos" |
| Confirmar/desfazer agendamento | Agendamentos → clicar no agendamento → botões de ação |
| Cadastrar/edit/excluir escolas | Painel Admin → aba "Escolas" |
| Cadastrar/edit/excluir notícias | Painel Admin → aba "Notícias" |
| Cadastrar/edit/excluir disponibilidade | Painel Admin → aba "Disponibilidade" |
| Registrar movimentações de estoque | Painel Admin → aba "Estoque" |
| Gerar relatórios | Painel Admin → aba "Relatórios" |

**O que o Operador NÃO pode fazer:**
- Gerenciar usuários e perfis
- Gerenciar solicitações de acesso
- Gerenciar OS de transporte (rotas, ônibus, motoristas)
- Ver logs do sistema

---

### 🔵 LOGÍSTICA

Acesso: **OS de Transporte + leitura de agendamentos**

| O que fazer | Como acessar |
|---|---|
| Criar/editar/cancelar OS de transporte | Painel Admin → aba "Transporte" |
| Definir rotas e horários | Dentro da OS, aba "Rotas" |
| Registrar veículo e motorista | Dentro da OS, campos "Veículo" e "Motorista" |
| Aprovar/rejeitar KM excedentes | Dentro da OS, campo "Status Logística" |
| Registrar realização da OS | Botão "Registrar atendimento" |
| Visualizar agendamentos | Painel Admin → aba "Agendamentos" (somente leitura) |
| Visualizar OS de serviço | Painel Admin → aba "Ordens de Serviço" (somente leitura) |

**O que o Logística NÃO pode fazer:**
- Gerenciar usuários e perfis
- Gerenciar solicitações de acesso
- Cadastrar/edit/excluir escolas
- Cadastrar/edit/excluir notícias
- Cadastrar/edit/excluir disponibilidade

---

### 🔍 CONSULTA/GESTÃO

Acesso: **visualização de dados e relatórios**

| O que fazer | Como acessar |
|---|---|
| Visualizar dashboard | Painel Admin → aba "Dashboard" |
| Visualizar agendamentos | Painel Admin → aba "Agendamentos" |
| Gerar relatórios | Painel Admin → aba "Relatórios" |
| Exportar dados | Dentro de Relatórios, escolher formato (CSV/PDF/XLSX) |

**O que o Consulta NÃO pode fazer:**
- Qualquer ação de criação, edição ou exclusão
- Gerenciar usuários
- Alterar configurações

---

## 5. Tabela de permissões por funcionalidade

| Funcionalidade | Admin | Operador | Logística | Consulta |
|---|---|---|---|---|
| **Agendamentos** | | | | |
| Visualizar todos | ✅ | ✅ | 👁️ | ✅ |
| Confirmar agendamento | ✅ | ✅ | ❌ | ❌ |
| Desfazer confirmação | ✅ | ✅ | ❌ | ❌ |
| Cancelar agendamento | ✅ | ✅ | ❌ | ❌ |
| **Ordens de Serviço** | | | | |
| Criar OS | ✅ | ✅ | ❌ | ❌ |
| Aprovar/rejeitar KM | ✅ | ✅ | ✅ | ❌ |
| Registrar veículo/motorista | ✅ | ✅ | ✅ | ❌ |
| Registrar conclusão | ✅ | ✅ | ✅ | ❌ |
| **Transporte** | | | | |
| Criar OS de Transporte | ✅ | ❌ | ✅ | ❌ |
| Editar OS de Transporte | ✅ | ❌ | ✅ | ❌ |
| Adicionar/remover escolas | ✅ | ❌ | ✅ | ❌ |
| Cancelar OS | ✅ | ❌ | ✅ | ❌ |
| **Escolas** | | | | |
| Cadastrar escola | ✅ | ✅ | ❌ | ❌ |
| Editar escola | ✅ | ✅ | ❌ | ❌ |
| Excluir escola | ✅ | ✅ | ❌ | ❌ |
| Importar escolas (CSV) | ✅ | ✅ | ❌ | ❌ |
| **Notícias** | | | | |
| Criar notícia | ✅ | ✅ | ❌ | ❌ |
| Editar notícia | ✅ | ✅ | ❌ | ❌ |
| Publicar/arquivar notícia | ✅ | ✅ | ❌ | ❌ |
| **Disponibilidade** | | | | |
| Gerenciar disponibilidade | ✅ | ✅ | ❌ | ❌ |
| Bloquear data | ✅ | ✅ | ❌ | ❌ |
| Desbloquear data | ✅ | ✅ | ❌ | ❌ |
| **Estoque** | | | | |
| Registrar entrada | ✅ | ✅ | ❌ | ❌ |
| Registrar saída | ✅ | ✅ | ❌ | ❌ |
| Ajuste de saldo | ✅ | ✅ | ❌ | ❌ |
| **Usuários** | | | | |
| Ver usuários | ✅ | ❌ | ❌ | ❌ |
| Atribuir perfil | ✅ | ❌ | ❌ | ❌ |
| Remover perfil | ✅ | ❌ | ❌ | ❌ |
| Ver solicitações de acesso | ✅ | ❌ | ❌ | ❌ |
| Aprovar/rejeitar solicitação | ✅ | ❌ | ❌ | ❌ |
| Configurar logística | ✅ | ❌ | ❌ | ❌ |
| **Relatórios** | | | | |
| Gerar relatórios | ✅ | ✅ | ❌ | ✅ |
| Exportar CSV/PDF/XLSX | ✅ | ✅ | ❌ | ✅ |
| **Logs do Sistema** | | | | |
| Ver logs de auditoria | ✅ | ❌ | ❌ | ❌ |
| **Dashboard** | | | | |
| Ver indicadores | ✅ | ✅ | ✅ | ✅ |

---

## 6. Como atualizar este manual

### Quando atualizar:

Este manual deve ser atualizado **sempre** que:

1. ✅ Um **novo perfil** for adicionado ao sistema
2. ✅ Uma **nova funcionalidade** for implementada
3. ✅ Uma **permissão existente** for alterada
4. ✅ Uma **funcionalidade existente** for corrigida ou modificada
5. ✅ Um **novo perfil de usuário** for criado
6. ✅ Um **bug de permissão** for corrigido
7. ✅ O sistema **mudar de URL** ou domínio

### Como atualizar:

1. Editar o arquivo `MANUAL_INSTRUCIONAL.md` na raiz do projeto
2. Atualizar a seção correspondente ao perfil/funcionalidade alterada
3. Atualizar a **tabela de permissões** (seção 5)
4. Adicionar nota no topo do arquivo com a **data da alteração** e **resumo da mudança**
5. Commitar com mensagem clara, ex:
   ```
   docs: atualiza manual - adiciona perfil Consulta
   docs: atualiza manual - nova aba Logs do Sistema
   fix: atualiza manual - permissões de Logística corrigidas
   ```

### Registro de alterações:

| Data | Versão | Alteração | Responsável |
|---|---|---|---|
| 2026-10-01 | 1.0 | Versão inicial — perfis admin, operador, logistica, consulta | Sistema |
| 2026-10-01 | 1.1 | Novo fluxo de aprovação de acesso — fila de solicitações, auditoria, proteção do último admin, nova aba "Solicitações de Acesso" | Sistema |

---

## 7. Fluxo de Solicitação de Acesso

### Visão geral do novo fluxo (2026-10-01)

```
Novo usuário cadastra
        ↓
  Confirma e-mail
        ↓
  Solic. entra na fila
  (status: pendente)
        ↓
  Admin analisa na aba
  "Solicitações de Acesso"
        ↓
   ┌────┴────┐
 Aprova          Rejeita
   ↓              ↓
 perfil(s)    motivo salvo
 concedidos   (exibido ao
   ↓           usuário)
 Usuário tem
 acesso ao
 painel admin
```

### O que muda:

| Situação | Antes | Depois |
|---|---|---|
| Novo cadastro | Acesso automático | entra na fila de aprovação |
| Papel inicial | `instituicao` (base) | `instituicao` (base, sem acesso admin) |
| Concessão de perfis | Admin marca caixinha na aba Usuários | Admin aprova na aba Solicitações de Acesso |
| Auditoria | Sem registro | Todas as ações logadas em `logs_sistema` |

### Perfis disponíveis para concessão:

- **Operador** — agendamentos, escolas, notícias, estoque, relatórios
- **Logística** — OS de transporte
- **Consulta/Gestão** — visualização de dados
- **Administrador** — acesso total (com aviso de cautela)

### Proteção do último admin:

O sistema impede que o último administrador seja removido, evitando a perda total de acesso ao painel. Se houver apenas um admin e você tentar remover seu papel, o sistema bloqueia a operação.

### Auditoria:

Todas as seguintes ações são registradas na tabela `logs_sistema`:
- Aprovação de solicitação de acesso (`aprovou_solicitacao_acesso`)
- Rejeição de solicitação de acesso (`rejeitou_solicitacao_acesso`)
- Atribuição de perfil a um usuário (`atribuiu_perfil`)
- Revogação de perfil de um usuário (`revogou_perfil`)
