CREATE OR REPLACE FUNCTION public.import_campaign_execution(p_source_campaign_id uuid, p_target_campaign_id uuid, p_schedules boolean DEFAULT true, p_photos boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client uuid; v_source_client uuid; v_team public.installation_teams%ROWTYPE;
  v_schedule public.campaign_schedules%ROWTYPE; v_copy public.campaign_schedules%ROWTYPE;
  v_team_id uuid; v_id uuid; v_team_map jsonb := '{}'; v_schedule_map jsonb := '{}';
  v_existing_stores uuid[]; v_imported int := 0; v_skipped int := 0; v_created int := 0; v_reused int := 0; v_photos int := 0;
  v_previous_setting text := current_setting('app.execution_import', true);
BEGIN
  IF auth.uid() IS NULL OR p_source_campaign_id IS NULL OR p_target_campaign_id IS NULL OR p_source_campaign_id = p_target_campaign_id THEN
    RAISE EXCEPTION 'Escolha outra campanha de origem.';
  END IF;
  IF p_schedules IS NULL OR p_photos IS NULL OR NOT (p_schedules OR p_photos) THEN RAISE EXCEPTION 'Selecione o que importar.'; END IF;
  IF NOT public.has_campaign_access(auth.uid(), p_source_campaign_id) OR NOT public.has_campaign_access(auth.uid(), p_target_campaign_id) THEN RAISE EXCEPTION 'Sem acesso às campanhas.'; END IF;
  SELECT client_id INTO v_client FROM public.campaigns WHERE id=p_target_campaign_id;
  SELECT client_id INTO v_source_client FROM public.campaigns WHERE id=p_source_campaign_id;
  IF v_client IS NULL OR v_source_client IS DISTINCT FROM v_client THEN RAISE EXCEPTION 'As campanhas devem pertencer ao mesmo cliente.'; END IF;
  IF NOT public.has_campaign_category_permission(auth.uid(), p_source_campaign_id, 'view_schedules') OR NOT public.has_campaign_category_permission(auth.uid(), p_target_campaign_id, 'edit_schedules') THEN RAISE EXCEPTION 'Sem permissão para importar agendamentos.'; END IF;
  IF p_photos AND (NOT public.has_campaign_category_permission(auth.uid(), p_source_campaign_id, 'view_installations') OR NOT public.has_campaign_category_permission(auth.uid(), p_target_campaign_id, 'edit_installations')) THEN RAISE EXCEPTION 'Sem permissão para importar instalações.'; END IF;
  -- Serialize imports and regular writes so the skip check cannot race an insert.
  LOCK TABLE public.campaign_schedules, public.installation_teams, public.installation_photos IN SHARE ROW EXCLUSIVE MODE;
  SELECT coalesce(array_agg(DISTINCT store_id), ARRAY[]::uuid[]) INTO v_existing_stores FROM public.campaign_schedules WHERE campaign_id=p_target_campaign_id;
  IF p_schedules THEN
    FOR v_team IN SELECT * FROM public.installation_teams WHERE campaign_id=p_source_campaign_id ORDER BY id LOOP
      SELECT id INTO v_team_id FROM public.installation_teams WHERE campaign_id=p_target_campaign_id AND name=v_team.name ORDER BY created_at,id LIMIT 1;
      IF v_team_id IS NULL THEN
        v_team_id := gen_random_uuid();
        INSERT INTO public.installation_teams (id,campaign_id,name,coverage_scope,coverage_values) VALUES (v_team_id,p_target_campaign_id,v_team.name,v_team.coverage_scope,v_team.coverage_values);
        INSERT INTO public.installation_team_members (team_id,name,rg,cpf,phone,is_unified_doc,is_leader) SELECT v_team_id,name,rg,cpf,phone,is_unified_doc,is_leader FROM public.installation_team_members WHERE team_id=v_team.id;
        INSERT INTO public.installation_team_vehicles (team_id,name,brand,color,plate) SELECT v_team_id,name,brand,color,plate FROM public.installation_team_vehicles WHERE team_id=v_team.id;
        v_created := v_created+1;
      ELSE v_reused := v_reused+1; END IF;
      v_team_map := v_team_map || jsonb_build_object(v_team.id::text,v_team_id);
    END LOOP;
  END IF;
  -- All IDs are assigned before insertion to keep reinstallation parents local.
  SELECT coalesce(jsonb_object_agg(s.id::text,gen_random_uuid()),'{}'::jsonb) INTO v_schedule_map FROM public.campaign_schedules s JOIN public.client_stores st ON st.id=s.store_id AND st.client_id=v_client WHERE s.campaign_id=p_source_campaign_id AND NOT (s.store_id=ANY(v_existing_stores));
  PERFORM set_config('app.execution_import', 'true', true);
  FOR v_schedule IN SELECT s.* FROM public.campaign_schedules s JOIN public.client_stores st ON st.id=s.store_id AND st.client_id=v_client WHERE s.campaign_id=p_source_campaign_id AND (p_photos OR coalesce(s.reinstall_seq,0)=0) ORDER BY coalesce(s.reinstall_seq,0),s.id LOOP
    IF v_schedule.store_id=ANY(v_existing_stores) THEN v_skipped:=v_skipped+1; CONTINUE; END IF;
    v_copy := v_schedule;
    v_copy.id := (v_schedule_map->>v_schedule.id::text)::uuid;
    v_copy.campaign_id := p_target_campaign_id;
    v_copy.team_id := CASE WHEN p_schedules THEN (v_team_map->>v_schedule.team_id::text)::uuid ELSE NULL END;
    v_copy.created_at:=now(); v_copy.updated_at:=now();
    v_copy.install_code:=NULL; v_copy.install_code_generated_at:=NULL; v_copy.install_code_expires_at:=NULL; v_copy.code_sent_at:=NULL;
    v_copy.parent_installation_id:=CASE WHEN p_photos THEN (v_schedule_map->>v_schedule.parent_installation_id::text)::uuid ELSE NULL END;
    IF NOT p_photos THEN
      v_copy.completed_at:=NULL; v_copy.completed_by:=NULL; v_copy.locked:=false;
      v_copy.photo_checkin:=false; v_copy.photo_checkin_at:=NULL;
      v_copy.checkin_lat:=NULL; v_copy.checkin_lng:=NULL; v_copy.checkin_accuracy:=NULL; v_copy.checkin_timestamp:=NULL; v_copy.checkin_device_info:=NULL;
      v_copy.manual_checkin_at:=NULL; v_copy.manual_checkin_by:=NULL; v_copy.manual_checkin_by_name:=NULL;
      v_copy.manual_checkout_at:=NULL; v_copy.manual_checkout_by:=NULL; v_copy.manual_checkout_by_name:=NULL;
      v_copy.reinstall_seq:=0; v_copy.reinstall_reason:=NULL;
    END IF;
    IF NOT p_schedules THEN
      v_copy.scheduled_date:=NULL; v_copy.scheduled_time:=NULL; v_copy.installation_os:=NULL; v_copy.installation_preference:='not_informed';
      v_copy.store_approved:=false; v_copy.team_approved:=false; v_copy.store_approved_at:=NULL; v_copy.team_approved_at:=NULL;
      v_copy.store_approval_status:='under_review'; v_copy.team_approval_status:='under_review'; v_copy.responsibility:='team'; v_copy.responsibility_at:=NULL;
      v_copy.suggested_date:=NULL; v_copy.suggested_time:=NULL; v_copy.suggested_date_2:=NULL; v_copy.suggested_time_2:=NULL;
      v_copy.reschedule_enabled:=false; v_copy.reschedule_date:=NULL; v_copy.reschedule_time:=NULL; v_copy.reschedule_os:=NULL; v_copy.reschedule_preference:='not_informed';
      v_copy.reschedule_store_approval_status:='under_review'; v_copy.reschedule_store_approved_at:=NULL; v_copy.reschedule_team_approval_status:='under_review'; v_copy.reschedule_team_approved_at:=NULL;
      v_copy.reschedule_responsibility:=NULL; v_copy.reschedule_responsibility_at:=NULL; v_copy.reschedule_suggested_date:=NULL; v_copy.reschedule_suggested_time:=NULL; v_copy.reschedule_suggested_date_2:=NULL; v_copy.reschedule_suggested_time_2:=NULL;
    END IF;
    INSERT INTO public.campaign_schedules SELECT (v_copy).*;
    v_imported:=v_imported+1;
  END LOOP;
  PERFORM set_config('app.execution_import', coalesce(v_previous_setting,''), true);
  IF p_photos THEN
    INSERT INTO public.installation_photos (id,campaign_id,store_id,photo_url,category,caption,created_at,uploaded_by,upload_method,media_type,reinstall_seq)
    SELECT gen_random_uuid(),p_target_campaign_id,p.store_id,p.photo_url,p.category,p.caption,p.created_at,p.uploaded_by,p.upload_method,p.media_type,p.reinstall_seq
    FROM public.installation_photos p JOIN public.client_stores st ON st.id=p.store_id AND st.client_id=v_client
    WHERE p.campaign_id=p_source_campaign_id AND NOT EXISTS (SELECT 1 FROM public.installation_photos d WHERE d.campaign_id=p_target_campaign_id AND d.store_id=p.store_id AND d.photo_url=p.photo_url AND coalesce(d.reinstall_seq,0)=coalesce(p.reinstall_seq,0));
    GET DIAGNOSTICS v_photos=ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('schedules_imported',v_imported,'schedules_skipped',v_skipped,'teams_created',v_created,'teams_reused',v_reused,'photos_imported',v_photos);
END; $$;
REVOKE ALL ON FUNCTION public.import_campaign_execution(uuid,uuid,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_campaign_execution(uuid,uuid,boolean,boolean) TO authenticated;

-- Keep explicit copied preferences rather than pulling a different campaign's defaults.
CREATE OR REPLACE FUNCTION public.copy_installation_preference_from_previous()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _client_id uuid; _prev_pref text;
BEGIN
  IF current_setting('app.execution_import',true)='true' THEN RETURN NEW; END IF;
  IF NEW.installation_preference IS NOT NULL AND NEW.installation_preference <> 'not_informed' THEN RETURN NEW; END IF;
  SELECT client_id INTO _client_id FROM public.campaigns WHERE id=NEW.campaign_id;
  IF _client_id IS NULL THEN RETURN NEW; END IF;
  SELECT cs.installation_preference INTO _prev_pref FROM public.campaign_schedules cs JOIN public.campaigns c ON c.id=cs.campaign_id WHERE c.client_id=_client_id AND cs.store_id=NEW.store_id AND cs.campaign_id<>NEW.campaign_id AND cs.installation_preference IS NOT NULL AND cs.installation_preference<>'not_informed' ORDER BY c.created_at DESC LIMIT 1;
  IF _prev_pref IS NOT NULL THEN NEW.installation_preference:=_prev_pref; END IF;
  RETURN NEW;
END; $$;

-- Global reference check is needed because copied photo records share immutable files.
CREATE OR REPLACE FUNCTION public.delete_installation_photo_record(p_photo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_photo public.installation_photos%ROWTYPE; v_unused boolean;
BEGIN
  SELECT * INTO v_photo FROM public.installation_photos WHERE id=p_photo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Foto não encontrada.'; END IF;
  IF auth.uid() IS NULL OR NOT public.has_campaign_access(auth.uid(),v_photo.campaign_id) OR NOT public.has_campaign_category_permission(auth.uid(),v_photo.campaign_id,'delete_installations') THEN RAISE EXCEPTION 'Sem permissão para excluir esta foto.'; END IF;
  LOCK TABLE public.installation_photos IN SHARE ROW EXCLUSIVE MODE;
  DELETE FROM public.installation_photos WHERE id=p_photo_id;
  SELECT NOT EXISTS(SELECT 1 FROM public.installation_photos WHERE photo_url=v_photo.photo_url) INTO v_unused;
  RETURN jsonb_build_object('photo_url',v_photo.photo_url,'remove_file',v_unused);
END; $$;
REVOKE ALL ON FUNCTION public.delete_installation_photo_record(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_installation_photo_record(uuid) TO authenticated;