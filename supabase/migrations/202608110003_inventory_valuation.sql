alter table public.restaurant_inventory_items add column if not exists unit_cost numeric(12,2) not null default 0 check(unit_cost >= 0);
alter table public.restaurant_inventory_items add column if not exists supplier_notes text;
notify pgrst,'reload schema';
