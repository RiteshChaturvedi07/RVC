-- Migration: Fix Restaurant Staff RBAC RPCs (1-param and 3-param overloads)
create or replace function public.restaurant_add_staff(
  p_email text
)
returns public.profiles language plpgsql security definer set search_path=public,auth as $$
declare
  v_tenant uuid;
  v_user uuid;
  saved public.profiles;
  clean_email text;
begin
  clean_email := lower(trim(p_email));
  if clean_email is null or clean_email = '' then
    raise exception 'Email address is required to add staff.';
  end if;

  -- Get current user's tenant ID from profiles
  select tenant_id into v_tenant from public.profiles where id = auth.uid() and tenant_id is not null limit 1;
  if v_tenant is null then
    raise exception 'Authorized restaurant tenant access is required.';
  end if;

  -- 1. Check if user exists in auth.users
  select id into v_user from auth.users where lower(email) = clean_email limit 1;

  if v_user is not null then
    -- Update existing auth user profile
    insert into public.profiles (id, email, tenant_id, role, updated_at)
    values (v_user, clean_email, v_tenant, 'staff', now())
    on conflict (id) do update set
      tenant_id = excluded.tenant_id,
      role = 'staff',
      updated_at = now()
    returning * into saved;
  else
    -- 2. Check if a non-auth profile exists by email
    select id into v_user from public.profiles where lower(email) = clean_email limit 1;

    if v_user is not null then
      update public.profiles set
        tenant_id = v_tenant,
        role = 'staff',
        updated_at = now()
      where id = v_user
      returning * into saved;
    else
      -- 3. Provision new staff profile
      insert into public.profiles (id, email, tenant_id, role, updated_at)
      values (gen_random_uuid(), clean_email, v_tenant, 'staff', now())
      returning * into saved;
    end if;
  end if;

  return saved;
end $$;

create or replace function public.restaurant_add_staff(
  p_email text,
  p_full_name text,
  p_phone text
)
returns public.profiles language plpgsql security definer set search_path=public,auth as $$
declare
  saved public.profiles;
begin
  saved := public.restaurant_add_staff(p_email);
  
  if saved.id is not null then
    update public.profiles set
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone = coalesce(nullif(trim(p_phone), ''), phone),
      updated_at = now()
    where id = saved.id
    returning * into saved;
  end if;

  return saved;
end $$;

create or replace function public.restaurant_save_staff_assignment(
  p_profile_id uuid,
  p_role_label text,
  p_permissions jsonb
)
returns public.restaurant_staff_assignments language plpgsql security definer set search_path=public as $$
declare
  v_tenant uuid;
  saved public.restaurant_staff_assignments;
begin
  select tenant_id into v_tenant from public.profiles where id = auth.uid() and tenant_id is not null limit 1;
  if v_tenant is null then
    raise exception 'Authorized restaurant tenant access is required.';
  end if;

  -- Ensure profile belongs to this tenant
  if not exists (select 1 from public.profiles where id = p_profile_id and tenant_id = v_tenant) then
    raise exception 'Staff member profile not found in your restaurant tenant.';
  end if;

  insert into public.restaurant_staff_assignments (profile_id, tenant_id, role_label, permissions, is_active, updated_at)
  values (
    p_profile_id,
    v_tenant,
    coalesce(nullif(trim(p_role_label), ''), 'Waiter / Service'),
    coalesce(p_permissions, '[]'::jsonb),
    true,
    now()
  )
  on conflict (profile_id) do update set
    role_label = excluded.role_label,
    permissions = excluded.permissions,
    is_active = true,
    updated_at = now()
  returning * into saved;

  return saved;
end $$;

create or replace function public.restaurant_remove_staff(p_profile_id uuid)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare
  v_tenant uuid;
  saved public.profiles;
begin
  select tenant_id into v_tenant from public.profiles where id = auth.uid() and tenant_id is not null limit 1;
  if v_tenant is null then
    raise exception 'Authorized restaurant tenant access is required.';
  end if;

  delete from public.restaurant_staff_assignments where profile_id = p_profile_id;

  update public.profiles set tenant_id = null, role = 'customer', updated_at = now()
  where id = p_profile_id and tenant_id = v_tenant and role = 'staff'
  returning * into saved;

  return saved;
end $$;

grant execute on function public.restaurant_add_staff(text) to authenticated;
grant execute on function public.restaurant_add_staff(text, text, text) to authenticated;
grant execute on function public.restaurant_save_staff_assignment(uuid, text, jsonb) to authenticated;
grant execute on function public.restaurant_remove_staff(uuid) to authenticated;
notify pgrst, 'reload schema';
