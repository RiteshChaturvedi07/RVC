-- Guest bill requests are public only through the restricted RPC below.
alter table public.restaurant_orders add column if not exists bill_requested boolean not null default false;
alter table public.restaurant_orders add column if not exists bill_requested_at timestamptz;
alter table public.restaurant_orders add column if not exists requested_payment_mode text check (requested_payment_mode in ('cash','upi'));

create or replace function public.public_request_restaurant_bill(
  p_table_token uuid,
  p_payment_mode text,
  p_payment_reference text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_table public.restaurant_tables%rowtype; v_count integer;
begin
  if p_payment_mode not in ('cash','upi') then raise exception 'Choose Cash or UPI payment.'; end if;
  select rt.* into v_table
  from public.restaurant_tables rt
  join public.tenants t on t.id=rt.tenant_id
  left join public.restaurant_settings s on s.tenant_id=t.id
  where rt.public_token=p_table_token and rt.status<>'disabled'
    and t.status in ('active','trial') and coalesce(s.ordering_enabled,true)
  for update of rt;
  if not found then raise exception 'This QR table is not currently accepting requests.'; end if;
  update public.restaurant_orders o
     set bill_requested=true,
         bill_requested_at=coalesce(o.bill_requested_at,now()),
         requested_payment_mode=p_payment_mode,
         payment_reference=coalesce(nullif(trim(p_payment_reference),''),o.payment_reference),
         updated_at=now()
   where o.table_id=v_table.id
     and o.payment_status <> 'paid'
     and o.status in ('new','accepted','preparing','ready','served');
  get diagnostics v_count = row_count;
  if v_count=0 then raise exception 'There is no active unpaid order for this table.'; end if;
  return jsonb_build_object('success',true,'payment_mode',p_payment_mode,'orders_updated',v_count);
end $$;
grant execute on function public.public_request_restaurant_bill(uuid,text,text) to anon, authenticated;

-- Keep the customer tracker aware of the bill-request status after a refresh.
create or replace function public.public_restaurant_table_session_orders(p_table_token uuid)
returns jsonb language sql security definer set search_path=public as $$
 with target_table as (select id from public.restaurant_tables where public_token=p_table_token),
 current_session as (
   select s.id from public.restaurant_table_sessions s join target_table t on t.id=s.table_id
   order by case when s.status='open' then 0 else 1 end, s.started_at desc limit 1
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',o.id,'order_number',o.order_number,'status',o.status,
   'payment_status',o.payment_status,'payment_method',o.payment_method,
   'requested_payment_mode',o.requested_payment_mode,'bill_requested',o.bill_requested,
   'bill_requested_at',o.bill_requested_at,'dining_type',o.dining_type,'notes',o.notes,
   'total',o.total,'subtotal',o.subtotal,'tax_amount',o.tax_amount,
   'discount_amount',o.discount_amount,'created_at',o.created_at,
   'items',coalesce((select jsonb_agg(jsonb_build_object(
     'name',i.item_name,'quantity',i.quantity,'unit_price',i.unit_price,
     'line_total',i.line_total,'notes',i.notes
   ) order by i.id) from public.restaurant_order_items i where i.order_id=o.id),'[]'::jsonb)
 ) order by o.created_at),'[]'::jsonb)
 from current_session s join public.restaurant_orders o on o.table_session_id=s.id;
$$;
grant execute on function public.public_restaurant_table_session_orders(uuid) to anon, authenticated;

-- Settling completes an order, removes its request flag and releases the table
-- immediately when no other active order remains (the safe form of auto-clear).
create or replace function public.complete_restaurant_order(p_order_id uuid,p_method text,p_reference text default null)
returns public.restaurant_orders language plpgsql security definer set search_path=public as $$
declare saved public.restaurant_orders;
begin
 if p_method not in ('cash','online','complimentary') then raise exception 'Invalid payment method'; end if;
 select * into saved from public.restaurant_orders where id=p_order_id for update;
 if not found or not public.tenant_member_of(saved.tenant_id) then raise exception 'Order not found'; end if;
 if saved.payment_status<>'paid' and not exists(select 1 from public.restaurant_payments where order_id=saved.id and status='paid') then
   insert into public.restaurant_payments(tenant_id,order_id,amount,method,status,gateway_reference) values(saved.tenant_id,saved.id,saved.total,p_method,'paid',nullif(trim(p_reference),''));
 end if;
 update public.restaurant_orders set status='completed',payment_status='paid',payment_method=p_method,bill_requested=false,paid_at=coalesce(paid_at,now()),payment_reference=coalesce(nullif(trim(p_reference),''),payment_reference),updated_at=now() where id=saved.id returning * into saved;
 if not exists(select 1 from public.restaurant_orders where table_id=saved.table_id and status in ('new','accepted','preparing','ready','served') and payment_status<>'paid') then
   update public.restaurant_tables set status='available',updated_at=now() where id=saved.table_id;
 end if;
 return saved;
end $$;
grant execute on function public.complete_restaurant_order(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
