alter table public.restaurant_orders add column if not exists dining_type text not null default 'dine_in' check(dining_type in ('dine_in','takeaway'));
alter table public.restaurant_order_items add column if not exists notes text;
-- Preserve the existing pricing/coupon function and add guest dining metadata.
drop function if exists public.create_public_restaurant_order(uuid,text,text,jsonb,text,text);
create function public.create_public_restaurant_order(p_table_token uuid,p_customer_phone text,p_customer_name text,p_items jsonb,p_notes text default null,p_coupon_code text default null,p_dining_type text default 'dine_in')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_table restaurant_tables%rowtype;v_tax numeric;v_order_id uuid;v_session_id uuid;v_subtotal numeric:=0;v_quantity integer;v_item_id uuid;v_menu menu_items%rowtype;v_line numeric;v_coupon restaurant_promotions%rowtype;v_discount numeric:=0;v_item_notes text;
begin
 if p_dining_type not in ('dine_in','takeaway') then raise exception 'Invalid dining type'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Your cart is empty'; end if;
 select rt.* into v_table from restaurant_tables rt join tenants t on t.id=rt.tenant_id left join restaurant_settings rs on rs.tenant_id=t.id where rt.public_token=p_table_token and rt.status<>'disabled' and t.status in ('active','trial') and coalesce(rs.ordering_enabled,true) for update of rt;
 if not found then raise exception 'This QR table is no longer accepting orders'; end if;
 select id into v_session_id from restaurant_table_sessions where table_id=v_table.id and status='open' order by started_at desc limit 1 for update;
 if v_session_id is null then insert into restaurant_table_sessions(tenant_id,table_id) values(v_table.tenant_id,v_table.id) returning id into v_session_id; end if;
 for v_item_id,v_quantity in select (value->>'id')::uuid,(value->>'quantity')::integer from jsonb_array_elements(p_items) loop
  if v_quantity is null or v_quantity<1 or v_quantity>50 then raise exception 'Invalid item quantity'; end if;
  select * into v_menu from menu_items where id=v_item_id and tenant_id=v_table.tenant_id and is_available for share;if not found then raise exception 'An item in your cart is unavailable';end if;v_subtotal:=v_subtotal+v_menu.price*v_quantity;
 end loop;
 if nullif(trim(coalesce(p_coupon_code,'')),'') is not null then select * into v_coupon from restaurant_promotions where tenant_id=v_table.tenant_id and lower(coupon_code)=lower(trim(p_coupon_code)) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());if not found or v_subtotal<v_coupon.minimum_order_amount then raise exception 'Coupon is invalid, expired, or minimum order is not met';end if;v_discount:=case when v_coupon.discount_type='flat' then v_coupon.discount_value else round(v_subtotal*v_coupon.discount_value/100,2) end;v_discount:=least(v_discount,coalesce(v_coupon.max_discount_amount,v_discount),v_subtotal);end if;
 select tax_rate into v_tax from restaurant_settings where tenant_id=v_table.tenant_id;v_tax:=coalesce(v_tax,0);
 insert into restaurant_orders(tenant_id,table_id,table_session_id,customer_phone,customer_name,notes,coupon_code,discount_amount,dining_type) values(v_table.tenant_id,v_table.id,v_session_id,nullif(trim(p_customer_phone),''),nullif(trim(p_customer_name),''),nullif(trim(p_notes),''),nullif(trim(p_coupon_code),''),v_discount,p_dining_type) returning id into v_order_id;
 for v_item_id,v_quantity,v_item_notes in select (value->>'id')::uuid,(value->>'quantity')::integer,nullif(trim(value->>'notes'),'') from jsonb_array_elements(p_items) loop select * into v_menu from menu_items where id=v_item_id;v_line:=v_menu.price*v_quantity;insert into restaurant_order_items(order_id,menu_item_id,item_name,unit_price,quantity,line_total,notes) values(v_order_id,v_menu.id,v_menu.name,v_menu.price,v_quantity,v_line,v_item_notes);end loop;
 update restaurant_orders set subtotal=v_subtotal,tax_amount=round((v_subtotal-v_discount)*v_tax/100,2),total=round((v_subtotal-v_discount)*(1+v_tax/100),2),updated_at=now() where id=v_order_id;
 update restaurant_tables set status='occupied',updated_at=now() where id=v_table.id and status='available';
 return(select jsonb_build_object('id',id,'order_number',order_number,'status',status,'total',total)from restaurant_orders where id=v_order_id);
end $$;
grant execute on function public.create_public_restaurant_order(uuid,text,text,jsonb,text,text,text) to anon,authenticated;
create or replace function public.public_restaurant_table_session_orders(p_table_token uuid)
returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'payment_status',o.payment_status,'payment_method',o.payment_method,'total',o.total,'subtotal',o.subtotal,'tax_amount',o.tax_amount,'discount_amount',o.discount_amount,'created_at',o.created_at,'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.item_name,'quantity',i.quantity,'unit_price',i.unit_price,'line_total',i.line_total,'notes',i.notes) order by i.id) from public.restaurant_order_items i where i.order_id=o.id),'[]'::jsonb)) order by o.created_at),'[]'::jsonb)
 from public.restaurant_tables rt join public.restaurant_table_sessions s on s.table_id=rt.id and s.status='open' join public.restaurant_orders o on o.table_session_id=s.id where rt.public_token=p_table_token;
$$;
grant execute on function public.public_restaurant_table_session_orders(uuid) to anon,authenticated;
notify pgrst,'reload schema';
