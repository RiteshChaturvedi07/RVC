-- A guest must still see the completed bill after staff settles and closes the
-- physical table. Prefer the open visit; otherwise expose only the latest
-- closed visit for the table QR (not arbitrary historical sessions).
create or replace function public.public_restaurant_table_session_orders(p_table_token uuid)
returns jsonb language sql security definer set search_path=public as $$
 with target_table as (
   select id from public.restaurant_tables where public_token=p_table_token
 ), current_session as (
   select s.id from public.restaurant_table_sessions s join target_table t on t.id=s.table_id
   order by case when s.status='open' then 0 else 1 end, s.started_at desc
   limit 1
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',o.id,'order_number',o.order_number,'status',o.status,
   'payment_status',o.payment_status,'payment_method',o.payment_method,
   'total',o.total,'subtotal',o.subtotal,'tax_amount',o.tax_amount,
   'discount_amount',o.discount_amount,'created_at',o.created_at,
   'items',coalesce((select jsonb_agg(jsonb_build_object(
     'name',i.item_name,'quantity',i.quantity,'unit_price',i.unit_price,
     'line_total',i.line_total,'notes',i.notes
   ) order by i.id) from public.restaurant_order_items i where i.order_id=o.id),'[]'::jsonb)
 ) order by o.created_at),'[]'::jsonb)
 from current_session s join public.restaurant_orders o on o.table_session_id=s.id;
$$;
grant execute on function public.public_restaurant_table_session_orders(uuid) to anon,authenticated;
notify pgrst,'reload schema';
