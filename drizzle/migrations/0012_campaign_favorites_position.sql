alter table public.user_campaign_favorites add column if not exists position integer;
with ordered as (
  select id, row_number() over (partition by user_id order by created_at) - 1 as rn
  from public.user_campaign_favorites
)
update public.user_campaign_favorites f set position = o.rn
from ordered o where f.id = o.id and f.position is null;

create or replace function public.reorder_campaign_favorites(_campaign_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Nao autenticado'; end if;
  update public.user_campaign_favorites f
  set position = x.ord
  from (
    select t.id, (t.ordinality - 1)::int as ord
    from unnest(_campaign_ids) with ordinality as t(id, ordinality)
  ) x
  where f.user_id = v_uid and f.campaign_id = x.id;
end; $$;
grant execute on function public.reorder_campaign_favorites(uuid[]) to authenticated;

CREATE OR REPLACE FUNCTION public.set_campaign_favorite(_campaign_id uuid, _favorite boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_root uuid;
  v_latest_id uuid;
  v_latest_name text;
begin
  if v_uid is null then raise exception 'Nao autenticado'; end if;
  select coalesce(root_campaign_id, id) into v_root from campaigns where id = _campaign_id;
  if v_root is null then raise exception 'Campanha nao encontrada'; end if;
  select id, name into v_latest_id, v_latest_name
  from campaigns
  where coalesce(root_campaign_id, id) = v_root
  order by created_at desc, id desc
  limit 1;
  delete from user_campaign_favorites f
  using campaigns c
  where f.user_id = v_uid and f.campaign_id = c.id
    and coalesce(c.root_campaign_id, c.id) = v_root;
  if _favorite then
    insert into public.user_campaign_favorites (user_id, campaign_id, position)
    values (v_uid, v_latest_id,
      coalesce((select max(position) + 1 from public.user_campaign_favorites where user_id = v_uid), 0));
    return v_latest_name;
  end if;
  return null;
end;
$function$;