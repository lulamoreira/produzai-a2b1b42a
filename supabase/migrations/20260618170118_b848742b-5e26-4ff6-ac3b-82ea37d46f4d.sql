
CREATE TABLE public.agency_supplier_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID,
  agency_id UUID,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  changed_by UUID,
  source TEXT NOT NULL DEFAULT 'app',
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agency_supplier_audit_log_supplier ON public.agency_supplier_audit_log(supplier_id, created_at DESC);
CREATE INDEX idx_agency_supplier_audit_log_agency ON public.agency_supplier_audit_log(agency_id, created_at DESC);

GRANT SELECT ON public.agency_supplier_audit_log TO authenticated;
GRANT ALL ON public.agency_supplier_audit_log TO service_role;

ALTER TABLE public.agency_supplier_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/master can view all supplier audit logs"
ON public.agency_supplier_audit_log
FOR SELECT TO authenticated
USING (public.is_admin_or_master(auth.uid()));

CREATE POLICY "Agency users can view their suppliers audit logs"
ON public.agency_supplier_audit_log
FOR SELECT TO authenticated
USING (
  agency_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_agency_access uaa
    WHERE uaa.user_id = auth.uid()
      AND uaa.agency_id = agency_supplier_audit_log.agency_id
      AND uaa.suspended = false
  )
);

CREATE OR REPLACE FUNCTION public.log_agency_supplier_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changed TEXT[] := ARRAY[]::TEXT[];
  v_old JSONB;
  v_new JSONB;
  v_key TEXT;
  v_source TEXT;
BEGIN
  v_source := CASE WHEN auth.uid() IS NULL THEN 'public_portal' ELSE 'app' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.agency_supplier_audit_log
      (supplier_id, agency_id, operation, changed_by, source, old_data, new_data)
    VALUES (NEW.id, NEW.agency_id, 'INSERT', auth.uid(), v_source, NULL, to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key NOT IN ('updated_at') AND v_old->v_key IS DISTINCT FROM v_new->v_key THEN
        v_changed := array_append(v_changed, v_key);
      END IF;
    END LOOP;

    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.agency_supplier_audit_log
      (supplier_id, agency_id, operation, changed_by, source, old_data, new_data, changed_fields)
    VALUES (NEW.id, NEW.agency_id, 'UPDATE', auth.uid(), v_source, v_old, v_new, v_changed);
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.agency_supplier_audit_log
      (supplier_id, agency_id, operation, changed_by, source, old_data, new_data)
    VALUES (OLD.id, OLD.agency_id, 'DELETE', auth.uid(), v_source, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_agency_supplier_audit ON public.agency_suppliers;
CREATE TRIGGER trg_agency_supplier_audit
AFTER INSERT OR UPDATE OR DELETE ON public.agency_suppliers
FOR EACH ROW EXECUTE FUNCTION public.log_agency_supplier_changes();
