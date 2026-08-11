alter table public.platform_settings add column if not exists rvc_upi_id text;
alter table public.platform_settings add column if not exists rvc_upi_qr_url text;
create table if not exists public.subscription_payment_requests (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 plan_id uuid references public.saas_plans(id) on delete set null, amount numeric(12,2) not null check(amount>=0),
 billing_cycle text not null check(billing_cycle in ('monthly','yearly')),
 utr_reference text not null, status text not null default 'pending' check(status in ('pending','paid','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references auth.users(id)
);
alter table public.subscription_payment_requests enable row level security;
drop policy if exists "Tenant reads and creates own subscription requests" on public.subscription_payment_requests;
create policy "Tenant reads and creates own subscription requests" on public.subscription_payment_requests for all using(tenant_member_of(tenant_id)) with check(tenant_member_of(tenant_id));
drop policy if exists "Admins manage subscription payment requests" on public.subscription_payment_requests;
create policy "Admins manage subscription payment requests" on public.subscription_payment_requests for all using(is_super_admin()) with check(is_super_admin());
notify pgrst,'reload schema';
