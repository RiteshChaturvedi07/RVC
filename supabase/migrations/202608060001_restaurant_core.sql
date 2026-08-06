-- RVC Restaurant SaaS: run AFTER the core schema supplied with the project.
-- This migration is safe to run once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists restaurant_settings (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  display_name text not null,
  currency text not null default 'INR',
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  ordering_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  table_number text not null,
  display_name text,
  seats integer check (seats is null or seats > 0),
  status text not null default 'available' check (status in ('available','occupied','reserved','disabled')),
  public_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, table_number)
);

create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (tenant_id, name)
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  image_url text,
  is_vegetarian boolean,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists restaurant_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  table_id uuid not null references restaurant_tables(id),
  order_number bigint generated always as identity unique,
  customer_phone text,
  status text not null default 'new' check (status in ('new','accepted','preparing','ready','served','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists restaurant_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references restaurant_orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  item_name text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null
);

create index if not exists restaurant_orders_tenant_created_idx on restaurant_orders(tenant_id, created_at desc);
create index if not exists menu_items_tenant_available_idx on menu_items(tenant_id, is_available);

-- Tenant isolation for back-office users.
alter table restaurant_settings enable row level security;
alter table restaurant_tables enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table restaurant_orders enable row level security;
alter table restaurant_order_items enable row level security;

create or replace function tenant_member_of(target_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super_admin() or exists (
    select 1 from profiles where id = auth.uid() and tenant_id = target_tenant and role in ('tenant_owner','staff')
  );
$$;

do $$ declare tbl text; begin
  foreach tbl in array array['restaurant_settings','restaurant_tables','menu_categories','menu_items','restaurant_orders'] loop
    execute format('drop policy if exists "Tenant staff manage %s" on %I', tbl, tbl);
    execute format('create policy "Tenant staff manage %s" on %I for all using (tenant_member_of(tenant_id)) with check (tenant_member_of(tenant_id))', tbl, tbl);
  end loop;
end $$;

drop policy if exists "Tenant staff manage order items" on restaurant_order_items;
create policy "Tenant staff manage order items" on restaurant_order_items for all using (
  exists (select 1 from restaurant_orders o where o.id = order_id and tenant_member_of(o.tenant_id))
) with check (
  exists (select 1 from restaurant_orders o where o.id = order_id and tenant_member_of(o.tenant_id))
);

-- Public QR menu lookup. The token is checked against the table; no table data is exposed directly.
create or replace function public_restaurant_menu(p_slug text, p_table_number text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'restaurant', jsonb_build_object('name', coalesce(s.display_name, t.name), 'currency', coalesce(s.currency, 'INR'), 'tax_rate', coalesce(s.tax_rate, 0)),
    'table', jsonb_build_object('id', rt.id, 'number', rt.table_number, 'token', rt.public_token),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.sort_order, c.name) from menu_categories c where c.tenant_id=t.id and c.is_active), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'description', m.description, 'price', m.price, 'category_id', m.category_id, 'category', c.name, 'image_url', m.image_url, 'is_featured', m.is_featured, 'is_vegetarian', m.is_vegetarian) order by m.sort_order, m.name) from menu_items m left join menu_categories c on c.id=m.category_id where m.tenant_id=t.id and m.is_available), '[]'::jsonb)
  ) into result
  from tenants t join restaurant_tables rt on rt.tenant_id=t.id left join restaurant_settings s on s.tenant_id=t.id
  where t.slug=p_slug and t.status='active' and rt.table_number=p_table_number and rt.status <> 'disabled' and coalesce(s.ordering_enabled, true);
  return result;
end $$;

