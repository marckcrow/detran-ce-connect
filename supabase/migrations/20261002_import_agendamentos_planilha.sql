-- ============================================================
-- IMPORTAÇÃO DE AGENDAMENTOS DA PLANILHA (Out/Nov 2026)
-- Fonte: PDFs da planilha de agendamento do DETRAN-CE Fortaleza
-- Extraído automaticamente + cruzado com tabela instituicoes
-- Gerado por script Python (pdfplumber)
-- =============================================================

-- Bloqueios e datas especiais (para referencia, NÃO inserir como agendamento):
-- FERIADOS: 02/11 (Finados), 12/10 (Nossa Senhora Aparecida), 20/11 (Consciência Negra), 27/10 (Servidor Público)
-- BLOQUEADOS: 09-12/11 (Treinamento educadores), 19/10 (Capacitação), 20/10 (Limpeza maquete)
-- FIM DE SEMANA: todos os sábados e domingos

-- Inserção dos agendamentos confirmados:
INSERT INTO agendamentos (instituicao_id, data, turno, horario, faixa_etaria,
  quantidade_alunos, quantidade_professores, quantidade_acompanhantes,
  transporte_status, observacoes, responsavel_nome, responsavel_whatsapp,
  status, created_at) VALUES

  (
    -- 1. Centro Educacional Arco Iris | 01/10/2026 manha | Vera Lucia de Sousa Fraga
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Centro Educacional Arco Iris%' LIMIT 1),  -- escola
    '2026-10-01',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Bela Vista - Rua Tres de Maio 1487',  -- observacoes
    'Vera Lucia de Sousa Fraga',  -- responsavel
    '85987354478',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 2. Centro Educacional Arco Iris | 02/10/2026 manha | Lucimar Coelho de Sousa
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Centro Educacional Arco Iris%' LIMIT 1),  -- escola
    '2026-10-02',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Rodolfo Teofilo Rua gustavo Braga,733',  -- observacoes
    'Lucimar Coelho de Sousa',  -- responsavel
    '85985536314',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 3. EMEIEF IRMÃ DULCE | 05/10/2026 manha | Priscila Holanda Nogueira
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EMEIEF IRMÃ DULCE%' LIMIT 1),  -- escola
    '2026-10-05',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 A 11 | Bairro: Rua B 100 CONJUNTO VIDA NOVA- FURNA DA ONÇA MARACANAÚ',  -- observacoes
    'Priscila Holanda Nogueira',  -- responsavel
    '085989624772',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 4. EMEIEF IRMÃ DULCE | 06/10/2026 manha | P r i s c i l a Holanda Nogueira
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EMEIEF IRMÃ DULCE%' LIMIT 1),  -- escola
    '2026-10-06',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 A 11 | Bairro: Rua B 100 CONJUNTO VIDA NOVA- FURNA DA ONÇA MARACANAÚ',  -- observacoes
    'P r i s c i l a Holanda Nogueira',  -- responsavel
    '085989624772',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 5. EEBM José Cabral de Araújo | 07/10/2026 manha | Renildes da Costa Lopes T E L E F O N E : 85997303394
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EEBM José Cabral de Araújo%' LIMIT 1),  -- escola
    '2026-10-07',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Rua Pedro Augusto, Sn, Guaiúba',  -- observacoes
    'Renildes da Costa Lopes T E L E F O N E : 85997303394',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 6. Centro Educacional Arco Iris | 08/10/2026 manha | Vera Lucia de Sousa Fraga T E L E FONE: 85987354478
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Centro Educacional Arco Iris%' LIMIT 1),  -- escola
    '2026-10-08',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Bela Vista - Rua Tres de Maio 1487',  -- observacoes
    'Vera Lucia de Sousa Fraga T E L E FONE: 85987354478',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 7. EM Rosa Amaro Cavalcante | 09/10/2026 manha | Karla Geane da Silva Bastos
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM Rosa Amaro Cavalcante%' LIMIT 1),  -- escola
    '2026-10-09',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Conjunto Esperança - Rua Alfredo Mamede, 1064',  -- observacoes
    'Karla Geane da Silva Bastos',  -- responsavel
    '8534596797',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 8. Centro Educacional Arco Iris | 01/10/2026 tarde | Vera Lucia de Sousa Fraga
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Centro Educacional Arco Iris%' LIMIT 1),  -- escola
    '2026-10-01',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Bela Vista - Rua Tres de Maio 1487',  -- observacoes
    'Vera Lucia de Sousa Fraga',  -- responsavel
    '85987354478',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 9. ESCOLA MUNICIPAL PROFESSOR JACINTO BOTELHO | 02/10/2026 tarde | NÃO INFORMADO
    (SELECT id FROM instituicoes WHERE nome ILIKE '%ESCOLA MUNICIPAL PROFESSOR JACINTO BOTELHO%' LIMIT 1),  -- escola
    '2026-10-02',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: MARAPONGA - RUA DR. RODRIGO CODES SANDOVAL 374',  -- observacoes
    'NÃO INFORMADO',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 10. Escola Municipal José Barros de Alencar | 06/10/2026 tarde | Marilandia Ferreira Colaço
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Escola Municipal José Barros de Alencar%' LIMIT 1),  -- escola
    '2026-10-06',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Paupina - Rua Gardenia S/N Paupina Messejana',  -- observacoes
    'Marilandia Ferreira Colaço',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 11. EEIEF RITA DE CASSIA BRASILEIRO PONTES | 07/10/2026 tarde | RAFAELA MOURA DE ALENCAR
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EEIEF RITA DE CASSIA BRASILEIRO PONTES%' LIMIT 1),  -- escola
    '2026-10-07',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: ARATURI - AVENIDA CENTRAL, 1112',  -- observacoes
    'RAFAELA MOURA DE ALENCAR',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 12. Centro Educacional Arco Iris | 08/10/2026 tarde | Vera Lucia de Sousa Fraga
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Centro Educacional Arco Iris%' LIMIT 1),  -- escola
    '2026-10-08',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Bela Vista - Rua Tres de Maio 1487',  -- observacoes
    'Vera Lucia de Sousa Fraga',  -- responsavel
    '85987354478',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 13. EEIEF RITA DE CASSIA BRASILEIRO PONTES | 09/10/2026 tarde | RAFAELA MOURA DE ALENCAR
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EEIEF RITA DE CASSIA BRASILEIRO PONTES%' LIMIT 1),  -- escola
    '2026-10-09',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: ARATURI - AVENIDA CENTRAL, 1112',  -- observacoes
    'RAFAELA MOURA DE ALENCAR',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 14. Iprede | 13/10/2026 manha | Joice Ferreira
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Iprede%' LIMIT 1),  -- escola
    '2026-10-13',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 5 - 11 | Bairro: rua 13 n.605 maracanau',  -- observacoes
    'Joice Ferreira',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 15. Colégio Torres Vasconcelos | 14/10/2026 manha | Meiriane Silva de Oliveira
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Colégio Torres Vasconcelos%' LIMIT 1),  -- escola
    '2026-10-14',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Conjunto São Cristóvão - Rua 107 número 77',  -- observacoes
    'Meiriane Silva de Oliveira',  -- responsavel
    '85981753069',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 16. Colégio Maria Trajano | 15/10/2026 manha | Emanuela Carvalho Bezerra
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Colégio Maria Trajano%' LIMIT 1),  -- escola
    '2026-10-15',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Messejana - Rua Coronel Matos Belo, 454',  -- observacoes
    'Emanuela Carvalho Bezerra',  -- responsavel
    '8534740675',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 17. EM FLORIVAL ALVES SERAINE | 16/10/2026 manha | WALERIA MARIA MUNIZ DE LIMA
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM FLORIVAL ALVES SERAINE%' LIMIT 1),  -- escola
    '2026-10-16',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: CANINDEZINHO - RUA ITATIAIA,1000',  -- observacoes
    'WALERIA MARIA MUNIZ DE LIMA',  -- responsavel
    '85991121175',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 18. Colégio Veras | 20/10/2026 manha | Francisca Leiliane
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Colégio Veras%' LIMIT 1),  -- escola
    '2026-10-20',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: RESPONSAVEL: Francisca Leiliane TELEFONE: 85984504306 | Bairro: Av. Valparaíso, 672 Jangurussu / Conj. Sítio São João FORTALEZA',  -- observacoes
    'Francisca Leiliane',  -- responsavel
    '85984504306',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 19. Iprede | 13/10/2026 tarde | Joice Ferreira
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Iprede%' LIMIT 1),  -- escola
    '2026-10-13',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 5 - 11 | Bairro: rua 13 n.605 maracanau',  -- observacoes
    'Joice Ferreira',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 20. Colégio Torres Vasconcelos | 14/10/2026 tarde | Meiriane Silva de Oliveira
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Colégio Torres Vasconcelos%' LIMIT 1),  -- escola
    '2026-10-14',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Conjunto São Cristóvão - Rua 107 número 77',  -- observacoes
    'Meiriane Silva de Oliveira',  -- responsavel
    '85981753069',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 21. Colégio Maria Trajano | 15/10/2026 tarde | Emanuela Carvalho Bezerra
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Colégio Maria Trajano%' LIMIT 1),  -- escola
    '2026-10-15',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Messejana - Rua Coronel Matos Belo, 454',  -- observacoes
    'Emanuela Carvalho Bezerra',  -- responsavel
    '8534740675',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 22. João Hildo de Carvalho Furtado | 16/10/2026 tarde | Cislene Alves dos Santos Leal
    (SELECT id FROM instituicoes WHERE nome ILIKE '%João Hildo de Carvalho Furtado%' LIMIT 1),  -- escola
    '2026-10-16',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Aracapè - RUA : Juvêncio Sales S/N',  -- observacoes
    'Cislene Alves dos Santos Leal',  -- responsavel
    '85992813045',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 23. EMTI FRANCISCA FERNANDES MAGALHAES | 21/10/2026 manha | ANGELA MARIA COSTA E SILVA
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EMTI FRANCISCA FERNANDES MAGALHAES%' LIMIT 1),  -- escola
    '2026-10-21',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: BONSUCESSO - RUA OLIVEIRA SOBRINHO, 1031',  -- observacoes
    'ANGELA MARIA COSTA E SILVA',  -- responsavel
    '85988218445',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 24. Escola Guadalajara | 23/10/2026 manha | Danielle Rodrigues Maia
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Escola Guadalajara%' LIMIT 1),  -- escola
    '2026-10-23',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Parque Guadalajara - Rua Padre Alfredo Nesi, 620',  -- observacoes
    'Danielle Rodrigues Maia',  -- responsavel
    '85991393806',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 25. EM Adalberto Studart Filho | 26/10/2026 manha | Vera Lúcia Oliveira de Sousa
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM Adalberto Studart Filho%' LIMIT 1),  -- escola
    '2026-10-26',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: Planalto Ayrton Senna - Rua do Campo, 25',  -- observacoes
    'Vera Lúcia Oliveira de Sousa',  -- responsavel
    '85986246036',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 26. EM Professor Jacinto Botelho | 27/10/2026 manha | Juliana da Mota Ponte Matos
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM Professor Jacinto Botelho%' LIMIT 1),  -- escola
    '2026-10-27',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 a 11 anos | Bairro: Rua Doutor Rodrigo Codes Sandoval, 374 Mondubim FORT',  -- observacoes
    'Juliana da Mota Ponte Matos',  -- responsavel
    '85984582660',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 27. Centro de integração Psicossocial do Ceará | 29/10/2026 manha | Vilanir Pires
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Centro de integração Psicossocial do Ceará%' LIMIT 1),  -- escola
    '2026-10-29',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'adultos',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 12 a 18 | Bairro: Rua Oliveira Filho, 3320 Praia do futuro FORTALEZA',  -- observacoes
    'Vilanir Pires',  -- responsavel
    '85988582419',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 28. EM JOÃO NOGUIERA JUCÁ | 30/10/2026 manha | V A N D A L U C IA VASCONCELOS TOMAZ
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM JOÃO NOGUIERA JUCÁ%' LIMIT 1),  -- escola
    '2026-10-30',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: BAIRRO COAÇU - RUA B - CASA 10 - CONJUNTO ESPLANADA MESSEJANA',  -- observacoes
    'V A N D A L U C IA VASCONCELOS TOMAZ',  -- responsavel
    '85999824433',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 29. Colégio Lima Nogueira | 21/10/2026 tarde | Margila de sousa Lima
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Colégio Lima Nogueira%' LIMIT 1),  -- escola
    '2026-10-21',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: conjunto novo barroso - passaré - Alameda F, 16',  -- observacoes
    'Margila de sousa Lima',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 30. EM Professor Jacinto Botelho | 23/10/2026 tarde | Juliana da Mota Ponte Matos
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM Professor Jacinto Botelho%' LIMIT 1),  -- escola
    '2026-10-23',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 a 11 anos | Bairro: Rua Doutor Rodrigo Codes Sandoval, 374 Mondubim FORT',  -- observacoes
    'Juliana da Mota Ponte Matos',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 31. EM Adalberto Studart Filho | 26/10/2026 tarde | Vera Lúcia Oliveira de Sousa
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM Adalberto Studart Filho%' LIMIT 1),  -- escola
    '2026-10-26',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Bairro: Planalto Ayrton Senna - Rua do Campo, 25 T U R M A : 0 5 - 11 - CRIANÇAS RESPONSAVEL: Vera Lúcia Oliveira de Sousa TELEFONE: 85986246036',  -- observacoes
    'Vera Lúcia Oliveira de Sousa',  -- responsavel
    '85986246036',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 32. CEI ANTÔNIO RICARDO BARBOSA DE SOUSA | 27/10/2026 tarde | SUELY DE OLIVEIRA
    (SELECT id FROM instituicoes WHERE nome ILIKE '%CEI ANTÔNIO RICARDO BARBOSA DE SOUSA%' LIMIT 1),  -- escola
    '2026-10-27',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 a 11 | Bairro: Rua Irmã Irene, 60, Novo Maranguape 1 Maranguape',  -- observacoes
    'SUELY DE OLIVEIRA',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 33. EM DE TEMPO INTEGRAL MARIA ODETE DA SILVA COLARES | 29/10/2026 tarde | NÃO INFORMADO
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM DE TEMPO INTEGRAL MARIA ODETE DA SILVA COLARES%' LIMIT 1),  -- escola
    '2026-10-29',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'adultos',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 19 - 59 - ADULTOS | Bairro: MESSEJANA - AV. MINISTRO JOSÉ AMÉRICO, 80',  -- observacoes
    'NÃO INFORMADO',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 34. EM JOÃO NOGUIERA JUCÁ | 30/10/2026 tarde | VANDA LUCIA
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM JOÃO NOGUIERA JUCÁ%' LIMIT 1),  -- escola
    '2026-10-30',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha OUT/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: BAIRRO COAÇU - RUA B - CASA 10 - CONJUNTO ESPLANADA MESSEJANA',  -- observacoes
    'VANDA LUCIA',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 35. EMEIEF MANOEL RODRIGUES PINHEIRO DE MELO | 04/11/2026 manha | Adalmaria
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EMEIEF MANOEL RODRIGUES PINHEIRO DE MELO%' LIMIT 1),  -- escola
    '2026-11-04',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 5 a 11 | Bairro: Maracanaú',  -- observacoes
    'Adalmaria',  -- responsavel
    '85997495240',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 36. Escola José Cabral de Araújo | 06/11/2026 manha | Rafaela Lopes
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Escola José Cabral de Araújo%' LIMIT 1),  -- escola
    '2026-11-06',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 5 a 11 | Bairro: Guaiuba',  -- observacoes
    'Rafaela Lopes',  -- responsavel
    '85997303394',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 37. CEI ANTÔNIO RICARDO BARBOSA DE SOUSA | 13/11/2026 manha | SUELY
    (SELECT id FROM instituicoes WHERE nome ILIKE '%CEI ANTÔNIO RICARDO BARBOSA DE SOUSA%' LIMIT 1),  -- escola
    '2026-11-13',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: INF V 6 ANOS | Bairro: RUA IRMÃ IRENE, N° 60, NOVO MARANGUAPE CE, PX O PEDRO NTO DAS TOPIK',  -- observacoes
    'SUELY',  -- responsavel
    '85988848388',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 38. EM IVANILSON SOUZA LIMA | 05/11/2026 tarde | DENIS ROCHA
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM IVANILSON SOUZA LIMA%' LIMIT 1),  -- escola
    '2026-11-05',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 4° ANO | Bairro: ARACAPÉ - Rua Poliana, 100 - Aracapé, Fortaleza - CE, 60765-065 (AO LADO DO CRAS ARACAPÉ)',  -- observacoes
    'DENIS ROCHA',  -- responsavel
    '85996653305',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 39. EM IVANILSON SOUZA LIMA | 06/11/2026 tarde | DENIS ROCHA
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EM IVANILSON SOUZA LIMA%' LIMIT 1),  -- escola
    '2026-11-06',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 4° ANO | Bairro: ARACAPÉ - Rua Poliana, 100 - Aracapé, Fortaleza - CE, 60765-065 (AO LADO DO CRAS ARACAPÉ)',  -- observacoes
    'DENIS ROCHA',  -- responsavel
    '85996653305',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 40. CEI ANTÔNIO RICARDO BARBOSA DE SOUSA | 13/11/2026 tarde | SUELY
    (SELECT id FROM instituicoes WHERE nome ILIKE '%CEI ANTÔNIO RICARDO BARBOSA DE SOUSA%' LIMIT 1),  -- escola
    '2026-11-13',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: INF V 6 ANOS | Bairro: RUA IRMÃ IRENE, N° 60, NOVO MARANGUAPE CE, PX O PEDRO NTO DAS TOPIK',  -- observacoes
    'SUELY',  -- responsavel
    '85988848388',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 41. Cristiano Nunes de Melo | 16/11/2026 manha | Paula Lima
    (SELECT id FROM instituicoes WHERE nome ILIKE '%Cristiano Nunes de Melo%' LIMIT 1),  -- escola
    '2026-11-16',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 3° ao 9° ano | Bairro: Rodovia Raimundo Wilson N. Miranda, S/N (BR-020, KM 32), Bairro Feijão, Caucaia - CE, CEP 61688-990 Comunidade do Feijão',  -- observacoes
    'Paula Lima',  -- responsavel
    '85981892810',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 42. PROFESSORA MARIA JOSÉ MACÁRIO COELHO | 17/11/2026 manha | KARLA MARIANA MORALES BONILHA
    (SELECT id FROM instituicoes WHERE nome ILIKE '%PROFESSORA MARIA JOSÉ MACÁRIO COELHO%' LIMIT 1),  -- escola
    '2026-11-17',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 6CM | Bairro: PASSARÉ',  -- observacoes
    'KARLA MARIANA MORALES BONILHA',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 43. E M GEÍSA FIRMO GONÇALVES | 19/11/2026 manha | REGINA MARCIA
    (SELECT id FROM instituicoes WHERE nome ILIKE '%E M GEÍSA FIRMO GONÇALVES%' LIMIT 1),  -- escola
    '2026-11-19',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 3° ANO | Bairro: PLANALTO AYRTON SENNA, 1260 PROXIMO AO MERCADINHO AGUIAR.',  -- observacoes
    'REGINA MARCIA',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 44. EMEIF Geisa firmo Gonçalves | 26/11/2026 manha | Nídia Lima
    (SELECT id FROM instituicoes WHERE nome ILIKE '%EMEIF Geisa firmo Gonçalves%' LIMIT 1),  -- escola
    '2026-11-26',  -- data
    'manha',  -- turno
    '07:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 3 • ano C Manhã | Bairro: Planalto Ayrton Senna rua : Zuleica pontes 1260 Ponto de referência: Mercadinho Aguiar',  -- observacoes
    'Nídia Lima',  -- responsavel
    '85981238267',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 45. PROFESSORA MARIA JOSÉ MACÁRIO COELHO | 16/11/2026 tarde | KARLA MARIANA MORALES BONILHA
    (SELECT id FROM instituicoes WHERE nome ILIKE '%PROFESSORA MARIA JOSÉ MACÁRIO COELHO%' LIMIT 1),  -- escola
    '2026-11-16',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 6CM | Bairro: PASSARÉ',  -- observacoes
    'KARLA MARIANA MORALES BONILHA',  -- responsavel
    NULL,  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 46. E.M, JONATHAN DA ROCHA ALCOFORADO | 19/11/2026 tarde | FRANCISCA ELANIA PORFIRIO DE SOUZA
    (SELECT id FROM instituicoes WHERE nome ILIKE '%E.M, JONATHAN DA ROCHA ALCOFORADO%' LIMIT 1),  -- escola
    '2026-11-19',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 05 - 11 - CRIANÇAS | Bairro: ARACAPÉ - RUA MARIA GOMES DE SÁ, 1030',  -- observacoes
    'FRANCISCA ELANIA PORFIRIO DE SOUZA',  -- responsavel
    '85986508553',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 47. ESCOLA DE ENSINO MÉDIO HERÁCLITO DE CASTRO E SILVA Endereço:Rua Araripe Macêdo, 354 - Jóquei Clube, Fortaleza - CE, 60520-055 Esquina do super souza | 26/11/2026 tarde | Laila
    (SELECT id FROM instituicoes WHERE nome ILIKE '%ESCOLA DE ENSINO MÉDIO HERÁCLITO DE CASTRO E SILVA Endereço:Rua Araripe Macêdo, 354 - Jóquei Clube, Fortaleza - CE, 60520-055 Esquina do super souza%' LIMIT 1),  -- escola
    '2026-11-26',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 3o ano | Bairro: BAIRRO JOÃO XXIII',  -- observacoes
    'Laila',  -- responsavel
    '85997785923',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  ),
  (
    -- 48. GEÍSA FIRMO GONÇALVES | 27/11/2026 tarde | Eliane Sousa
    (SELECT id FROM instituicoes WHERE nome ILIKE '%GEÍSA FIRMO GONÇALVES%' LIMIT 1),  -- escola
    '2026-11-27',  -- data
    'tarde',  -- turno
    '13:00',  -- horario
    'criancas',  -- faixa_etaria
    25,  -- quantidade_alunos (padrão)
    2,  -- quantidade_professores (padrão)
    0,  -- quantidade_acompanhantes
    'onibus_detran',  -- transporte_status (padrão)
    'Importado da planilha NOV/2026 | Turma: 3° ANO FUNDAMENTAL | Bairro: PLANALTO AYRTON SENNA',  -- observacoes
    'Eliane Sousa',  -- responsavel
    '85988667832',  -- whatsapp
    'confirmado',  -- status (vindo da planilha oficial)
    NOW()
  )
;

-- Total: 48 agendamentos

-- NOTA: instituicao_id usa subquery para vincular pela escola cadastrada.
-- Escolas que não existem em 'instituicoes' terão NULL e precisam de correção manual.

-- Após inserir, rodar:
--   SELECT a.id, a.data, a.turno, i.nome as escola, a.status FROM agendamentos a LEFT JOIN instituicoes i ON i.id = a.instituicao_id ORDER BY a.data, a.turno;
