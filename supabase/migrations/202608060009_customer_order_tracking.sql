-- Public customer tracking for the specific order ID and table token stored on
-- the guest's device after checkout. It cannot list other table orders.
create or replace function public.public_restaurant_order_status(p_table_token uuid, p_order_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'order_number', o.order_number, 'status', o.status,
    'payment_status', o.payment_status, 'payment_method', o.payment_method,
    'total', o.total, 'created_at', o.created_at,
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.item_name, 'quantity', i.quantity, 'line_total', i.line_total) order by i.id) from restaurant_order_items i where i.order_id=o.id), '[]'::jsonb)
  )
  from restaurant_orders o
  join restaurant_tables t on t.id=o.table_id
  where o.id=p_order_id and t.public_token=p_table_token;
$$;
grant execute on function public.public_restaurant_order_status(uuid, uuid) to anon, authenticated;
notify pgrst, 'reload schema';
