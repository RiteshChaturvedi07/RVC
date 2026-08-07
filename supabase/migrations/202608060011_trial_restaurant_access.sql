-- Trial restaurants may use the complete restaurant product for evaluation.
-- Suspended accounts remain blocked from public QR ordering.

create or replace function public.public_restaurant_menu(p_slug text, p_table_number text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare payload jsonb;
begin
  select jsonb_build_object(
    'restaurant', jsonb_build_object('name', coalesce(settings.display_name, tenant.name), 'currency', coalesce(settings.currency, 'INR'), 'tax_rate', coalesce(settings.tax_rate, 0)),
    'table', jsonb_build_object('id', restaurant_table.id, 'number', restaurant_table.table_number, 'token', restaurant_table.public_token),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', category.id, 'name', category.name) order by category.sort_order, category.name) from menu_categories category where category.tenant_id=tenant.id and category.is_active), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', item.id, 'name', item.name, 'description', item.description, 'price', item.price, 'category_id', item.category_id, 'category', category.name, 'image_url', item.image_url, 'is_featured', item.is_featured, 'is_vegetarian', item.is_vegetarian) order by item.sort_order,item.name) from menu_items item left join menu_categories category on category.id=item.category_id where item.tenant_id=tenant.id and item.is_available), '[]'::jsonb)
  ) into payload from tenants tenant join restaurant_tables restaurant_table on restaurant_table.tenant_id=tenant.id left join restaurant_settings settings on settings.tenant_id=tenant.id
  where tenant.slug=p_slug and tenant.status in ('active','trial') and restaurant_table.table_number=p_table_number and restaurant_table.status <> 'disabled' and coalesce(settings.ordering_enabled,true);
  return payload;
end $$;

create or replace function public.create_public_restaurant_order(p_table_token uuid, p_customer_phone text, p_items jsonb, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_table restaurant_tables%rowtype; v_tax numeric; v_order_id uuid; v_subtotal numeric:=0; v_quantity integer; v_item_id uuid; v_menu menu_items%rowtype; v_line numeric;
begin
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Your cart is empty'; end if;
 select rt.* into v_table from restaurant_tables rt join tenants t on t.id=rt.tenant_id left join restaurant_settings s on s.tenant_id=t.id where rt.public_token=p_table_token and rt.status <> 'disabled' and t.status in ('active','trial') and coalesce(s.ordering_enabled,true) for update of rt;
 if not found then raise exception 'This QR table is no longer accepting orders'; end if;
 select tax_rate into v_tax from restaurant_settings where tenant_id=v_table.tenant_id; v_tax:=coalesce(v_tax,0);
 insert into restaurant_orders(tenant_id,table_id,customer_phone,notes) values(v_table.tenant_id,v_table.id,nullif(trim(p_customer_phone),''),nullif(trim(p_notes),'')) returning id into v_order_id;
 for v_item_id,v_quantity in select (value->>'id')::uuid,(value->>'quantity')::integer from jsonb_array_elements(p_items) loop
  if v_quantity is null or v_quantity<1 or v_quantity>50 then raise exception 'Invalid item quantity'; end if;
  select * into v_menu from menu_items where id=v_item_id and tenant_id=v_table.tenant_id and is_available for share;
  if not found then raise exception 'An item in your cart is unavailable'; end if;
  v_line:=v_menu.price*v_quantity;v_subtotal:=v_subtotal+v_line;
  insert into restaurant_order_items(order_id,menu_item_id,item_name,unit_price,quantity,line_total) values(v_order_id,v_menu.id,v_menu.name,v_menu.price,v_quantity,v_line);
 end loop;
 update restaurant_orders set subtotal=v_subtotal,tax_amount=round(v_subtotal*v_tax/100,2),total=round(v_subtotal*(1+v_tax/100),2),updated_at=now() where id=v_order_id;
 update restaurant_tables set status='occupied',updated_at=now() where id=v_table.id and status='available';
 return (select jsonb_build_object('id',id,'order_number',order_number,'status',status,'total',total) from restaurant_orders where id=v_order_id);
end $$;
grant execute on function public.public_restaurant_menu(text,text) to anon,authenticated;
grant execute on function public.create_public_restaurant_order(uuid,text,jsonb,text) to anon,authenticated;
notify pgrst,'reload schema';
