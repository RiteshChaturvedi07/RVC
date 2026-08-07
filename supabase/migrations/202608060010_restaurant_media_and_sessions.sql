-- Menu media, service sessions, and safer QR ordering controls.
alter table restaurant_settings add column if not exists ordering_closes_at timestamptz;

create table if not exists restaurant_service_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  opened_at timestamptz not null default now(),
  closes_at timestamptz,
  closed_at timestamptz,
  opened_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table restaurant_service_sessions enable row level security;
drop policy if exists "Tenant staff manage service sessions" on restaurant_service_sessions;
create policy "Tenant staff manage service sessions" on restaurant_service_sessions for all using(tenant_member_of(tenant_id)) with check(tenant_member_of(tenant_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Restaurant staff upload menu images" on storage.objects;
create policy "Restaurant staff upload menu images" on storage.objects for insert to authenticated with check (
  bucket_id = 'menu-images' and (storage.foldername(name))[1] = current_tenant_id()::text
);
drop policy if exists "Restaurant staff update menu images" on storage.objects;
create policy "Restaurant staff update menu images" on storage.objects for update to authenticated using (
  bucket_id = 'menu-images' and (storage.foldername(name))[1] = current_tenant_id()::text
);
drop policy if exists "Restaurant staff delete menu images" on storage.objects;
create policy "Restaurant staff delete menu images" on storage.objects for delete to authenticated using (
  bucket_id = 'menu-images' and (storage.foldername(name))[1] = current_tenant_id()::text
);

create or replace function public.restaurant_open_service(p_closes_at timestamptz default null)
returns restaurant_service_sessions language plpgsql security definer set search_path=public as $$
declare tenant uuid; result restaurant_service_sessions;
begin
  tenant := current_tenant_id();
  if tenant is null or not tenant_member_of(tenant) then raise exception 'Restaurant access required'; end if;
  update restaurant_service_sessions set closed_at=now() where tenant_id=tenant and closed_at is null;
  insert into restaurant_service_sessions(tenant_id, closes_at, opened_by) values(tenant,p_closes_at,auth.uid()) returning * into result;
  update restaurant_settings set ordering_enabled=true, ordering_closes_at=p_closes_at, updated_at=now() where tenant_id=tenant;
  return result;
end $$;

create or replace function public.restaurant_close_service()
returns void language plpgsql security definer set search_path=public as $$
declare tenant uuid;
begin
 tenant:=current_tenant_id(); if tenant is null or not tenant_member_of(tenant) then raise exception 'Restaurant access required'; end if;
 update restaurant_service_sessions set closed_at=now() where tenant_id=tenant and closed_at is null;
 update restaurant_settings set ordering_enabled=false, updated_at=now() where tenant_id=tenant;
end $$;
grant execute on function public.restaurant_open_service(timestamptz) to authenticated;
grant execute on function public.restaurant_close_service() to authenticated;
