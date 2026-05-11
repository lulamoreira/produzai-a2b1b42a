
CREATE OR REPLACE FUNCTION public.notify_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _name text;
  _agency uuid;
BEGIN
  -- Only notify on new pending profiles
  IF NEW.approval_status <> 'pending' THEN
    RETURN NEW;
  END IF;

  _name := COALESCE(NULLIF(NEW.display_name, ''), 'Novo usuário');

  -- Use profile agency if set, otherwise pick the first existing agency
  -- (admins always receive the notification regardless of agency_id).
  _agency := NEW.agency_id;
  IF _agency IS NULL THEN
    SELECT id INTO _agency FROM agencies ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF _agency IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.criar_notificacao(
    _agency,
    NULL,
    NULL,
    NEW.client_id,
    'novo_usuario_pendente',
    'Novo usuário aguardando aprovação',
    _name || ' se cadastrou e aguarda aprovação.',
    '/approvals'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_user_signup ON public.profiles;
CREATE TRIGGER trg_notify_new_user_signup
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_user_signup();
