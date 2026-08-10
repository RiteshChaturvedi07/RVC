-- Atomically settle an order and free its table for the next guest.
create or replace function public.complete_restaurant_order(p_order_id uuid,p_method text,p_reference text default null)
returns restaurant_orders language plpgsql security definer set search_path=public as $$
declare saved restaurant_orders;
begin
 if p_method not in ('cash','online','complimentary') then raise exception 'Invalid payment method'; end if;
 select * into saved from restaurant_orders where id=p_order_id for update;
 if not found or not tenant_member_of(saved.tenant_id) then raise exception 'Order not found'; end if;
 if saved.payment_status<>'paid' then
   if not exists(select 1 from restaurant_payments where order_id=saved.id and status='paid') then
     insert into restaurant_payments(tenant_id,order_id,amount,method,status,gateway_reference)
     values(saved.tenant_id,saved.id,saved.total,p_method,'paid',nullif(trim(p_reference),''));
   end if;
 end if;
 update restaurant_orders set status='completed',payment_status='paid',payment_method=p_method,paid_at=coalesce(paid_at,now()),payment_reference=coalesce(nullif(trim(p_reference),''),payment_reference),updated_at=now()
 where id=saved.id returning * into saved;
 -- Only release if no other running order exists for this physical table.
 if not exists(select 1 from restaurant_orders where table_id=saved.table_id and id<>saved.id and status in ('new','accepted','preparing','ready','served')) then
   update restaurant_tables set status='available',updated_at=now() where id=saved.table_id;
 end if;
 return saved;
end $$;
grant execute on function public.complete_restaurant_order(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
