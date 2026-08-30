-- Migration: Fix restaurant_settings missing schema columns, tax rates, and RPC function
alter table public.restaurant_settings add column if not exists logo_url text;
alter table public.restaurant_settings add column if not exists header_cover_url text;
alter table public.restaurant_settings add column if not exists tagline text;
alter table public.restaurant_settings add column if not exists email text;
alter table public.restaurant_settings add column if not exists city text;
alter table public.restaurant_settings add column if not exists state text;
alter table public.restaurant_settings add column if not exists takeaway_enabled boolean not null default true;
alter table public.restaurant_settings add column if not exists opening_time text;
alter table public.restaurant_settings add column if not exists closing_time text;
alter table public.restaurant_settings add column if not exists announcement_banner text;
alter table public.restaurant_settings add column if not exists is_gst_enabled boolean not null default true;
alter table public.restaurant_settings add column if not exists gstin text;
alter table public.restaurant_settings add column if not exists fssai_license text;
alter table public.restaurant_settings add column if not exists cgst_rate numeric(5,2) not null default 2.50;
alter table public.restaurant_settings add column if not exists sgst_rate numeric(5,2) not null default 2.50;
alter table public.restaurant_settings add column if not exists service_charge_rate numeric(5,2) not null default 0;
alter table public.restaurant_settings add column if not exists merchant_account_name text;
alter table public.restaurant_settings add column if not exists thermal_paper_size text not null default '80mm';
alter table public.restaurant_settings add column if not exists auto_print_kot boolean not null default true;
alter table public.restaurant_settings add column if not exists receipt_header_msg text;
alter table public.restaurant_settings add column if not exists receipt_footer_msg text;

-- Update tax_rate default for zero/null rows to 5.00 (2.5% CGST + 2.5% SGST)
update public.restaurant_settings 
set tax_rate = 5.00 
where (tax_rate is null or tax_rate = 0) and is_gst_enabled = true;

-- Update public_restaurant_menu RPC to return tax_rate, logo_url, tax_label
create or replace function public.public_restaurant_menu(p_slug text, p_table_number text)
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object(
  'restaurant', jsonb_build_object(
    'name', coalesce(s.display_name, t.name),
    'currency', coalesce(s.currency, 'INR'),
    'tax_rate', case when coalesce(s.is_gst_enabled, true) then coalesce(nullif(s.tax_rate, 0), coalesce(s.cgst_rate, 0) + coalesce(s.sgst_rate, 0), 5) else 0 end,
    'tax_label', coalesce(s.tax_label, 'GST'),
    'logo_url', s.logo_url,
    'merchant_upi_id', s.merchant_upi_id,
    'merchant_upi_qr_url', s.merchant_upi_qr_url
  ),
  'table', jsonb_build_object('id', rt.id, 'number', rt.table_number, 'token', rt.public_token),
  'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.sort_order, c.name) from menu_categories c where c.tenant_id = t.id and c.is_active), '[]'::jsonb),
  'items', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'description', m.description, 'price', m.price, 'category_id', m.category_id, 'category', c.name, 'image_url', m.image_url, 'is_featured', m.is_featured, 'is_vegetarian', m.is_vegetarian) order by m.sort_order, m.name) from menu_items m left join menu_categories c on c.id = m.category_id where m.tenant_id = t.id and m.is_available), '[]'::jsonb)
 ) from tenants t join restaurant_tables rt on rt.tenant_id = t.id left join restaurant_settings s on s.tenant_id = t.id
 where t.slug = p_slug and t.status in ('active', 'trial') and rt.table_number = p_table_number and rt.status <> 'disabled' and coalesce(s.ordering_enabled, true);
$$;

grant execute on function public.public_restaurant_menu(text, text) to anon, authenticated;
