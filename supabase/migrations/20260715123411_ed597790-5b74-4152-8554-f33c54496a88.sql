
CREATE OR REPLACE FUNCTION public.notify_new_supplier_registered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    '/agency/' || NEW.agency_id::text || '/suppliers'
  );

  RETURN NEW;
END;
$function$;

WITH single_agency AS (
  SELECT user_id, (array_agg(DISTINCT agency_id))[1] AS agency_id
  FROM public.user_agency_access
  WHERE suspended = false
  GROUP BY user_id
  HAVING COUNT(DISTINCT agency_id) = 1
)
UPDATE public.notifications n
SET action_url = '/agency/' || sa.agency_id::text || '/suppliers'
FROM single_agency sa
WHERE n.action_url = '/agency/suppliers'
  AND n.user_id = sa.user_id;

DELETE FROM public.notifications
WHERE action_url = '/agency/suppliers';
