# Operação Administrativa Completa — Plano em Fases

O pedido cobre 16 módulos. Para entregar com qualidade e testar cada parte, a implementação será feita em 4 fases, cada uma utilizável ao final.

## Fase 1 — Base de dados e cadastro de escolas
- Ampliar o cadastro de escolas: CNPJ, código, endereço completo, CEP, estado, responsável e contato, pública/privada, alunos estimados, observações, ativa/inativa.
- Importação em massa (XLSX e CSV): escolher arquivo, prévia em tabela, detectar duplicidades (CNPJ/código/nome+cidade), apontar erros por linha, confirmar quantidade e registrar quem importou e quando.
- Perfis de acesso: Administrador, Operador, Logística, Consulta (menus e ações liberados conforme perfil). Tela para o admin atribuir perfis.

## Fase 2 — Agendamento, PCD, logística e OS
- Formulário de agendamento com: horário, responsável e WhatsApp, acompanhantes, necessidades especiais.
- Seção PCD: "A turma possui aluno(s) PCD?" Sim/Não, com escolha múltipla (Autista, Cadeirante, Visual, Auditiva, Intelectual, Mobilidade reduzida, Outros + descrição).
- Logística: origem (ponto do ônibus), destino (escola), km estimados (informados manualmente nesta versão), ônibus, motorista, status de aprovação. Alerta acima do limite configurável (padrão 100 km), registrado como exceção e exigindo autorização, sem bloquear.
- OS única por agendamento confirmado, numeração automática por ano, com os status: Rascunho, Solicitado, Confirmado, Programado, Em andamento, Realizado, Cancelado, Não realizado.
- Histórico da OS somente leitura: data/hora, usuário, campo, valor anterior, novo valor, motivo. Gravado automaticamente pelo banco em toda alteração.
- Botão "Enviar confirmação via WhatsApp": mensagem pronta e editável, abre wa.me, registra que o envio foi acionado.
- O PDF de OS por período (7/15/30 dias) continua existindo e passa a usar os números gravados.

## Fase 3 — Atendimento, revistas, lanches e estoque
- Marcar "Realizado" abre um formulário obrigatório (previsto x atendido de alunos, professores, acompanhantes, PCD e tipos, revistas, lanches, observações, data/hora efetivas). Alerta quando previsto e atendido divergem.
- Cria o Registro de Atendimento permanente ligado a Escola, Agendamento e OS.
- Estoque de revistas e de lanches: entradas, saídas, ajustes, motivo, usuário, histórico. Entregas registradas no atendimento baixam o estoque automaticamente. Lanche "Não" exige motivo.
- Nada crítico é apagado: apenas cancelamento ou inativação.

## Fase 4 — Dashboard e relatórios
- Painel com todos os indicadores pedidos (escolas, agendamentos, atendimentos, visitantes, PCD por tipo, revistas, lanches, estoques, km e exceções acima do limite) e filtros por período, escola, pública/privada, faixa etária, PCD, status, OS e município.
- Relatórios com exportação XLSX, CSV e PDF: agendamentos, atendimentos, escolas atendidas, visitantes, pública/privada, PCD, consumo de revistas e lanches, estoque, quilometragem, OS por status e histórico das OS.

## Pendências a confirmar
- A ferramenta de alteração do banco falhou da última vez. Se ela continuar indisponível, as Fases 1 a 3 ficam bloqueadas até isso ser resolvido.
- Nesta versão, a distância é informada manualmente. O cálculo automático por mapa fica para uma evolução futura.

## Detalhes técnicos
- Novas tabelas: school fields em `instituicoes`, `importacoes_escolas`, `ordens_servico`, `os_historico` (preenchida por trigger), `atendimentos`, `estoque_itens`, `estoque_movimentos`, `config_sistema` (limite de km, ponto de saída), `whatsapp_envios`.
- Enum `app_role` ampliado com `operador`, `logistica`, `consulta`; RLS via `has_role`. Histórico e movimentos só aceitam inserção (sem update/delete).
- Baixa de estoque e criação do atendimento em função transacional no banco, para evitar inconsistência.
- Importação e exportação com a biblioteca `xlsx` no navegador; PDFs com `jspdf`, que já está instalado.