-- Atomically price orders on the database. Never trust price or totals sent by a browser.
create or replace function create_public_restaurant_order(p_table_token uuid, p_customer_phone text, p_items jsonb, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_table restaurant_tables%rowtype; v_tax numeric; v_order_id uuid; v_subtotal numeric := 0; v_quantity integer; v_item_id uuid; v_menu menu_items%rowtype; v_line numeric;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  select rt.* into v_table from restaurant_tables rt join tenants t on t.id=rt.tenant_id left join restaurant_settings s on s.tenant_id=t.id where rt.public_token=p_table_token and rt.status <> 'disabled' and t.status='active' and coalesce(s.ordering_enabled, true) for update;
  if not found then raise exception 'This QR table is no longer accepting orders'; end if;
  select tax_rate into v_tax from restaurant_settings where tenant_id=v_table.tenant_id;
  v_tax := coalesce(v_tax, 0);
  insert into restaurant_orders(tenant_id, table_id, customer_phone, notes) values(v_table.tenant_id, v_table.id, nullif(trim(p_customer_phone), ''), nullif(trim(p_notes), '')) returning id into v_order_id;
  for v_item_id, v_quantity in select (value->>'id')::uuid, (value->>'quantity')::integer from jsonb_array_elements(p_items) loop
    if v_quantity is null or v_quantity < 1 or v_quantity > 50 then raise exception 'Invalid item quantity'; end if;
    select * into v_menu from menu_items where id=v_item_id and tenant_id=v_table.tenant_id and is_available for share;
    if not found then raise exception 'An item in your cart is unavailable'; end if;
    v_line := v_menu.price * v_quantity; v_subtotal := v_subtotal + v_line;
    insert into restaurant_order_items(order_id, menu_item_id, item_name, unit_price, quantity, line_total) values(v_order_id, v_menu.id, v_menu.name, v_menu.price, v_quantity, v_line);
  end loop;
  update restaurant_orders set subtotal=v_subtotal, tax_amount=round(v_subtotal*v_tax/100, 2), total=round(v_subtotal*(1+v_tax/100), 2), updated_at=now() where id=v_order_id;
  update restaurant_tables set status='occupied', updated_at=now() where id=v_table.id and status='available';
  return (select jsonb_build_object('id', id, 'order_number', order_number, 'status', status, 'total', total) from restaurant_orders where id=v_order_id);
end $$;

grant execute on function public_restaurant_menu(text, text) to anon, authenticated;
grant execute on function create_public_restaurant_order(uuid, text, jsonb, text) to anon, authenticated;

-- Prevent role escalation in the original signup policy. Account creation is handled through auth metadata below.
drop policy if exists "Authenticated users can create a tenant on signup" on tenants;
drop policy if exists "Owner can view tenant they created" on tenants;
drop policy if exists "Users can insert their own profile on signup" on profiles;
drop policy if exists "Users can update their own profile" on profiles;
create policy "Users update safe profile fields" on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()) and tenant_id is not distinct from (select tenant_id from profiles where id = auth.uid()));

create or replace function handle_new_rvc_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_tenant_id uuid; v_slug text;
begin
  if coalesce(new.raw_user_meta_data->>'business_name','') = '' then
    insert into profiles(id, role, full_name) values(new.id, 'customer', coalesce(new.raw_user_meta_data->>'full_name','')) on conflict (id) do nothing;
    return new;
  end if;
  v_slug := regexp_replace(lower(new.raw_user_meta_data->>'business_name'), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug) || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  insert into tenants(name, vertical, slug, owner_id, subscription_plan, status) values(new.raw_user_meta_data->>'business_name', coalesce(new.raw_user_meta_data->>'business_type','other'), v_slug, new.id, coalesce(new.raw_user_meta_data->>'plan','starter'), 'trial') returning id into v_tenant_id;
  insert into profiles(id, tenant_id, role, full_name, phone) values(new.id, v_tenant_id, 'tenant_owner', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  if new.raw_user_meta_data->>'business_type' = 'restaurant' then insert into restaurant_settings(tenant_id, display_name) values(v_tenant_id, new.raw_user_meta_data->>'business_name'); end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created_rvc on auth.users;
create trigger on_auth_user_created_rvc after insert on auth.users for each row execute procedure handle_new_rvc_user();
