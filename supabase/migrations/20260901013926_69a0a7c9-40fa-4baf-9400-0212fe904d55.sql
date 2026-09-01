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