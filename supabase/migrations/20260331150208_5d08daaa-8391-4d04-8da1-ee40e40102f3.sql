
CREATE TABLE public.system_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  category text NOT NULL DEFAULT 'ui',
  content text NOT NULL DEFAULT '',
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(key, agency_id)
);

-- Create a partial unique index for global messages (agency_id IS NULL)
CREATE UNIQUE INDEX system_messages_key_global_unique ON public.system_messages (key) WHERE agency_id IS NULL;

ALTER TABLE public.system_messages ENABLE ROW LEVEL SECURITY;

-- Only admins can manage system messages
CREATE POLICY "Admins can manage system messages" ON public.system_messages
  FOR ALL TO authenticated
  USING (public.is_admin_or_master(auth.uid()))
  WITH CHECK (public.is_admin_or_master(auth.uid()));

-- All authenticated users can read messages (needed to display them)
CREATE POLICY "Authenticated users can read system messages" ON public.system_messages
  FOR SELECT TO authenticated
  USING (true);

-- Anon can read messages (needed for public pages like occurrence form)
CREATE POLICY "Anon can read system messages" ON public.system_messages
  FOR SELECT TO anon
  USING (true);

-- Seed default global messages
INSERT INTO public.system_messages (key, category, content) VALUES
  -- Blocking messages
  ('occurrence_period_closed', 'blocking', 'Infelizmente o período de inclusão de ocorrências terminou, procure contato através do WhatsApp ou e-mail.'),
  ('occurrence_period_closed_title', 'blocking', 'Período encerrado'),
  ('occurrence_no_period_configured', 'blocking', 'Infelizmente o período de inclusão de ocorrências ainda não foi configurado. Procure contato através do WhatsApp ou e-mail.'),
  
  -- Email messages
  ('email_occurrence_subject', 'email', 'Sua ocorrência teve uma atualização'),
  ('email_occurrence_new_banner', 'email', '🆕 Nova Ocorrência Registrada'),
  ('email_occurrence_status_banner', 'email', '🔄 Status Atualizado para: {status}'),
  ('email_occurrence_updated_banner', 'email', '✏️ Ocorrência Atualizada'),
  ('email_occurrence_footer', 'email', 'Este é um email automático do sistema de gestão de ocorrências.'),
  ('email_occurrence_button', 'email', '📋 Visualizar Ocorrência'),
  
  -- WhatsApp messages
  ('whatsapp_occurrence_link', 'whatsapp', 'Ocorrência: {url}'),
  ('whatsapp_occurrence_contact', 'whatsapp', 'Olá, tudo bem? Gostaríamos de falar sobre a sua ocorrência #{id} da Campanha "{campaign}", registrada em: {date}.'),
  ('whatsapp_store_contact', 'whatsapp', 'Olá, {name}, como vai?'),
  ('whatsapp_team_code', 'whatsapp', 'Olá {leader}, segue o código de acesso para a equipe *{team}* na campanha *{campaign}*:\n\n🔑 Código: *{code}*\n🔗 Link de acesso: {link}\n\nUse esse código para acessar o sistema e registrar as instalações.\nEm caso de dúvidas, entre em contato com a administração.'),
  
  -- UI messages
  ('ui_auth_login_error', 'ui', 'Email ou senha incorretos.'),
  ('ui_auth_signup_success', 'ui', 'Conta criada! Verifique seu email para confirmar.'),
  ('ui_auth_recovery_sent', 'ui', 'Email de recuperação enviado! Verifique sua caixa de entrada.'),
  ('ui_photo_sent', 'ui', 'Foto enviada!'),
  ('ui_code_generated', 'ui', 'Código gerado com sucesso!'),
  ('ui_code_copied', 'ui', 'Código copiado!'),
  ('ui_user_deleted', 'ui', 'Usuário excluído!');
