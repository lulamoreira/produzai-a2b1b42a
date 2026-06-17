
-- Trigger: notify when a new supplier is registered
CREATE OR REPLACE FUNCTION public.notify_new_supplier_registered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  IF NEW.agency_id IS NULL THEN
    RETURN NEW;
  END IF;

  _name := COALESCE(NULLIF(NEW.company_name, ''), 'Novo fornecedor');

  PERFORM public.criar_notificacao(
    NEW.agency_id,
    NULL,
    NULL,
    NULL,
    'novo_fornecedor_cadastrado',
    'Novo fornecedor cadastrado',
    _name || ' concluiu o cadastro como fornecedor.',
    '/agency/suppliers'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_supplier_registered ON public.agency_suppliers;
CREATE TRIGGER trg_notify_new_supplier_registered
AFTER INSERT ON public.agency_suppliers
FOR EACH ROW EXECUTE FUNCTION public.notify_new_supplier_registered();

-- Seed notification_settings for existing agencies for the new event type
INSERT INTO public.notification_settings (agency_id, event_type, role_scope, enabled)
SELECT a.id, 'novo_fornecedor_cadastrado', s.scope, s.enabled
FROM public.agencies a
CROSS JOIN (VALUES
  ('admin'::text, false),
  ('master_global'::text, true),
  ('master_cliente'::text, false),
  ('viewer'::text, false)
) AS s(scope, enabled)
ON CONFLICT DO NOTHING;

-- Update agency seeding function to include the new event type for future agencies
CREATE OR REPLACE FUNCTION public.seed_notification_settings_for_agency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notification_settings (agency_id, event_type, role_scope, enabled) VALUES
    (NEW.id,'ocorrencia_aberta','admin',false),(NEW.id,'instalacao_concluida','admin',false),
    (NEW.id,'checkin_realizado','admin',false),(NEW.id,'aprovacao_lojista','admin',false),
    (NEW.id,'recusa_lojista','admin',false),(NEW.id,'aprovacao_equipe','admin',false),
    (NEW.id,'recusa_equipe','admin',false),(NEW.id,'ocorrencia_resolvida','admin',false),
    (NEW.id,'novo_usuario_pendente','admin',false),(NEW.id,'orcamento_enviado','admin',true),
    (NEW.id,'novo_fornecedor_cadastrado','admin',false),
    (NEW.id,'ocorrencia_aberta','master_global',true),(NEW.id,'instalacao_concluida','master_global',true),
    (NEW.id,'checkin_realizado','master_global',true),(NEW.id,'aprovacao_lojista','master_global',true),
    (NEW.id,'recusa_lojista','master_global',true),(NEW.id,'aprovacao_equipe','master_global',true),
    (NEW.id,'recusa_equipe','master_global',true),(NEW.id,'ocorrencia_resolvida','master_global',true),
    (NEW.id,'novo_usuario_pendente','master_global',true),(NEW.id,'orcamento_enviado','master_global',true),
    (NEW.id,'novo_fornecedor_cadastrado','master_global',true),
    (NEW.id,'ocorrencia_aberta','master_cliente',true),(NEW.id,'instalacao_concluida','master_cliente',true),
    (NEW.id,'checkin_realizado','master_cliente',false),(NEW.id,'aprovacao_lojista','master_cliente',true),
    (NEW.id,'recusa_lojista','master_cliente',true),(NEW.id,'aprovacao_equipe','master_cliente',true),
    (NEW.id,'recusa_equipe','master_cliente',true),(NEW.id,'ocorrencia_resolvida','master_cliente',true),
    (NEW.id,'novo_usuario_pendente','master_cliente',true),(NEW.id,'orcamento_enviado','master_cliente',false),
    (NEW.id,'novo_fornecedor_cadastrado','master_cliente',false),
    (NEW.id,'ocorrencia_aberta','viewer',false),(NEW.id,'instalacao_concluida','viewer',false),
    (NEW.id,'checkin_realizado','viewer',false),(NEW.id,'aprovacao_lojista','viewer',false),
    (NEW.id,'recusa_lojista','viewer',false),(NEW.id,'aprovacao_equipe','viewer',false),
    (NEW.id,'recusa_equipe','viewer',false),(NEW.id,'ocorrencia_resolvida','viewer',false),
    (NEW.id,'novo_usuario_pendente','viewer',false),(NEW.id,'orcamento_enviado','viewer',false),
    (NEW.id,'novo_fornecedor_cadastrado','viewer',false);
  RETURN NEW;
END;
$function$;
