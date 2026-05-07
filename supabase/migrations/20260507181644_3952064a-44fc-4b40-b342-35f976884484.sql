-- Tabela de status de tratativa personalizáveis por cliente
CREATE TABLE public.lal_tratativa_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8C6F4E',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, value)
);

CREATE INDEX idx_lal_tratativa_statuses_client ON public.lal_tratativa_statuses(client_id, display_order);

ALTER TABLE public.lal_tratativa_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_lal_tratativa_statuses"
  ON public.lal_tratativa_statuses FOR SELECT TO authenticated
  USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "auth_insert_lal_tratativa_statuses"
  ON public.lal_tratativa_statuses FOR INSERT TO authenticated
  WITH CHECK (public.has_client_edit_access(auth.uid(), client_id));

CREATE POLICY "auth_update_lal_tratativa_statuses"
  ON public.lal_tratativa_statuses FOR UPDATE TO authenticated
  USING (public.has_client_edit_access(auth.uid(), client_id))
  WITH CHECK (public.has_client_edit_access(auth.uid(), client_id));

CREATE POLICY "auth_delete_lal_tratativa_statuses"
  ON public.lal_tratativa_statuses FOR DELETE TO authenticated
  USING (public.has_client_edit_access(auth.uid(), client_id));

-- Permitir leitura anônima para o portal público da loja resolver labels/cores
CREATE POLICY "anon_select_lal_tratativa_statuses"
  ON public.lal_tratativa_statuses FOR SELECT TO anon
  USING (true);

CREATE TRIGGER trg_lal_tratativa_statuses_updated_at
  BEFORE UPDATE ON public.lal_tratativa_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atualiza o trigger para considerar status personalizados marcados como is_resolved
CREATE OR REPLACE FUNCTION public.set_occurrence_resolved_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id UUID;
  v_is_resolved BOOLEAN := false;
BEGIN
  IF NEW.tratativa_status IS NOT NULL THEN
    SELECT c.client_id INTO v_client_id
    FROM public.campaigns c WHERE c.id = NEW.campaign_id;

    IF v_client_id IS NOT NULL THEN
      SELECT s.is_resolved INTO v_is_resolved
      FROM public.lal_tratativa_statuses s
      WHERE s.client_id = v_client_id AND s.value = NEW.tratativa_status
      LIMIT 1;
      v_is_resolved := COALESCE(v_is_resolved, false);
    END IF;

    -- Fallback para o valor histórico
    IF NEW.tratativa_status = 'resolvida' THEN
      v_is_resolved := true;
    END IF;
  END IF;

  IF v_is_resolved AND (OLD.tratativa_status IS DISTINCT FROM NEW.tratativa_status) THEN
    NEW.resolved_at = now();
  END IF;
  IF NOT v_is_resolved THEN
    NEW.resolved_at = NULL;
  END IF;
  RETURN NEW;
END;
$function$;