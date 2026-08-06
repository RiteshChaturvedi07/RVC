-- Live operational workspaces for RVC Control.

create table if not exists platform_settings (
  id boolean primary key default true check (id),
  maintenance_mode boolean not null default false,
  support_email text,
  support_phone text,
  invoice_prefix text not null default 'RVC-INV',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into platform_settings(id) values(true) on conflict (id) do nothing;

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  subject text not null,
  description text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  created_by uuid references auth.users(id),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table platform_settings enable row level security;
alter table support_tickets enable row level security;
drop policy if exists "Super admin manages platform settings" on platform_settings;
create policy "Super admin manages platform settings" on platform_settings for all using (is_super_admin()) with check (is_super_admin());
drop policy if exists "Super admin manages support tickets" on support_tickets;
create policy "Super admin manages support tickets" on support_tickets for all using (is_super_admin()) with check (is_super_admin());

create or replace function admin_save_platform_settings(p_maintenance boolean, p_support_email text, p_support_phone text, p_invoice_prefix text)
returns platform_settings language plpgsql security definer set search_path = public as $$
declare saved platform_settings;
begin
  if not is_super_admin() then raise exception 'Super-admin access required'; end if;
  update platform_settings set maintenance_mode=p_maintenance, support_email=nullif(trim(p_support_email),''), support_phone=nullif(trim(p_support_phone),''), invoice_prefix=coalesce(nullif(trim(p_invoice_prefix),''),'RVC-INV'), updated_at=now(), updated_by=auth.uid() where id=true returning * into saved;
  insert into audit_logs(actor_id, action, details) values(auth.uid(), 'platform.settings_updated', jsonb_build_object('maintenance_mode',p_maintenance));
  return saved;
end $$;

create or replace function admin_set_profile_role(p_profile_id uuid, p_role text)
returns profiles language plpgsql security definer set search_path = public as $$
declare saved profiles; admins_left integer;
begin
  if not is_super_admin() then raise exception 'Super-admin access required'; end if;
  if p_role not in ('super_admin','tenant_owner','staff','customer') then raise exception 'Invalid role'; end if;
  select count(*) into admins_left from profiles where role='super_admin';
  if (select role from profiles where id=p_profile_id)='super_admin' and p_role <> 'super_admin' and admins_left <= 1 then raise exception 'You cannot remove the final super admin'; end if;
  update profiles set role=p_role where id=p_profile_id returning * into saved;
  if not found then raise exception 'Profile not found'; end if;
  insert into audit_logs(actor_id, action, details) values(auth.uid(), 'profile.role_changed', jsonb_build_object('profile_id',p_profile_id,'role',p_role));
  return saved;
end $$;

create or replace function admin_set_support_ticket_status(p_ticket_id uuid, p_status text)
returns support_tickets language plpgsql security definer set search_path = public as $$
declare saved support_tickets;
begin
  if not is_super_admin() then raise exception 'Super-admin access required'; end if;
  if p_status not in ('open','pending','resolved','closed') then raise exception 'Invalid ticket status'; end if;
  update support_tickets set status=p_status, updated_at=now() where id=p_ticket_id returning * into saved;
  if not found then raise exception 'Ticket not found'; end if;
  insert into audit_logs(actor_id, action, details) values(auth.uid(), 'support_ticket.status_changed', jsonb_build_object('ticket_id',p_ticket_id,'status',p_status));
  return saved;
end $$;
grant execute on function admin_save_platform_settings(boolean,text,text,text) to authenticated;
grant execute on function admin_set_profile_role(uuid,text) to authenticated;
grant execute on function admin_set_support_ticket_status(uuid,text) to authenticated;
