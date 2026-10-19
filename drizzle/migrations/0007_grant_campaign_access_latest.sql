CREATE OR REPLACE FUNCTION public.grant_campaign_access_latest(_user_id uuid, _campaign_id uuid, _category_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_root uuid;
  v_latest_id uuid;
begin
  if auth.uid() is null then raise exception 'Nao autenticado'; end if;
  if not public.is_admin_or_master(auth.uid()) then raise exception 'Sem permissao'; end if;
  select coalesce(root_campaign_id, id) into v_root from campaigns where id = _campaign_id;
  if v_root is null then raise exception 'Campanha nao encontrada'; end if;
  select id into v_latest_id from campaigns
  where coalesce(root_campaign_id, id) = v_root
  order by created_at desc, id desc limit 1;

  delete from user_campaign_access a using campaigns c
  where a.user_id = _user_id and a.campaign_id = c.id
    and coalesce(c.root_campaign_id, c.id) = v_root
    and a.campaign_id <> v_latest_id;

  insert into user_campaign_access (user_id, campaign_id, category_id)
  values (_user_id, v_latest_id, _category_id)
  on conflict (user_id, campaign_id) do update set category_id = excluded.category_id;

  return v_latest_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.grant_campaign_access_latest(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_campaign_access_latest(uuid, uuid, uuid) TO authenticated;