# Supabase deployment

1. Run the original **Core Database Schema** from the attached file once.
2. Run `migrations/202608060001_restaurant_core.sql` once, in the Supabase SQL Editor. It adds the restaurant tables, safe RLS policies, public QR ordering RPCs, and the signup trigger.
3. Run `migrations/202608060002_admin_operations.sql` once. It powers the live RVC Control overview and secure tenant-status actions.
4. Run `migrations/202608060003_admin_workspaces.sql` once. It adds live tickets, platform settings, and auditable profile-role controls for RVC Control.
5. Run `migrations/202608060004_restaurant_operations.sql` once. It adds cash/online-ready payment records and secure restaurant bill settlement.
6. Run `migrations/202608060005_restaurant_management.sql` once. It activates real restaurant inventory, promotions, settings, and restaurant-created support tickets.
7. If a QR menu remains on the loading screen or Supabase reports the function missing, run `migrations/202608060006_repair_public_qr_menu.sql` once. It recreates and reloads the public menu API endpoint.
7. In **Authentication → Providers → Email**, configure your production site URL and redirect URLs. Email confirmation may remain enabled; the tenant is created safely when the auth user is created.
6. Create a restaurant account through `/register`. The new tenant starts as `trial`, so activate it before its QR menu can accept orders:

```sql
update tenants set status = 'active' where slug = 'YOUR-RESTAURANT-SLUG';
```

7. Add tables, categories, and menu items. Replace the slug and values below:

```sql
with tenant as (select id from tenants where slug = 'YOUR-RESTAURANT-SLUG')
insert into restaurant_tables (tenant_id, table_number, seats)
select id, '1', 4 from tenant;

with tenant as (select id from tenants where slug = 'YOUR-RESTAURANT-SLUG'), category as (
  insert into menu_categories (tenant_id, name, sort_order)
  select id, 'Starters', 1 from tenant
  returning id
)
insert into menu_items (tenant_id, category_id, name, description, price, is_featured)
select tenant.id, category.id, 'Paneer Tikka', 'Charred cottage cheese with mint chutney', 320, true
from tenant cross join category;
```

8. Get the QR URL for a table and encode it with any QR generator:

```sql
select 'https://YOUR-DOMAIN.com/order/' || t.slug || '/' || rt.table_number as qr_url
from restaurant_tables rt join tenants t on t.id = rt.tenant_id
where t.slug = 'YOUR-RESTAURANT-SLUG';
```

The browser uses only the Supabase anon key. Do not expose a service-role key in `.env.local` or in the client.
