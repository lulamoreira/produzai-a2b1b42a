create or replace function public.get_supplier_portal_budget(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $
declare
  v_supplier budget_suppliers%rowtype;
  v_prices jsonb;
  v_extras jsonb;
  v_is_reneg boolean := false;
begin
  if _token is null or _token = '' then return null; end if;
  select * into v_supplier from public.budget_suppliers where access_token = _token limit 1;
  if not found then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(bp.*)), '[]'::jsonb) into v_prices from public.budget_prices bp where bp.supplier_id = v_supplier.id;
  select coalesce(jsonb_agg(to_jsonb(ec.*)), '[]'::jsonb) into v_extras from public.budget_extra_costs ec where ec.supplier_id = v_supplier.id;
  select (c.origin_label is not null) into v_is_reneg from public.campaigns c where c.id = v_supplier.campaign_id;
  return jsonb_build_object(
    'supplier', to_jsonb(v_supplier),
    'prices', v_prices,
    'extra_costs', v_extras,
    'is_renegotiation', coalesce(v_is_reneg, false)
  );
end; $;

grant execute on function public.get_supplier_portal_budget(text) to anon, authenticated;

create or replace function public.supplier_portal_save_extra_costs(_token text, _field text, _value numeric, _is_negotiation boolean)
returns jsonb language plpgsql security definer set search_path = public as $
declare
  v_sup budget_suppliers%rowtype;
  v_db_field text;
begin
  if _token is null or _token = '' then return jsonb_build_object('success', false, 'error', 'invalid_token'); end if;
  select * into v_sup from budget_suppliers where access_token = _token limit 1;
  if not found then return jsonb_build_object('success', false, 'error', 'invalid_token'); end if;
  if v_sup.locked and not _is_negotiation then return jsonb_build_object('success', false, 'error', 'locked'); end if;
  if _field not in ('installation_value','freight_value','discount_value') then
    return jsonb_build_object('success', false, 'error', 'invalid_field');
  end if;
  if _is_negotiation then
    v_db_field := case _field
      when 'installation_value' then 'adjusted_installation_value'
      when 'freight_value' then 'adjusted_freight_value'
      when 'discount_value' then 'adjusted_discount_value'
    end;
  else
    v_db_field := _field;
  end if;
  insert into budget_extra_costs (supplier_id) values (v_sup.id) on conflict (supplier_id) do nothing;
  execute format('update public.budget_extra_costs set %I = $1 where supplier_id = $2', v_db_field) using _value, v_sup.id;
  return jsonb_build_object('success', true);
end; $;

grant execute on function public.supplier_portal_save_extra_costs(text, text, numeric, boolean) to anon, authenticated;
