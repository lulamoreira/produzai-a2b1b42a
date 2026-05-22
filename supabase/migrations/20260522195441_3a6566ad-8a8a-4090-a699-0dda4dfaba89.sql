-- Create a new migration to extend the messages system
-- The system previously used 'system_messages' but the new system uses 'messages'
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_messages') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    ALTER TABLE public.system_messages RENAME TO messages;
    
    -- Rename constraints and indexes to match new table name if they exist
    IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE c.conname = 'system_messages_pkey' AND t.relname = 'messages') THEN
      ALTER TABLE public.messages RENAME CONSTRAINT system_messages_pkey TO messages_pkey;
    END IF;
  END IF;
END $$;

-- If 'messages' still doesn't exist, create it from scratch
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure we have a simple UNIQUE(key) constraint for ON CONFLICT to work
-- Drop old complex constraints/indexes if they exist
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS system_messages_key_agency_id_key;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_key_agency_id_key;
DROP INDEX IF EXISTS public.system_messages_key_global_unique;
DROP INDEX IF EXISTS public.messages_key_global_unique;

-- Add simple unique index on key if it doesn't already have a unique constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_key_key') THEN
        ALTER TABLE public.messages ADD CONSTRAINT messages_key_key UNIQUE (key);
    END IF;
END $$;

-- Extend messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'ui',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS content_pt_br TEXT,
  ADD COLUMN IF NOT EXISTS content_en TEXT,
  ADD COLUMN IF NOT EXISTS content_es TEXT,
  ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_customized BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_translated_at TIMESTAMPTZ;

-- Add constraints separately to avoid issues if columns already existed
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_channel_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_channel_check CHECK (channel IN ('ui', 'email', 'whatsapp', 'push'));

-- Migrate existing categories that don't match the new list to 'general' before adding the check
UPDATE public.messages 
SET category = 'general' 
WHERE category NOT IN ('auth','campaign','invite','scheduling','occurrence','approval','rateio','general','error','validation');

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_category_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_category_check CHECK (category IN ('auth','campaign','invite','scheduling','occurrence','approval','rateio','general','error','validation'));

-- Migrate existing content to content_pt_br
UPDATE public.messages SET content_pt_br = content WHERE content_pt_br IS NULL AND content IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_key ON public.messages(key);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel);
CREATE INDEX IF NOT EXISTS idx_messages_category ON public.messages(category);

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_messages" ON public.messages;
CREATE POLICY "authenticated_read_messages"
ON public.messages FOR SELECT TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "admins_manage_messages" ON public.messages;
CREATE POLICY "admins_manage_messages"
ON public.messages FOR ALL TO authenticated
USING (public.is_admin_or_master(auth.uid()));

