CREATE OR REPLACE FUNCTION public.bulk_update_occurrence_status(
  _campaign_id uuid,
  _occurrence_ids uuid[],
  _status text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_client_id uuid;
  v_is_resolved boolean := false;
  v_found boolean := false;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  -- Somente administradores e masters podem alterar status em lote
  IF NOT public.is_admin_or_master(v_uid) THEN
    RAISE EXCEPTION 'Somente administradores e masters podem alterar status em lote' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_campaign_access(v_uid, _campaign_id) THEN
    RAISE EXCEPTION 'Sem acesso a esta campanha' USING ERRCODE = '42501';
  END IF;
  IF _status IS NULL OR btrim(_status) = '' THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;
  IF _occurrence_ids IS NULL OR array_length(_occurrence_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  IF array_length(_occurrence_ids, 1) > 5000 THEN
    RAISE EXCEPTION 'Selecione no máximo 5000 ocorrências por vez' USING ERRCODE = '22023';
  END IF;

  SELECT c.client_id INTO v_client_id FROM public.campaigns c WHERE c.id = _campaign_id;

  SELECT true, COALESCE(s.is_resolved, false) INTO v_found, v_is_resolved
  FROM public.lal_tratativa_statuses s
  WHERE s.client_id = v_client_id AND s.value = _status AND s.ativo = true
  LIMIT 1;

  IF NOT COALESCE(v_found, false) THEN
    IF _status IN ('aberta', 'em_andamento', 'resolvida', 'nao_procede') THEN
      v_is_resolved := (_status = 'resolvida');
    ELSE
      RAISE EXCEPTION 'Status não configurado para este cliente' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.store_occurrence_reports r
  SET tratativa_status = _status,
      resolved_by_user_id = CASE WHEN v_is_resolved THEN v_uid ELSE NULL END
  WHERE r.campaign_id = _campaign_id
    AND r.id = ANY(_occurrence_ids)
    AND r.tratativa_status IS DISTINCT FROM _status;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_update_occurrence_status(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_occurrence_status(uuid, uuid[], text) TO authenticated;