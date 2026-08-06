-- Restaurant management modules: inventory, promotions, guest support and profile fields.
alter table restaurant_settings add column if not exists address text;
alter table restaurant_settings add column if not exists phone text;
alter table restaurant_settings add column if not exists order_notifications boolean not null default true;

create table if not exists restaurant_inventory_items (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade,
 name text not null, unit text not null default 'unit', quantity numeric not null default 0, reorder_level numeric not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,name)
);
create table if not exists restaurant_promotions (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references tenants(id) on delete cascade,
 name text not null, description text, discount_percent numeric check(discount_percent between 0 and 100), active boolean not null default true,
 starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now()
);
alter table restaurant_inventory_items enable row level security;
alter table restaurant_promotions enable row level security;
create policy "Tenant staff manage inventory" on restaurant_inventory_items for all using(tenant_member_of(tenant_id)) with check(tenant_member_of(tenant_id));
create policy "Tenant staff manage promotions" on restaurant_promotions for all using(tenant_member_of(tenant_id)) with check(tenant_member_of(tenant_id));
drop policy if exists "Tenant owners manage own support tickets" on support_tickets;
create policy "Tenant owners manage own support tickets" on support_tickets for all using(exists(select 1 from profiles p where p.id=auth.uid() and p.tenant_id=support_tickets.tenant_id and p.role in ('tenant_owner','staff'))) with check(exists(select 1 from profiles p where p.id=auth.uid() and p.tenant_id=support_tickets.tenant_id and p.role in ('tenant_owner','staff')));