-- Seed initial messages
INSERT INTO public.messages (key, name, description, channel, category, content_pt_br, content_en, content_es, is_customized, is_active)
VALUES
  ('ui_auth_login_error','Erro de login','Email ou senha incorretos','ui','auth','Email ou senha incorretos.','Incorrect email or password.','Email o contraseña incorrectos.',false,true),
  ('ui_auth_recovery_sent','Recuperação enviada','Confirmação de recuperação de senha','ui','auth','Email de recuperação enviado! Verifique sua caixa de entrada.','Recovery email sent! Check your inbox.','¡Email de recuperación enviado!',false,true),
  ('ui_auth_signup_success','Conta criada','Confirmação após criar conta via convite','ui','auth','Conta criada com sucesso! Faça login para continuar.','Account created! Please log in.','¡Cuenta criada! Inicia sesión.',false,true),
  ('ui_invite_sent','Convite enviado','Toast após criar convite','ui','invite','Convite criado! Seu cliente de email foi aberto.','Invite created! Your email client has been opened.','¡Invitación creada!',false,true),
  ('email_invite_subject','Assunto do convite','Assunto do email de convite','email','invite','Você foi convidado para o {{platformName}}','You have been invited to {{platformName}}','Fuiste invitado a {{platformName}}',false,true),
  ('ui_campaign_created','Campanha criada','Toast ao criar campanha','ui','campaign','Campanha "{{campaignName}}" criada com sucesso!','Campaign "{{campaignName}}" created!','¡Campaña "{{campaignName}}" creada!',false,true),
  ('ui_campaign_updated','Campanha atualizada','Toast ao editar campanha','ui','campaign','Campanha atualizada com sucesso!','Campaign updated!','¡Campaña actualizada!',false,true),
  ('ui_campaign_deactivated','Campanha inativada','Toast ao inativar campanha','ui','campaign','Campanha inativada com sucesso.','Campaign deactivated.','Campaña desactivada.',false,true),
  ('ui_approval_approved','Aprovação concedida','Toast ao aprovar instalação','ui','approval','Instalação aprovada!','Installation approved!','¡Instalación aprovada!',false,true),
  ('ui_approval_rejected','Aprovação rejeitada','Toast ao rejeitar instalação','ui','approval','Instalação rejeitada.','Installation rejected.','Instalación rechazada.',false,true),
  ('whatsapp_approval_request','Aprovação via WhatsApp','Mensagem WhatsApp de aprovação','whatsapp','approval','✅ *Aprovação necessária*\n\nLoja: {{storeName}}\nCampanha: {{campaignName}}\nData: {{date}}\n\nAprovar: {{approvalUrl}}','✅ *Approval needed*\n\nStore: {{storeName}}\nCampaign: {{campaignName}}\nDate: {{date}}\n\nApprove: {{approvalUrl}}','✅ *Aprobación necesaria*\n\nTienda: {{storeName}}\nCampaña: {{campaignName}}\nFecha: {{date}}\n\nAprobar: {{approvalUrl}}',false,true),
  ('ui_occurrence_registered','Ocorrência registrada','Toast ao registrar ocorrência','ui','occurrence','Ocorrência registrada com sucesso!','Occurrence registered!','¡Ocurrencia registrada!',false,true),
  ('whatsapp_occurrence_new','Nova ocorrência (WhatsApp)','Notificação WhatsApp de ocorrência','whatsapp','occurrence','⚠️ *Nova Ocorrência*\n\nLoja: {{storeName}}\nTipo: {{occurrenceType}}\nCampanha: {{campaignName}}','⚠️ *New Occurrence*\n\nStore: {{storeName}}\nType: {{occurrenceType}}\nCampaign: {{campaignName}}','⚠️ *Nueva Ocurrencia*\n\nTienda: {{storeName}}\nTipo: {{occurrenceType}}\nCampaña: {{campaignName}}',false,true),
  ('ui_scheduling_saved','Agendamento salvo','Toast ao salvar agendamento','ui','scheduling','Agendamento salvo com sucesso!','Schedule saved!','¡Agendamiento guardado!',false,true),
  ('whatsapp_scheduling_confirmed','Agendamento confirmado','WhatsApp de agendamento','whatsapp','scheduling','📅 *Agendamento Confirmado*\n\nLoja: {{storeName}}\nData: {{date}}\nHorário: {{time}}\nEquipe: {{team}}','📅 *Schedule Confirmed*\n\nStore: {{storeName}}\nDate: {{date}}\nTime: {{time}}\nTeam: {{team}}','📅 *Agendamiento Confirmado*\n\nTienda: {{storeName}}\nFecha: {{date}}\nHorario: {{time}}\nEquipo: {{team}}',false,true),
  ('ui_rateio_saved','Rateio salvo','Toast ao salvar rateio','ui','rateio','Rateio salvo com sucesso!','Rateio saved!','¡Rateio guardado!',false,true),
  ('ui_rateio_automation_done','Automação concluída','Toast após automação de matriz','ui','rateio','Automação de matriz concluída!','Matrix automation completed!','¡Automatización completada!',false,true),
  ('ui_error_generic','Erro genérico','Erro padrão do sistema','ui','error','Algo deu errado. Tente novamente.','Something went wrong. Please try again.','Algo salió mal. Intenta de nuevo.',false,true),
  ('ui_error_permission','Sem permissão','Ação sem permissão','ui','error','Você não tem permissão para esta ação.','You do not have permission for this action.','No tienes permiso para esta acción.',false,true),
  ('ui_error_not_found','Não encontrado','Registro não existe','ui','error','Registro não encontrado.','Record not found.','Registro no encontrado.',false,true)
ON CONFLICT (key) DO NOTHING;