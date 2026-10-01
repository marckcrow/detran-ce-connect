# MANUAL DE INSTRUÇÕES — DETRAN-CE Connect
## Sistema de Agendamento de Visitas à Escola de Trânsito

**Versão:** 1.0 — Outubro 2026
**Plataforma:** DETRAN-CE Connect
**Última atualização:** 2026-10-01

---

## Índice

1. [Perfis de Acesso](#1-perfis-de-acesso)
2. [Como solicitar acesso](#2-como-solicitar-acesso)
3. [Como o admin concede acesso](#3-como-o-admin-concede-acesso)
4. [Guia por perfil de usuário](#4-guia-por-perfil-de-usuário)
5. [Tabela de permissões por funcionalidade](#5-tabela-de-permissões-por-funcionalidade)
6. [Como atualizar este manual](#6-como-atualizar-este-manual)

---

## 1. Perfis de Acesso

O sistema possui **4 perfis de acesso**, cada um com permissões específicas:

| Perfil | Descrição | Quem atribui |
|---|---|---|
| **Administrador** | Acesso completo a todas as funcionalidades | Automaticamente ao primeiro cadastro |
| **Operador** | Gerencia agendamentos, escolas, notícias, estoque e relatórios | Admin |
| **Logística** | Gerencia OS de transporte (ônibus, rotas, motoristas) | Admin |
| **Consulta/Gestão** | Visualiza dados, relatórios e dashboards | Admin |

> **Importante:** Um usuário pode ter **mais de um perfil** ao mesmo tempo. Ex: um operador também pode ter acesso à logística.

---

## 2. Como solicitar acesso

### Para novos colaboradores (pré-cadastro):

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
5. O sistema cria automaticamente sua conta e vincula a instituição

### Após o cadastro

> **O acesso ao painel admin NÃO é automático.**
> O novo usuário precisa solicitar ao **Administrador** que atribua o perfil correto.

### Para solicitar acesso:

1. Entre em contato com o admin via WhatsApp: **(85) 98503-5473**
2. Informe: **nome completo**, **e-mail** e **qual perfil precisa**
3. O admin vai verificar e atribuir o perfil na aba **"Usuários e config."**

---

## 3. Como o admin concede acesso

### Passo a passo:

1. Faça login em **https://detran-ce-connect.vercel.app**
2. Acesse o **Painel Admin** (link no menu superior)
3. Vá para a aba **"Usuários e config."**
4. Na lista de usuários, localize o colaborador
5. **Marque** a caixinha do perfil desejado na linha do usuário
6. O sistema salva automaticamente ao marcar/desmarcar

### Regras importantes:

- ❌ **Não é possível remover o próprio perfil de Administrador**
- ✅ Um usuário pode ter múltiplos perfis marcados
- ✅ Remover uma caixinha **revoga** o acesso imediatamente

### Configurações de logística (mesma aba):

- **Limite diário (km):** Define o limite de km por viagem do ônibus
- **Ponto de saída/retorno:** Endereço base do ônibus para cálculos de distância

---

## 4. Guia por perfil de usuário

### 👑 ADMINISTRADOR

Acesso: **tudo**

| O que fazer | Como acessar |
|---|---|
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
