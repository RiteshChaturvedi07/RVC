-- RVC Control: super-admin reporting and auditable tenant administration.

create or replace function admin_dashboard_snapshot(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_super_admin() then raise exception 'Super-admin access required'; end if;
  select jsonb_build_object(
    'tenants_total', (select count(*) from tenants),
    'active_tenants', (select count(*) from tenants where status = 'active'),
    'trial_tenants', (select count(*) from tenants where status = 'trial'),
    'suspended_tenants', (select count(*) from tenants where status = 'suspended'),
    'platform_users', (select count(*) from profiles),
    'mrr', coalesce((select sum(amount) from subscriptions where payment_status = 'paid' and (next_due_date is null or next_due_date >= current_date)), 0),
    'verticals', coalesce((select jsonb_agg(jsonb_build_object('name', initcap(vertical), 'value', total) order by total desc) from (select vertical, count(*) total from tenants group by vertical) x), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'action', action, 'details', details, 'created_at', created_at) order by created_at desc) from (select * from audit_logs order by created_at desc limit 8) x), '[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function admin_set_tenant_status(p_tenant_id uuid, p_status text)
returns tenants language plpgsql security definer set search_path = public as $$
declare updated_tenant tenants;
begin
  if not is_super_admin() then raise exception 'Super-admin access required'; end if;
  if p_status not in ('trial', 'active', 'suspended') then raise exception 'Invalid status'; end if;
  update tenants set status = p_status where id = p_tenant_id returning * into updated_tenant;
  if not found then raise exception 'Tenant not found'; end if;
  insert into audit_logs(actor_id, action, target_tenant_id, details) values(auth.uid(), 'tenant.status_changed', p_tenant_id, jsonb_build_object('status', p_status));
  return updated_tenant;
end $$;

grant execute on function admin_dashboard_snapshot(integer) to authenticated;
grant execute on function admin_set_tenant_status(uuid, text) to authenticated;
