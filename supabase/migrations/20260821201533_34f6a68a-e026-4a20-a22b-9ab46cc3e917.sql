-- Migration to update get_supplier_portal_budget to include disabled_store_ids
-- This allows the supplier portal to correctly exclude disabled stores from calculations.

create or replace function public.get_supplier_portal_budget(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_supplier budget_suppliers%rowtype;
  v_prices jsonb;
  v_extras jsonb;
  v_is_reneg boolean := false;
  v_disabled uuid[];
begin
  if _token is null or _token = '' then return null; end if;

  select * into v_supplier from public.budget_suppliers where access_token = _token limit 1;
  if not found then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(bp.*)), '[]'::jsonb) into v_prices from public.budget_prices bp where bp.supplier_id = v_supplier.id;
  select coalesce(jsonb_agg(to_jsonb(ec.*)), '[]'::jsonb) into v_extras from public.budget_extra_costs ec where ec.supplier_id = v_supplier.id;
  
  select (c.origin_label is not null) into v_is_reneg from public.campaigns c where c.id = v_supplier.campaign_id;

  select coalesce(array_agg(css.store_id), '{}') into v_disabled
    from public.campaign_store_status css
    where css.campaign_id = v_supplier.campaign_id and css.enabled = false;

  return jsonb_build_object(
    'supplier', to_jsonb(v_supplier),
    'prices', v_prices,
    'extra_costs', v_extras,
    'is_renegotiation', coalesce(v_is_reneg, false),
    'disabled_store_ids', to_jsonb(v_disabled)
  );
end; $$;

grant execute on function public.get_supplier_portal_budget(text) to anon, authenticated;
