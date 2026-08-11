alter table public.subscription_payment_requests add column if not exists rejection_note text;
create or replace function public.admin_approve_tenant_payment(p_invoice_id uuid,p_tenant_id uuid,p_plan_id uuid,p_duration_days integer)
returns public.subscription_payment_requests language plpgsql security definer set search_path=public as $$
declare saved public.subscription_payment_requests; base_time timestamptz;
begin
 if not is_super_admin() then raise exception 'Super-admin access required'; end if;
 if p_duration_days not in (30,365) then raise exception 'Invalid subscription duration'; end if;
 select * into saved from public.subscription_payment_requests where id=p_invoice_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Payment request not found'; end if;
 select greatest(coalesce(subscription_expires_at,subscription_end_date,now()),now()) into base_time from public.tenants where id=p_tenant_id;
 update public.tenants set plan_id=p_plan_id,status='active',subscription_status='active',is_frozen=false,freeze_reason=null,subscription_expires_at=base_time+make_interval(days=>p_duration_days),subscription_end_date=base_time+make_interval(days=>p_duration_days),subscription_starts_at=coalesce(subscription_starts_at,now()),subscription_start_date=coalesce(subscription_start_date,now()) where id=p_tenant_id;
 update public.subscription_payment_requests set status='paid',reviewed_at=now(),reviewed_by=auth.uid(),rejection_note=null where id=p_invoice_id returning * into saved;
 return saved;
end $$;
create or replace function public.admin_reject_tenant_payment(p_invoice_id uuid,p_note text default null)
returns public.subscription_payment_requests language plpgsql security definer set search_path=public as $$
declare saved public.subscription_payment_requests;
begin
 if not is_super_admin() then raise exception 'Super-admin access required'; end if;
 update public.subscription_payment_requests set status='rejected',rejection_note=nullif(trim(p_note),''),reviewed_at=now(),reviewed_by=auth.uid() where id=p_invoice_id returning * into saved;
 if not found then raise exception 'Payment request not found'; end if; return saved;
end $$;
grant execute on function public.admin_approve_tenant_payment(uuid,uuid,uuid,integer) to authenticated;
grant execute on function public.admin_reject_tenant_payment(uuid,text) to authenticated;
notify pgrst,'reload schema';
