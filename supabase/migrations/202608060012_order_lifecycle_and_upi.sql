-- Order lifecycle, customer details, table clearance, and merchant UPI setup.
alter table restaurant_tables drop constraint if exists restaurant_tables_status_check;
alter table restaurant_tables add constraint restaurant_tables_status_check check (status in ('available','occupied','reserved','cleaning','disabled'));
alter table restaurant_orders add column if not exists customer_name text;
alter table restaurant_settings add column if not exists merchant_upi_id text;
alter table restaurant_settings add column if not exists merchant_upi_qr_url text;
alter table restaurant_orders drop constraint if exists restaurant_orders_status_check;
alter table restaurant_orders add constraint restaurant_orders_status_check check (status in ('new','accepted','preparing','ready','served','completed','closed','cancelled'));

create or replace function public.clear_restaurant_table(p_table_id uuid, p_tenant_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not tenant_member_of(p_tenant_id) then raise exception 'Restaurant access required'; end if;
  if not exists(select 1 from restaurant_tables where id=p_table_id and tenant_id=p_tenant_id) then raise exception 'Table not found'; end if;
  update restaurant_orders set status='completed', updated_at=now()
  where table_id=p_table_id and tenant_id=p_tenant_id and status in ('new','accepted','preparing','ready','served');
  update restaurant_tables set status='available', updated_at=now() where id=p_table_id and tenant_id=p_tenant_id;
  insert into audit_logs(actor_id,action,target_tenant_id,details) values(auth.uid(),'restaurant.table_cleared',p_tenant_id,jsonb_build_object('table_id',p_table_id));
end $$;

drop function if exists public.create_public_restaurant_order(uuid,text,jsonb,text);
create function public.create_public_restaurant_order(p_table_token uuid, p_customer_phone text, p_customer_name text, p_items jsonb, p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_table restaurant_tables%rowtype; v_tax numeric; v_order_id uuid; v_subtotal numeric:=0; v_quantity integer; v_item_id uuid; v_menu menu_items%rowtype; v_line numeric;
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Your cart is empty'; end if;
 select rt.* into v_table from restaurant_tables rt join tenants t on t.id=rt.tenant_id left join restaurant_settings s on s.tenant_id=t.id where rt.public_token=p_table_token and rt.status<>'disabled' and t.status in ('active','trial') and coalesce(s.ordering_enabled,true) for update of rt;
 if not found then raise exception 'This QR table is no longer accepting orders'; end if;
 select tax_rate into v_tax from restaurant_settings where tenant_id=v_table.tenant_id; v_tax:=coalesce(v_tax,0);
 insert into restaurant_orders(tenant_id,table_id,customer_phone,customer_name,notes) values(v_table.tenant_id,v_table.id,nullif(trim(p_customer_phone),''),nullif(trim(p_customer_name),''),nullif(trim(p_notes),'')) returning id into v_order_id;
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

create or replace function public.public_restaurant_menu(p_slug text,p_table_number text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare payload jsonb;
begin
 select jsonb_build_object('restaurant',jsonb_build_object('name',coalesce(s.display_name,t.name),'currency',coalesce(s.currency,'INR'),'tax_rate',coalesce(s.tax_rate,0),'merchant_upi_id',s.merchant_upi_id,'merchant_upi_qr_url',s.merchant_upi_qr_url),'table',jsonb_build_object('id',rt.id,'number',rt.table_number,'token',rt.public_token),'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.sort_order,c.name) from menu_categories c where c.tenant_id=t.id and c.is_active),'[]'::jsonb),'items',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'description',m.description,'price',m.price,'category_id',m.category_id,'category',c.name,'image_url',m.image_url,'is_featured',m.is_featured,'is_vegetarian',m.is_vegetarian) order by m.sort_order,m.name) from menu_items m left join menu_categories c on c.id=m.category_id where m.tenant_id=t.id and m.is_available),'[]'::jsonb)) into payload from tenants t join restaurant_tables rt on rt.tenant_id=t.id left join restaurant_settings s on s.tenant_id=t.id where t.slug=p_slug and t.status in ('active','trial') and rt.table_number=p_table_number and rt.status<>'disabled' and coalesce(s.ordering_enabled,true);
 return payload;
end $$;

-- A receipt remains readable from the guest's saved order token even after a
-- staff member clears the physical table for the next party.
create or replace function public.public_restaurant_order_status(p_table_token uuid,p_order_id uuid)
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object(
   'id',o.id,
   'order_number',o.order_number,
   'status',o.status,
   'payment_status',o.payment_status,
   'payment_method',o.payment_method,
   'customer_name',o.customer_name,
   'customer_phone',o.customer_phone,
   'table_number',rt.table_number,
   'total',o.total,
   'created_at',o.created_at,
   'restaurant',jsonb_build_object(
      'name',coalesce(s.display_name,t.name),
      'currency',coalesce(s.currency,'INR'),
      'merchant_upi_id',s.merchant_upi_id,
      'merchant_upi_qr_url',s.merchant_upi_qr_url
   ),
   'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.item_name,'quantity',i.quantity,'unit_price',i.unit_price,'line_total',i.line_total) order by i.id) from restaurant_order_items i where i.order_id=o.id),'[]'::jsonb)
 )
 from restaurant_orders o
 join restaurant_tables rt on rt.id=o.table_id
 join tenants t on t.id=o.tenant_id
 left join restaurant_settings s on s.tenant_id=o.tenant_id
 where o.id=p_order_id and rt.public_token=p_table_token;
$$;
grant execute on function public.create_public_restaurant_order(uuid,text,text,jsonb,text) to anon,authenticated;
grant execute on function public.clear_restaurant_table(uuid,uuid) to authenticated;
grant execute on function public.public_restaurant_menu(text,text) to anon,authenticated;
grant execute on function public.public_restaurant_order_status(uuid,uuid) to anon,authenticated;
notify pgrst,'reload schema';
