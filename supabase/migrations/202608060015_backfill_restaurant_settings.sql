-- Existing restaurant tenants created before the restaurant trigger can lack a
-- settings row, which makes the Settings screen unable to load.
insert into public.restaurant_settings (tenant_id, display_name)
select t.id, t.name
from public.tenants t
left join public.restaurant_settings s on s.tenant_id=t.id
where s.tenant_id is null
on conflict (tenant_id) do nothing;

-- Keep the trigger's restaurant comparison case-insensitive for future signups.
create or replace function public.handle_new_rvc_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_tenant_id uuid; v_slug text;
begin
  if coalesce(new.raw_user_meta_data->>'business_name','') = '' then
    insert into profiles(id, role, full_name) values(new.id, 'customer', coalesce(new.raw_user_meta_data->>'full_name','')) on conflict (id) do nothing;
    return new;
  end if;
  v_slug := regexp_replace(lower(new.raw_user_meta_data->>'business_name'), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug) || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  insert into tenants(name, vertical, slug, owner_id, subscription_plan, status) values(new.raw_user_meta_data->>'business_name', coalesce(new.raw_user_meta_data->>'business_type','restaurant'), v_slug, new.id, coalesce(new.raw_user_meta_data->>'plan','starter'), 'trial') returning id into v_tenant_id;
  insert into profiles(id, tenant_id, role, full_name, phone) values(new.id, v_tenant_id, 'tenant_owner', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  insert into restaurant_settings(tenant_id, display_name) values(v_tenant_id, new.raw_user_meta_data->>'business_name') on conflict (tenant_id) do nothing;
  return new;
end $$;
notify pgrst,'reload schema';
