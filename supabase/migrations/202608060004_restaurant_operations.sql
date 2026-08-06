-- Restaurant operations: payment settlement and order lifecycle controls.

alter table restaurant_orders add column if not exists payment_method text check (payment_method in ('cash','online','complimentary'));
alter table restaurant_orders add column if not exists paid_at timestamptz;
alter table restaurant_orders add column if not exists payment_reference text;

create table if not exists restaurant_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references restaurant_orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  method text not null check (method in ('cash','online','complimentary')),
  status text not null default 'paid' check (status in ('pending','paid','failed','refunded')),
  gateway text,
  gateway_reference text,
  created_at timestamptz not null default now(),
  unique(order_id, status) deferrable initially immediate
);
alter table restaurant_payments enable row level security;
drop policy if exists "Tenant staff manage payments" on restaurant_payments;
create policy "Tenant staff manage payments" on restaurant_payments for all using (tenant_member_of(tenant_id)) with check (tenant_member_of(tenant_id));

create or replace function settle_restaurant_order(p_order_id uuid, p_method text, p_reference text default null)
returns restaurant_orders language plpgsql security definer set search_path = public as $$
declare saved restaurant_orders;
begin
  if p_method not in ('cash','online','complimentary') then raise exception 'Invalid payment method'; end if;
  select * into saved from restaurant_orders where id=p_order_id for update;
  if not found or not tenant_member_of(saved.tenant_id) then raise exception 'Order not found'; end if;
  if saved.payment_status = 'paid' then return saved; end if;
  insert into restaurant_payments(tenant_id,order_id,amount,method,status,gateway_reference) values(saved.tenant_id,saved.id,saved.total,p_method,'paid',nullif(trim(p_reference),''));
  update restaurant_orders set payment_status='paid', payment_method=p_method, payment_reference=nullif(trim(p_reference),''), paid_at=now(), status=case when status='served' then 'served' else status end, updated_at=now() where id=p_order_id returning * into saved;
  insert into audit_logs(actor_id,action,target_tenant_id,details) values(auth.uid(),'restaurant.order_settled',saved.tenant_id,jsonb_build_object('order_id',p_order_id,'method',p_method,'amount',saved.total));
  return saved;
end $$;
grant execute on function settle_restaurant_order(uuid,text,text) to authenticated;
