create table if not exists public.restaurant_staff_assignments (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 role_label text not null default 'Waiter / Service', permissions jsonb not null default '[]'::jsonb,
 is_active boolean not null default true, updated_at timestamptz not null default now()
);
alter table public.restaurant_staff_assignments enable row level security;
drop policy if exists "Tenant owner manages staff assignments" on public.restaurant_staff_assignments;
create policy "Tenant owner manages staff assignments" on public.restaurant_staff_assignments for all using(tenant_member_of(tenant_id)) with check(tenant_member_of(tenant_id));
create or replace function public.restaurant_save_staff_assignment(p_profile_id uuid,p_role_label text,p_permissions jsonb)
returns public.restaurant_staff_assignments language plpgsql security definer set search_path=public as $$
declare v_tenant uuid; saved public.restaurant_staff_assignments;
begin
 select tenant_id into v_tenant from profiles where id=auth.uid() and role='tenant_owner';
 if v_tenant is null then raise exception 'Restaurant owner access required'; end if;
 if not exists(select 1 from profiles where id=p_profile_id and tenant_id=v_tenant) then raise exception 'Staff member not found'; end if;
 insert into restaurant_staff_assignments(profile_id,tenant_id,role_label,permissions) values(p_profile_id,v_tenant,coalesce(nullif(trim(p_role_label),''),'Waiter / Service'),coalesce(p_permissions,'[]'::jsonb)) on conflict(profile_id) do update set role_label=excluded.role_label,permissions=excluded.permissions,is_active=true,updated_at=now() returning * into saved;
 return saved;
end $$;
grant execute on function public.restaurant_save_staff_assignment(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
