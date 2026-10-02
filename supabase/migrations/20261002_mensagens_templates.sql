CREATE TABLE IF NOT EXISTS mensagens_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  titulo TEXT NOT NULL,
  assunto TEXT,
  corpo TEXT NOT NULL,
  canal TEXT NOT NULL CHECK (canal IN ('email','whatsapp','os_pdf','certificado','pdf_lista','sms')),
  gatilho TEXT CHECK (gatilho IN ('confirmacao','cancelamento','lembrete','os_emitida','revisao','ocorrencia','custom')),
  variaveis TEXT[] DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE mensagens_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on templates" ON mensagens_templates;
CREATE POLICY "Admin full access on templates" ON mensagens_templates FOR ALL USING (true);

DROP POLICY IF EXISTS "Anyone can read active templates" ON mensagens_templates;
CREATE POLICY "Anyone can read active templates" ON mensagens_templates FOR SELECT USING (ativo = true);

-- Seed data with current hardcoded messages
INSERT INTO mensagens_templates (chave, titulo, assunto, corpo, canal, gatilho, variaveis) VALUES
('confirmacao_email', 'Confirmação de Visita (E-mail)', '[DETRAN-CE] Confirmação de Visita – {escola} – {data}', 'Olá {responsavel}!

A Escola de Trânsito do DETRAN-CE confirma o agendamento de visita:

🏫 Escola: {escola}
📅 Data: {data} às {hora}
📍 Endereço: {endereco}
🔔 Status: {status}
🚌 Transporte: {transporte}

📞 Contato: (85) 98135-9276 (WhatsApp) / (85) 3106-4711
📧 E-mail: escoladetransito@detran.ce.gov.br', 'email', 'confirmacao', ARRAY['escola','data','hora','endereco','status','transporte','responsavel']),

('confirmacao_whatsapp', 'Confirmação de Visita (WhatsApp)', NULL, 'Olá {responsavel}! 👋

A *Escola de Trânsito do DETRAN-CE* confirma o agendamento de visita:

🏫 Escola: {escola}
📅 Data: {data} às {hora}
📍 Endereço: {endereco}
🔔 Status: {status}
🚌 Transporte: {transporte}

📞 Contato: (85) 98135-9276 (WhatsApp)', 'whatsapp', 'confirmacao', ARRAY['escola','data','hora','endereco','status','transporte','responsavel']),

('os_corpo_email', 'OS Corpo (E-mail)', 'DETRAN-CE – Ordem de Serviço nº {os_numero}/{ano}', 'DETRAN-CE — Ordem de Serviço nº {os_numero}/{ano} – {mes_extenso}

{unidade}

Do Núcleo Pedagógico de Educação para o Trânsito – NUPET/DETRAN/CE
À Empresa {empresa}
End.: {empresa_endereco} • Fone: {empresa_fone}

{cidade}, {data_inicio_ext}

Solicitamos a {empresa}, com sede na {empresa_endereco}, inscrita no CNPJ/MF sob o N° {empresa_cnpj}, Tel: {empresa_fone}, disponibilizar ônibus executivo rodoviário, de acordo com o Contrato {contrato}, para prestação de serviços de transporte de alunos e professores para as atividades das escolas de trânsito, referente ao período de {periodo}.

{rotas_texto}', 'email', 'os_emitida', ARRAY['os_numero','ano','mes_extenso','unidade','empresa','empresa_endereco','empresa_fone','empresa_cnpj','contrato','cidade','data_inicio_ext','periodo','rotas_texto']),

('lista_presenca_cabecalho', 'Lista de Presença - Cabeçalho', NULL, 'LISTA DE PRESENÇA

Ordem de Serviço: OS {os_numero}/{ano}
Data: {data} – Turno: {turno}
Escola: {escola}
Endereço: {endereco}

Previstos: {pax_previstos} participantes', 'pdf_lista', 'confirmacao', ARRAY['os_numero','ano','data','turno','escola','endereco','pax_previstos'])
ON CONFLICT (chave) DO NOTHING;
