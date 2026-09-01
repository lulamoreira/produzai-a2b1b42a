CREATE OR REPLACE FUNCTION public.clone_campaign_for_renegotiation(_source_campaign_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new uuid := gen_random_uuid();
  v_root uuid;
  v_seq int;
  v_label text;
  v_base text;
begin
  if not public.has_campaign_access(auth.uid(), _source_campaign_id) then
    raise exception 'Sem permissao para clonar esta campanha.';
  end if;
  if not exists (select 1 from campaigns where id = _source_campaign_id) then
    raise exception 'Campanha de origem nao encontrada.';
  end if;
  select coalesce(root_campaign_id, id) into v_root from campaigns where id = _source_campaign_id;
  select name into v_base from campaigns where id = v_root;
  select count(*) into v_seq from campaigns where root_campaign_id = v_root;
  v_seq := v_seq + 1;
  if v_seq = 1 then v_label := 'RENEGOCIAÇÃO INICIAL';
  else v_label := 'RENEGOCIAÇÃO ' || v_seq::text;
  end if;
  create temp table _mp(old_id uuid primary key, new_id uuid) on commit drop;
  create temp table _mk(old_id uuid primary key, new_id uuid) on commit drop;
  create temp table _ms(old_id uuid primary key, new_id uuid) on commit drop;
  create temp table _ml(old_id uuid primary key, new_id uuid) on commit drop;
  create temp table _mt(old_id uuid primary key, new_id uuid) on commit drop;
  create temp table _md(old_id uuid primary key, new_id uuid) on commit drop;
  create temp table _mteam(old_id uuid primary key, new_id uuid) on commit drop;
  create temp table _msch(old_id uuid primary key, new_id uuid) on commit drop;
  create temp table _mocc(old_id uuid primary key, new_id uuid) on commit drop;
  insert into campaigns (id, client_id, name, is_active, color, cover_images, display_order,
    access_days_after, access_days_before, access_hours_after, access_hours_before,
    access_ignore_date, access_ignore_time, occurrence_end_date, occurrence_start_date,
    piece_custom_field_1_label, piece_custom_field_2_label, piece_custom_field_3_label,
    piece_custom_field_4_label, piece_custom_field_5_label,
    parent_campaign_id, root_campaign_id, origin_label)
  select v_new, client_id, v_base || ' — ' || v_label, true, color, cover_images, display_order,
    access_days_after, access_days_before, access_hours_after, access_hours_before,
    access_ignore_date, access_ignore_time, occurrence_end_date, occurrence_start_date,
    piece_custom_field_1_label, piece_custom_field_2_label, piece_custom_field_3_label,
    piece_custom_field_4_label, piece_custom_field_5_label,
    _source_campaign_id, v_root, v_label
  from campaigns where id = _source_campaign_id;
  insert into _mp(old_id,new_id) select id, gen_random_uuid() from campaign_pieces where campaign_id=_source_campaign_id;
  insert into campaign_pieces (id, campaign_id, category, code, custom_field_1, custom_field_2, custom_field_3, custom_field_4, custom_field_5,
    deleted_at, display_order, image_full_url, image_hash, image_report_url, image_thumb_url, image_url,
    installation_instructions, is_deleted, is_mockup, is_new, kit_only, name, size, specification, store_category, sub_location)
  select m.new_id, v_new, p.category, p.code, p.custom_field_1, p.custom_field_2, p.custom_field_3, p.custom_field_4, p.custom_field_5,
    p.deleted_at, p.display_order, p.image_full_url, p.image_hash, p.image_report_url, p.image_thumb_url, p.image_url,
    p.installation_instructions, p.is_deleted, p.is_mockup, p.is_new, p.kit_only, p.name, p.size, p.specification, p.store_category, p.sub_location
  from campaign_pieces p join _mp m on m.old_id=p.id where p.campaign_id=_source_campaign_id;
  insert into _mk(old_id,new_id) select id, gen_random_uuid() from campaign_kits where campaign_id=_source_campaign_id;
  insert into campaign_kits (id, campaign_id, category, code, deleted_at, display_order, image_url, is_deleted, is_mockup, is_new, name, sub_location)
  select m.new_id, v_new, k.category, k.code, k.deleted_at, k.display_order, k.image_url, k.is_deleted, k.is_mockup, k.is_new, k.name, k.sub_location
  from campaign_kits k join _mk m on m.old_id=k.id where k.campaign_id=_source_campaign_id;
  insert into campaign_kit_pieces (id, kit_id, piece_id, quantity, display_order)
  select gen_random_uuid(), mk.new_id, mp.new_id, kp.quantity, kp.display_order
  from campaign_kit_pieces kp join _mk mk on mk.old_id=kp.kit_id join _mp mp on mp.old_id=kp.piece_id;
  insert into campaign_store_pieces (id, campaign_id, store_id, piece_id, quantity)
  select gen_random_uuid(), v_new, sp.store_id, mp.new_id, sp.quantity
  from campaign_store_pieces sp join _mp mp on mp.old_id=sp.piece_id where sp.campaign_id=_source_campaign_id;
  insert into campaign_store_status (id, campaign_id, store_id, enabled)
  select gen_random_uuid(), v_new, ss.store_id, ss.enabled
  from campaign_store_status ss where ss.campaign_id=_source_campaign_id;
  insert into _ms(old_id,new_id) select id, gen_random_uuid() from budget_suppliers where campaign_id=_source_campaign_id;
  insert into budget_suppliers (id, campaign_id, company_name, contact_name, email, phone, status, submitted_at,
    access_token, is_winner, locked, winner_locked_total, winner_declared_at,
    negotiation_locked_total, negotiation_status, negotiation_submitted_at, decline_reason, declined_at, invited_at)
  select m.new_id, v_new, s.company_name, s.contact_name, s.email, s.phone, s.status, s.submitted_at,
    gen_random_uuid()::text, false, false, null, null, null, null, null, null, null, now()
  from budget_suppliers s join _ms m on m.old_id=s.id where s.campaign_id=_source_campaign_id;
  insert into budget_prices (id, campaign_id, supplier_id, piece_id, kit_id, unit_price, adjusted_unit_price)
  select gen_random_uuid(), v_new, ms.new_id, mp.new_id, mk.new_id, bp.unit_price, bp.adjusted_unit_price
  from budget_prices bp join _ms ms on ms.old_id=bp.supplier_id
  left join _mp mp on mp.old_id=bp.piece_id left join _mk mk on mk.old_id=bp.kit_id
  where bp.campaign_id=_source_campaign_id;
  insert into budget_settings (id, campaign_id, budget_amount, currency_code, currency_locked, current_phase, deadline,
    negotiation_mode, negotiation_target, notify_user_ids, phase_locked_at, winner_book_url, winner_cc_email, winner_mockup_url)
  select gen_random_uuid(), v_new, budget_amount, currency_code, currency_locked, current_phase, deadline,
    negotiation_mode, negotiation_target, notify_user_ids, phase_locked_at, winner_book_url, winner_cc_email, winner_mockup_url
  from budget_settings where campaign_id=_source_campaign_id;
  insert into budget_timeline_entries (id, campaign_id, description, display_order, entry_date)
  select gen_random_uuid(), v_new, te.description, te.display_order, te.entry_date
  from budget_timeline_entries te where te.campaign_id=_source_campaign_id;
  insert into budget_extra_costs (id, supplier_id, installation_value, freight_value, adjusted_installation_value, adjusted_freight_value, discount_value, adjusted_discount_value)
  select gen_random_uuid(), ms.new_id, ec.installation_value, ec.freight_value, ec.adjusted_installation_value, ec.adjusted_freight_value, ec.discount_value, ec.adjusted_discount_value
  from budget_extra_costs ec join _ms ms on ms.old_id=ec.supplier_id;
  insert into _ml(old_id,new_id) select id, gen_random_uuid() from campaign_piece_locations where campaign_id=_source_campaign_id;
  insert into campaign_piece_locations (id, campaign_id, name)
  select m.new_id, v_new, l.name from campaign_piece_locations l join _ml m on m.old_id=l.id where l.campaign_id=_source_campaign_id;
  insert into campaign_piece_sub_locations (id, campaign_id, location_id, name)
  select gen_random_uuid(), v_new, ml.new_id, sl.name
  from campaign_piece_sub_locations sl join _ml ml on ml.old_id=sl.location_id where sl.campaign_id=_source_campaign_id;
  insert into _mt(old_id,new_id) select id, gen_random_uuid() from loja_a_loja_tipos where campaign_id=_source_campaign_id;
  insert into loja_a_loja_tipos (id, campaign_id, display_order, is_deleted, letra, nome, tem_subdivisao)
  select m.new_id, v_new, t.display_order, t.is_deleted, t.letra, t.nome, t.tem_subdivisao
  from loja_a_loja_tipos t join _mt m on m.old_id=t.id where t.campaign_id=_source_campaign_id;
  insert into _md(old_id,new_id) select id, gen_random_uuid() from loja_a_loja_subdivisoes where tipo_id in (select old_id from _mt);
  insert into loja_a_loja_subdivisoes (id, tipo_id, display_order, nome)
  select m.new_id, mt.new_id, sd.display_order, sd.nome
  from loja_a_loja_subdivisoes sd join _md m on m.old_id=sd.id join _mt mt on mt.old_id=sd.tipo_id;
  insert into loja_a_loja_pecas (id, campaign_id, tipo_id, subdivisao_id, display_order, image_url, nome)
  select gen_random_uuid(), v_new, mt.new_id, msd.new_id, lp.display_order, lp.image_url, lp.nome
  from loja_a_loja_pecas lp left join _mt mt on mt.old_id=lp.tipo_id left join _md msd on msd.old_id=lp.subdivisao_id
  where lp.campaign_id=_source_campaign_id;

  -- Loja a Loja: lojas vinculadas (store_id nunca remapeado)
  insert into loja_a_loja_lojas (id, campaign_id, store_id, tipo_id, subdivisao_id, ativo)
  select gen_random_uuid(), v_new, ll.store_id, mt.new_id, msd.new_id, ll.ativo
  from loja_a_loja_lojas ll
  left join _mt mt on mt.old_id = ll.tipo_id
  left join _md msd on msd.old_id = ll.subdivisao_id
  where ll.campaign_id = _source_campaign_id;

  -- Instalações: equipes, membros e veículos
  insert into _mteam(old_id,new_id) select id, gen_random_uuid() from installation_teams where campaign_id=_source_campaign_id;
  insert into installation_teams (id, campaign_id, name, created_at)
  select m.new_id, v_new, t.name, t.created_at
  from installation_teams t join _mteam m on m.old_id = t.id
  where t.campaign_id = _source_campaign_id;
  insert into installation_team_members (id, team_id, name, rg, cpf, phone, created_at, is_unified_doc, is_leader)
  select gen_random_uuid(), m.new_id, tm.name, tm.rg, tm.cpf, tm.phone, tm.created_at, tm.is_unified_doc, tm.is_leader
  from installation_team_members tm join _mteam m on m.old_id = tm.team_id;
  insert into installation_team_vehicles (id, team_id, name, brand, color, plate, created_at)
  select gen_random_uuid(), m.new_id, tv.name, tv.brand, tv.color, tv.plate, tv.created_at
  from installation_team_vehicles tv join _mteam m on m.old_id = tv.team_id;

  -- Instalações: fotos
  insert into installation_photos (id, campaign_id, store_id, photo_url, category, caption, created_at, uploaded_by, upload_method, media_type, reinstall_seq)
  select gen_random_uuid(), v_new, ip.store_id, ip.photo_url, ip.category, ip.caption, ip.created_at, ip.uploaded_by, ip.upload_method, ip.media_type, ip.reinstall_seq
  from installation_photos ip where ip.campaign_id = _source_campaign_id;

  -- Agendamentos
  insert into _msch(old_id,new_id) select id, gen_random_uuid() from campaign_schedules where campaign_id=_source_campaign_id;
  insert into campaign_schedules (
    id, campaign_id, store_id, scheduled_date, scheduled_time, installation_os, installation_preference,
    created_at, updated_at, team_id, store_approved, store_approved_at, team_approved, team_approved_at,
    responsibility, responsibility_at, store_approval_status, team_approval_status, completed_at,
    suggested_date, suggested_time, suggested_date_2, suggested_time_2, completed_by,
    reschedule_enabled, reschedule_date, reschedule_time, reschedule_os, reschedule_preference,
    reschedule_store_approval_status, reschedule_store_approved_at, reschedule_team_approval_status,
    reschedule_team_approved_at, reschedule_responsibility, reschedule_responsibility_at,
    reschedule_suggested_date, reschedule_suggested_time, reschedule_suggested_date_2, reschedule_suggested_time_2,
    locked, photo_checkin, photo_checkin_at, install_code, install_code_generated_at, install_code_expires_at,
    code_sent_at, checkin_lat, checkin_lng, checkin_accuracy, checkin_timestamp, checkin_device_info,
    manual_checkin_at, manual_checkin_by, manual_checkin_by_name, manual_checkout_at, manual_checkout_by,
    manual_checkout_by_name, reinstall_seq, reinstall_reason, parent_installation_id)
  select ms.new_id, v_new, s.store_id, s.scheduled_date, s.scheduled_time, s.installation_os, s.installation_preference,
    s.created_at, s.updated_at, mt.new_id, s.store_approved, s.store_approved_at, s.team_approved, s.team_approved_at,
    s.responsibility, s.responsibility_at, s.store_approval_status, s.team_approval_status, s.completed_at,
    s.suggested_date, s.suggested_time, s.suggested_date_2, s.suggested_time_2, s.completed_by,
    s.reschedule_enabled, s.reschedule_date, s.reschedule_time, s.reschedule_os, s.reschedule_preference,
    s.reschedule_store_approval_status, s.reschedule_store_approved_at, s.reschedule_team_approval_status,
    s.reschedule_team_approved_at, s.reschedule_responsibility, s.reschedule_responsibility_at,
    s.reschedule_suggested_date, s.reschedule_suggested_time, s.reschedule_suggested_date_2, s.reschedule_suggested_time_2,
    s.locked, s.photo_checkin, s.photo_checkin_at, null, null, null,
    null, s.checkin_lat, s.checkin_lng, s.checkin_accuracy, s.checkin_timestamp, s.checkin_device_info,
    s.manual_checkin_at, s.manual_checkin_by, s.manual_checkin_by_name, s.manual_checkout_at, s.manual_checkout_by,
    s.manual_checkout_by_name, s.reinstall_seq, s.reinstall_reason, mps.new_id
  from campaign_schedules s
  join _msch ms on ms.old_id = s.id
  left join _mteam mt on mt.old_id = s.team_id
  left join _msch mps on mps.old_id = s.parent_installation_id
  where s.campaign_id = _source_campaign_id;
  insert into schedule_history (id, campaign_id, store_id, user_id, content, created_at)
  select gen_random_uuid(), v_new, sh.store_id, sh.user_id, sh.content, sh.created_at
  from schedule_history sh where sh.campaign_id = _source_campaign_id;

  -- Ocorrências
  insert into _mocc(old_id,new_id) select id, gen_random_uuid() from occurrences where campaign_id=_source_campaign_id;
  insert into occurrences (
    id, campaign_id, store_id, piece_id, motive_id, description, photo_url, status, created_at,
    location_in_store, actions_taken, needs_reinstallation, reinstallation_os, reinstallation_datetime,
    agency_observation, expected_resolution_date, resolved_date, reporter_name, reporter_phone_ddd,
    reporter_phone_number, reporter_email, reporter_type, priority, locked, kit_id)
  select mo.new_id, v_new, o.store_id, mp.new_id, o.motive_id, o.description, o.photo_url, o.status, o.created_at,
    o.location_in_store, o.actions_taken, o.needs_reinstallation, o.reinstallation_os, o.reinstallation_datetime,
    o.agency_observation, o.expected_resolution_date, o.resolved_date, o.reporter_name, o.reporter_phone_ddd,
    o.reporter_phone_number, o.reporter_email, o.reporter_type, o.priority, o.locked, mk.new_id
  from occurrences o
  join _mocc mo on mo.old_id = o.id
  left join _mp mp on mp.old_id = o.piece_id
  left join _mk mk on mk.old_id = o.kit_id
  where o.campaign_id = _source_campaign_id;
  insert into occurrence_photos (id, occurrence_id, photo_url, created_at, category)
  select gen_random_uuid(), mo.new_id, op.photo_url, op.created_at, op.category
  from occurrence_photos op join _mocc mo on mo.old_id = op.occurrence_id;
  insert into occurrence_comments (id, occurrence_id, user_id, user_display_name, content, created_at)
  select gen_random_uuid(), mo.new_id, oc.user_id, oc.user_display_name, oc.content, oc.created_at
  from occurrence_comments oc join _mocc mo on mo.old_id = oc.occurrence_id;

  insert into user_campaign_favorites (user_id, campaign_id)
  select distinct f.user_id, v_new
  from user_campaign_favorites f
  join campaigns c on c.id = f.campaign_id
  where coalesce(c.root_campaign_id, c.id) = v_root and c.id <> v_new
    and not exists (select 1 from user_campaign_favorites x where x.user_id = f.user_id and x.campaign_id = v_new);
  delete from user_campaign_favorites f
  using campaigns c
  where f.campaign_id = c.id
    and coalesce(c.root_campaign_id, c.id) = v_root
    and c.id <> v_new;
  -- Migração de autorizações de campanha para a nova versão (mesma lógica dos favoritos)
  insert into user_campaign_access (user_id, campaign_id, category_id, suspended)
  select distinct a.user_id, v_new, a.category_id, a.suspended
  from user_campaign_access a
  join campaigns c on c.id = a.campaign_id
  where coalesce(c.root_campaign_id, c.id) = v_root and c.id <> v_new
    and not exists (
      select 1 from user_campaign_access x
      where x.user_id = a.user_id
        and x.campaign_id = v_new
        and x.category_id is not distinct from a.category_id
    )
  on conflict do nothing;
  delete from user_campaign_access a
  using campaigns c
  where a.campaign_id = c.id
    and coalesce(c.root_campaign_id, c.id) = v_root
    and c.id <> v_new;
  return v_new;
end;
$function$;

notify pgrst, 'reload schema';