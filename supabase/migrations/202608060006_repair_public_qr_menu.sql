-- Repair for public QR menu lookup. Run this in the SAME Supabase project
-- configured in NEXT_PUBLIC_SUPABASE_URL.

drop function if exists public.public_restaurant_menu(text, text);

create function public.public_restaurant_menu(p_slug text, p_table_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare payload jsonb;
begin
  select jsonb_build_object(
    'restaurant', jsonb_build_object(
      'name', coalesce(settings.display_name, tenant.name),
      'currency', coalesce(settings.currency, 'INR'),
      'tax_rate', coalesce(settings.tax_rate, 0)
    ),
    'table', jsonb_build_object('id', restaurant_table.id, 'number', restaurant_table.table_number, 'token', restaurant_table.public_token),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', category.id, 'name', category.name) order by category.sort_order, category.name)
      from menu_categories category
      where category.tenant_id = tenant.id and category.is_active
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id, 'name', item.name, 'description', item.description,
        'price', item.price, 'category_id', item.category_id, 'category', category.name,
        'image_url', item.image_url, 'is_featured', item.is_featured, 'is_vegetarian', item.is_vegetarian
      ) order by item.sort_order, item.name)
      from menu_items item
      left join menu_categories category on category.id = item.category_id
      where item.tenant_id = tenant.id and item.is_available
    ), '[]'::jsonb)
  ) into payload
  from tenants tenant
  join restaurant_tables restaurant_table on restaurant_table.tenant_id = tenant.id
  left join restaurant_settings settings on settings.tenant_id = tenant.id
  where tenant.slug = p_slug
    and tenant.status = 'active'
    and restaurant_table.table_number = p_table_number
    and restaurant_table.status <> 'disabled'
    and coalesce(settings.ordering_enabled, true);

  return payload;
end;
$$;

grant execute on function public.public_restaurant_menu(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
