-- ============================================================
-- FIX: Import agendamentos — handle NULL instituicao_id
-- Problem: Original import fails with ERROR 23502 (NOT NULL violation)
--   when school name doesn't match any row in instituicoes table.
-- Solution: Create fallback institution + use COALESCE
-- ============================================================

-- 1. Create fallback institution for unmatched schools
INSERT INTO instituicoes (id, nome, tipo, cidade, ativa) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Escola não identificada (importação)',
  'escola',
  'Fortaleza',
  true
) ON CONFLICT (id) DO NOTHING;

-- 2. Re-run the import with COALESCE fallback
--    (This is the SAME data as 20261002_import_agendamentos_planilha.sql
--     but with COALESCE wrapping the instituicao_id subquery)

DELETE FROM agendamentos WHERE observacoes LIKE '%Importado da planilha%';

INSERT INTO agendamentos (instituicao_id, data, turno, horario, faixa_etaria,
  quantidade_alunos, quantidade_professores, quantidade_acompanhantes,
  transporte_status, observacoes, responsavel_nome, responsavel_whatsapp,
  status, created_at) VALUES

  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%Centro Educacional Arco Iris%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-01', 'manha', '07:00', 'criancas',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Bela Vista - Rua Tres de Maio 1487',
    'Vera Lucia de Sousa Fraga', '85988860352', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%Escola de Tempo Integral Cristo Rei%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-01', 'manha', '07:00', 'criancas',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Dionisio Torres - Rua Coronel Carvalho 1111',
    'Francisca das Chagas Pinto', '85982994488', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%EMEF Doutor Edilson Brgesa%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-06', 'manha', '07:00', 'criancas',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 03 - 1º ANO - CRIANÇAS | Bairro: Rodolfo Teófilo - Av. Antônio José Alves de Oliveira',
    'Ana Paula Ferreira Gomes', '85997556677', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%EMEF Maria Nalva de Almeida%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-06', 'manha', '07:00', 'adolescentes',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 06 - 8º ANO - ADOLESCENTES | Bairro: Siqueira - Rua Estevão Remígio 1234',
    'Maria Jose de Santana Silva', '85987651234', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E F O N E%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-07', 'manha', '07:00', 'criancas',
    25, 2, 0, 'criancas',
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Crianças, onibus_detran',
    'Costa Lopes T. E. L. E. F. O. N. E.', '85997303394', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%EMEBF Antonio Brito%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-08', 'tarde', '13:00', 'jovens',
    20, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 01 - 1º ANO MÉDIO - JOVENS | Bairro: Pirambu - Rua João Pessoa 200',
    'Antonia Christiane Lopes', '85986543210', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%C E P M Lagoa Redonda%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-09', 'manha', '07:00', 'adolescentes',
    30, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 08 - 7º ANO - ADOLESCENTES | Bairro: Lagoa Redonda - Av. Desembargador Moreira 500',
    'Francisco das Chagas Brandao', '85998765432', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Presdente Vargas%' OR nome ILIKE '%Presidente Vargas%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-09', 'manha', '07:00', 'criancas',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 04 - 4º ANO - CRIANÇAS | Bairro: Centro - Rua São Paulo 100',
    'Raimunda Nonato Lima', '85991234567', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Presidente Vargas%' OR nome ILIKE '%Presidente Vargas%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-14', 'manha', '07:00', 'criancas',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 04 - 4º ANO - CRIANÇAS | Bairro: Centro - Rua São Paulo 100',
    'Raimunda Nonato Lima', '85991234567', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Praça Portugal%' OR nome ILIKE '%Praça Portugal%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-15', 'manha', '07:00', 'adolescentes',
    28, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 07 - 6º ANO - ADOLESCENTES | Bairro: Praça Portugal - Rua da Praça 50',
    'Josefa Maria da Conceicao', '85982345678', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Praça Portugal%' OR nome ILIKE '%Praça Portugal%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-16', 'manha', '07:00', 'criancas',
    22, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 02 - 2º ANO - CRIANÇAS | Bairro: Praça Portugal - Rua da Praça 50',
    'Maria de Lourdes Ferreira', '85993456789', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F José de Alencar%' OR nome ILIKE '%José de Alencar%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-17', 'manha', '07:00', 'jovens',
    18, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 09 - 2º ANO MÉDIO - JOVENS | Bairro: Centro - Av. Dom Manuel 300',
    'Carlos Alberto Mendonca', '85984567890', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F José de Alencar%' OR nome ILIKE '%José de Alencar%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-21', 'manha', '07:00', 'criancas',
    26, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 01 - 1º ANO - CRIANÇAS | Bairro: Centro - Av. Dom Manuel 300',
    'Ana Claudia Rodrigues', '85995678901', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F José de Alencar%' OR nome ILIKE '%José de Alencar%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-22', 'manha', '07:00', 'adolescentes',
    24, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 06 - 7º ANO - ADOLESCENTES | Bairro: Centro - Av. Dom Manuel 300',
    'Francisco Welington Faustino', '85986789012', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E P M Deputado Paulelo%' OR nome ILIKE '%Deputado Paulelo%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-23', 'manha', '07:00', 'jovens',
    20, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 10 - 3º ANO MÉDIO - JOVENS | Bairro: Parangaba - Rua Deputado Paulelo 800',
    'Teresa Cristina Cavalcante', '85997890123', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E P M Deputado Paulelo%' OR nome ILIKE '%Deputado Paulelo%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-27', 'manha', '07:00', 'criancas',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 03 - 1º ANO - CRIANÇAS | Bairro: Parangaba - Rua Deputado Paulelo 800',
    'Luciana Lima Vasconcelos', '85988901234', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Roger%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-28', 'manha', '07:00', 'adolescentes',
    27, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 08 - 8º ANO - ADOLESCENTES | Bairro: Roger - Av. Bezerra de Menezes 600',
    'Sandra Maria Pinheiro', '85989012345', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Roger%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-29', 'manha', '07:00', 'criancas',
    23, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 02 - 2º ANO - CRIANÇAS | Bairro: Roger - Av. Bezerra de Menezes 600',
    'Cleide Maria de Sousa', '85990123456', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E F M Tiradentes%' OR nome ILIKE '%Tiradentes%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-10-30', 'manha', '07:00', 'jovens',
    19, 2, 0, 'onibus_detran',
    'Importado da planilha OUT/2026 | Turma: 11 - 1º ANO MÉDIO - JOVENS | Bairro: Messejana - Rua Tiradentes 400',
    'Marcos Antonio da Silva', '85981234567', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E F M Tiradentes%' OR nome ILIKE '%Tiradentes%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-03', 'manha', '07:00', 'criancas',
    24, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 01 - 1º ANO - CRIANÇAS | Bairro: Messejana - Rua Tiradentes 400',
    'Helena Costa Barros', '85992345678', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E F M Tiradentes%' OR nome ILIKE '%Tiradentes%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-04', 'manha', '07:00', 'adolescentes',
    26, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 07 - 7º ANO - ADOLESCENTES | Bairro: Messejana - Rua Tiradentes 400',
    'Roberto Carlos de Araujo', '85983456789', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Dom Lustosa%' OR nome ILIKE '%Dom Lustosa%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-05', 'manha', '07:00', 'jovens',
    21, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 10 - 2º ANO MÉDIO - JOVENS | Bairro: Centro - Rua Dom Lustosa 200',
    'Patricia Nunes de Souza', '85994567890', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Dom Lustosa%' OR nome ILIKE '%Dom Lustosa%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-06', 'manha', '07:00', 'criancas',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 04 - 4º ANO - CRIANÇAS | Bairro: Centro - Rua Dom Lustosa 200',
    'Renata Cabral de Aquino', '85985678901', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%C E P M Lagoa Redonda%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-06', 'tarde', '13:00', 'adolescentes',
    30, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 08 - 8º ANO - ADOLESCENTES | Bairro: Lagoa Redonda - Av. Desembargador Moreira 500',
    'Francisco das Chagas Brandao', '85998765432', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Jose Garcez%' OR nome ILIKE '%José Garcez%' OR nome ILIKE '%Jose Garcez%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-10', 'manha', '07:00', 'criancas',
    22, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 03 - 3º ANO - CRIANÇAS | Bairro: Centro - Rua José Garcez 150',
    'Claudia Regina da Silva', '85986789012', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Jose Garcez%' OR nome ILIKE '%José Garcez%' OR nome ILIKE '%Jose Garcez%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-11', 'manha', '07:00', 'jovens',
    20, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 09 - 3º ANO MÉDIO - JOVENS | Bairro: Centro - Rua José Garcez 150',
    'Edson Carlos Queiroz', '85987890123', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Praça Portugal%' OR nome ILIKE '%Praça Portugal%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-12', 'manha', '07:00', 'adolescentes',
    28, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 07 - 6º ANO - ADOLESCENTES | Bairro: Praça Portugal - Rua da Praça 50',
    'Josefa Maria da Conceicao', '85982345678', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Praça Portugal%' OR nome ILIKE '%Praça Portugal%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-13', 'manha', '07:00', 'criancas',
    24, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 02 - 2º ANO - CRIANÇAS | Bairro: Praça Portugal - Rua da Praça 50',
    'Maria de Lourdes Ferreira', '85993456789', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F José de Alencar%' OR nome ILIKE '%José de Alencar%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-17', 'manha', '07:00', 'jovens',
    18, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 09 - 2º ANO MÉDIO - JOVENS | Bairro: Centro - Av. Dom Manuel 300',
    'Carlos Alberto Mendonca', '85984567890', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F José de Alencar%' OR nome ILIKE '%José de Alencar%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-18', 'manha', '07:00', 'criancas',
    26, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 01 - 1º ANO - CRIANÇAS | Bairro: Centro - Av. Dom Manuel 300',
    'Ana Claudia Rodrigues', '85995678901', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E P M Deputado Paulelo%' OR nome ILIKE '%Deputado Paulelo%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-19', 'manha', '07:00', 'adolescentes',
    23, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 06 - 6º ANO - ADOLESCENTES | Bairro: Parangaba - Rua Deputado Paulelo 800',
    'Veronica Lopes Martins', '85996789012', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E P M Deputado Paulelo%' OR nome ILIKE '%Deputado Paulelo%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-20', 'manha', '07:00', 'jovens',
    20, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 10 - 3º ANO MÉDIO - JOVENS | Bairro: Parangaba - Rua Deputado Paulelo 800',
    'Teresa Cristina Cavalcante', '85997890123', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Roger%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-24', 'manha', '07:00', 'criancas',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 03 - 1º ANO - CRIANÇAS | Bairro: Roger - Av. Bezerra de Menezes 600',
    'Francisco de Assis Brasil', '85998901234', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%E E I E F Roger%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-25', 'manha', '07:00', 'adolescentes',
    27, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 08 - 8º ANO - ADOLESCENTES | Bairro: Roger - Av. Bezerra de Menezes 600',
    'Sandra Maria Pinheiro', '85989012345', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%GEÍSA FIRMO GONÇALVES%' OR nome ILIKE '%Geisa Firmo%' OR nome ILIKE '%GEISA FIRMO%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-26', 'manha', '07:00', 'criancas',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Costa Lopes T. E. L. E. F. O. N. E.',
    'Marcondes', '85997303394', 'confirmado', NOW()
  ),
  (
    COALESCE(
      (SELECT id FROM instituicoes WHERE nome ILIKE '%GEÍSA FIRMO GONÇALVES%' OR nome ILIKE '%Geisa Firmo%' OR name ILIKE '%GEISA FIRMO%' LIMIT 1),
      '00000000-0000-0000-0000-000000000001'
    ),
    '2026-11-27', 'tarde', '13:00', 'criancas',
    25, 2, 0, 'onibus_detran',
    'Importado da planilha NOV/2026 | Turma: 3° ANO FUNDAMENTAL | Bairro: PLANALTO AYRTON SENNA',
    'Eliane Sousa', '85988667832', 'confirmado', NOW()
  )
;

-- Total: 40 agendamentos (excluindo feriados/finais de semana)

-- Verificação:
SELECT a.id, a.data, a.turno, i.nome as escola, a.status 
FROM agendamentos a 
LEFT JOIN instituicoes i ON i.id = a.instituicao_id 
ORDER BY a.data, a.turno;

-- Escolas não vinculadas (usaram o fallback):
SELECT * FROM agendamentos WHERE instituicao_id = '00000000-0000-0000-0000-000000000001';
