create or replace function public.set_campaign_favorite(_campaign_id uuid, _favorite boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
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
    insert into user_campaign_favorites (user_id, campaign_id) values (v_uid, v_latest_id);
    return v_latest_name;
  end if;
  return null;
end;
$$;

grant execute on function public.set_campaign_favorite(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';