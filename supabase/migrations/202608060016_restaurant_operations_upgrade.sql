-- Operational upgrades: inventory categories, coupons, and persistent support chat.
alter table restaurant_inventory_items add column if not exists category text not null default 'General';
alter table restaurant_promotions add column if not exists coupon_code text;
alter table restaurant_promotions add column if not exists discount_type text not null default 'percent' check (discount_type in ('percent','flat'));
alter table restaurant_promotions add column if not exists discount_value numeric not null default 0;
alter table restaurant_promotions add column if not exists minimum_order_amount numeric not null default 0;
alter table restaurant_promotions add column if not exists max_discount_amount numeric;
alter table restaurant_orders add column if not exists coupon_code text;
alter table restaurant_orders add column if not exists discount_amount numeric(12,2) not null default 0;
create unique index if not exists restaurant_promotions_tenant_coupon_unique on restaurant_promotions(tenant_id,lower(coupon_code)) where coupon_code is not null;

create table if not exists support_ticket_messages (
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references support_tickets(id) on delete cascade,
 tenant_id uuid references tenants(id) on delete cascade, sender_id uuid references auth.users(id) on delete set null,
 body text not null check(length(trim(body)) > 0), created_at timestamptz not null default now()
);
alter table support_ticket_messages enable row level security;
drop policy if exists "Tenant members use support messages" on support_ticket_messages;
create policy "Tenant members use support messages" on support_ticket_messages for all using(tenant_member_of(tenant_id)) with check(tenant_member_of(tenant_id));
drop policy if exists "Admins use support messages" on support_ticket_messages;
create policy "Admins use support messages" on support_ticket_messages for all using(is_super_admin()) with check(is_super_admin());

create or replace function public.public_validate_restaurant_coupon(p_table_token uuid,p_code text,p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_tenant uuid; v_coupon restaurant_promotions%rowtype; v_discount numeric;
begin
 select tenant_id into v_tenant from restaurant_tables where public_token=p_table_token and status<>'disabled';
 if v_tenant is null then return jsonb_build_object('valid',false,'message','Invalid table'); end if;
 select * into v_coupon from restaurant_promotions where tenant_id=v_tenant and lower(coupon_code)=lower(trim(p_code)) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());
 if not found then return jsonb_build_object('valid',false,'message','Coupon is invalid or expired'); end if;
 if p_subtotal < v_coupon.minimum_order_amount then return jsonb_build_object('valid',false,'message',format('Minimum order is ₹%s',v_coupon.minimum_order_amount)); end if;
 v_discount:=case when v_coupon.discount_type='flat' then v_coupon.discount_value else round(p_subtotal*v_coupon.discount_value/100,2) end;
 v_discount:=least(v_discount,coalesce(v_coupon.max_discount_amount,v_discount),p_subtotal);
 return jsonb_build_object('valid',true,'code',v_coupon.coupon_code,'discount',v_discount,'message','Coupon applied');
end $$;

drop function if exists public.create_public_restaurant_order(uuid,text,text,jsonb,text);
create function public.create_public_restaurant_order(p_table_token uuid,p_customer_phone text,p_customer_name text,p_items jsonb,p_notes text default null,p_coupon_code text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_table restaurant_tables%rowtype; v_tax numeric; v_order_id uuid; v_subtotal numeric:=0; v_quantity integer; v_item_id uuid; v_menu menu_items%rowtype; v_line numeric; v_coupon restaurant_promotions%rowtype; v_discount numeric:=0;
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Your cart is empty'; end if;
 select rt.* into v_table from restaurant_tables rt join tenants t on t.id=rt.tenant_id left join restaurant_settings s on s.tenant_id=t.id where rt.public_token=p_table_token and rt.status<>'disabled' and t.status in ('active','trial') and coalesce(s.ordering_enabled,true) for update of rt;
 if not found then raise exception 'This QR table is no longer accepting orders'; end if;
 for v_item_id,v_quantity in select (value->>'id')::uuid,(value->>'quantity')::integer from jsonb_array_elements(p_items) loop
  if v_quantity is null or v_quantity<1 or v_quantity>50 then raise exception 'Invalid item quantity'; end if;
  select * into v_menu from menu_items where id=v_item_id and tenant_id=v_table.tenant_id and is_available for share; if not found then raise exception 'An item in your cart is unavailable'; end if;
  v_line:=v_menu.price*v_quantity;v_subtotal:=v_subtotal+v_line;
 end loop;
 if nullif(trim(coalesce(p_coupon_code,'')),'') is not null then
  select * into v_coupon from restaurant_promotions where tenant_id=v_table.tenant_id and lower(coupon_code)=lower(trim(p_coupon_code)) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());
  if not found or v_subtotal<v_coupon.minimum_order_amount then raise exception 'Coupon is invalid, expired, or minimum order is not met'; end if;
  v_discount:=case when v_coupon.discount_type='flat' then v_coupon.discount_value else round(v_subtotal*v_coupon.discount_value/100,2) end;v_discount:=least(v_discount,coalesce(v_coupon.max_discount_amount,v_discount),v_subtotal);
 end if;
 select tax_rate into v_tax from restaurant_settings where tenant_id=v_table.tenant_id;v_tax:=coalesce(v_tax,0);
 insert into restaurant_orders(tenant_id,table_id,customer_phone,customer_name,notes,coupon_code,discount_amount) values(v_table.tenant_id,v_table.id,nullif(trim(p_customer_phone),''),nullif(trim(p_customer_name),''),nullif(trim(p_notes),''),nullif(trim(p_coupon_code),''),v_discount) returning id into v_order_id;
 for v_item_id,v_quantity in select (value->>'id')::uuid,(value->>'quantity')::integer from jsonb_array_elements(p_items) loop select * into v_menu from menu_items where id=v_item_id;v_line:=v_menu.price*v_quantity;insert into restaurant_order_items(order_id,menu_item_id,item_name,unit_price,quantity,line_total) values(v_order_id,v_menu.id,v_menu.name,v_menu.price,v_quantity,v_line);end loop;
 update restaurant_orders set subtotal=v_subtotal,tax_amount=round((v_subtotal-v_discount)*v_tax/100,2),total=round((v_subtotal-v_discount)*(1+v_tax/100),2),updated_at=now() where id=v_order_id;
 update restaurant_tables set status='occupied',updated_at=now() where id=v_table.id and status='available';
 return (select jsonb_build_object('id',id,'order_number',order_number,'status',status,'total',total,'discount_amount',discount_amount) from restaurant_orders where id=v_order_id);
end $$;
grant execute on function public.public_validate_restaurant_coupon(uuid,text,numeric) to anon,authenticated;
grant execute on function public.create_public_restaurant_order(uuid,text,text,jsonb,text,text) to anon,authenticated;
notify pgrst,'reload schema';
