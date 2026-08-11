-- Compatibility layer for the existing saas_plans subscription engine, plus
-- exact timestamp overrides for RVC Control.
alter table public.tenants add column if not exists subscription_status text;
alter table public.tenants add column if not exists subscription_starts_at timestamptz;
alter table public.tenants add column if not exists subscription_expires_at timestamptz;
alter table public.tenants add column if not exists auto_renew boolean not null default false;

update public.tenants
set subscription_status=coalesce(subscription_status,status),
    subscription_starts_at=coalesce(subscription_starts_at,subscription_start_date),
    subscription_expires_at=coalesce(subscription_expires_at,subscription_end_date)
where subscription_status is null or subscription_starts_at is null or subscription_expires_at is null;

create or replace function public.admin_update_tenant_subscription(
  p_tenant_id uuid,p_plan_id uuid,p_status text,p_expires_at timestamptz
) returns public.tenants language plpgsql security definer set search_path=public as $$
declare saved public.tenants;
begin
 if not is_super_admin() then raise exception 'Super-admin access required'; end if;
 if p_status not in ('trial','active','past_due','expired','suspended') then raise exception 'Invalid subscription status'; end if;
 if p_plan_id is not null and not exists(select 1 from public.saas_plans where id=p_plan_id) then raise exception 'Plan not found'; end if;
 update public.tenants set
  plan_id=p_plan_id,
  status=case when p_status='past_due' then 'suspended' else p_status end,
  subscription_status=p_status,
  subscription_starts_at=coalesce(subscription_starts_at,now()),
  subscription_expires_at=p_expires_at,
  subscription_start_date=coalesce(subscription_start_date,now()),
  subscription_end_date=p_expires_at,
  is_frozen=(p_status in ('suspended','expired'))
 where id=p_tenant_id returning * into saved;
 if not found then raise exception 'Tenant not found'; end if;
 return saved;
end $$;
grant execute on function public.admin_update_tenant_subscription(uuid,uuid,text,timestamptz) to authenticated;
notify pgrst,'reload schema';
