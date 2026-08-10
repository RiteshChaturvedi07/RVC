create table if not exists public.saas_plans (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 price_monthly numeric(10,2) not null default 0, price_yearly numeric(10,2) not null default 0,
 features jsonb not null default '[]'::jsonb, is_popular boolean not null default false,
 is_active boolean not null default true, created_at timestamptz not null default now()
);
alter table tenants add column if not exists plan_id uuid references public.saas_plans(id) on delete set null;
alter table tenants add column if not exists plan_billing_cycle text check(plan_billing_cycle in ('monthly','yearly'));
alter table tenants add column if not exists subscription_start_date timestamptz;
alter table tenants add column if not exists subscription_end_date timestamptz;
alter table tenants add column if not exists is_frozen boolean not null default false;
alter table tenants add column if not exists freeze_reason text;
alter table tenants drop constraint if exists tenants_status_check;
alter table tenants add constraint tenants_status_check check(status in ('trial','active','suspended','expired'));
alter table saas_plans enable row level security;
drop policy if exists "Admins manage SaaS plans" on saas_plans;
create policy "Admins manage SaaS plans" on saas_plans for all using(is_super_admin()) with check(is_super_admin());

create or replace function public.get_active_saas_plans() returns setof saas_plans language sql stable security definer set search_path=public as $$
 select * from saas_plans where is_active order by price_monthly,name;
$$;
create or replace function public.admin_manage_tenant_subscription(p_tenant_id uuid,p_plan_id uuid,p_status text,p_duration_days integer,p_is_frozen boolean,p_freeze_reason text)
returns tenants language plpgsql security definer set search_path=public as $$
declare saved tenants;
begin
 if not is_super_admin() then raise exception 'Super-admin access required'; end if;
 if p_status not in ('trial','active','suspended','expired') then raise exception 'Invalid status'; end if;
 if p_plan_id is not null and not exists(select 1 from saas_plans where id=p_plan_id) then raise exception 'Plan not found'; end if;
 update tenants set plan_id=p_plan_id,status=p_status,subscription_start_date=case when p_duration_days is not null then now() else subscription_start_date end,subscription_end_date=case when p_duration_days is not null then now()+make_interval(days=>greatest(p_duration_days,0)) else subscription_end_date end,is_frozen=coalesce(p_is_frozen,false),freeze_reason=nullif(trim(p_freeze_reason),'') where id=p_tenant_id returning * into saved;
 if not found then raise exception 'Tenant not found'; end if; return saved;
end $$;
grant execute on function public.get_active_saas_plans() to anon,authenticated;
grant execute on function public.admin_manage_tenant_subscription(uuid,uuid,text,integer,boolean,text) to authenticated;
insert into saas_plans(name,slug,price_monthly,price_yearly,features,is_popular) values
 ('Basic','basic',999,9990,'["QR ordering","Menu management","Basic reports"]',false),
 ('Pro','pro',1999,19990,'["Everything in Basic","Coupons","Inventory","Priority support"]',true),
 ('Enterprise','enterprise',4999,49990,'["Everything in Pro","Multiple outlets","Dedicated support"]',false)
on conflict(slug) do nothing;
notify pgrst,'reload schema';
