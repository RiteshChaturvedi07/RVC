alter table tenants drop constraint if exists tenants_status_check;
alter table tenants add constraint tenants_status_check check(status in ('pending','trial','active','suspended','expired'));
create or replace function public.handle_new_rvc_user() returns trigger language plpgsql security definer set search_path=public as $$
declare v_tenant_id uuid; v_slug text; v_plan uuid;
begin
 if coalesce(new.raw_user_meta_data->>'business_name','')='' then insert into profiles(id,role,full_name) values(new.id,'customer',coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing;return new;end if;
 v_slug:=trim(both '-' from regexp_replace(lower(new.raw_user_meta_data->>'business_name'),'[^a-z0-9]+','-','g'))||'-'||substr(replace(new.id::text,'-',''),1,6);
 v_plan:=nullif(new.raw_user_meta_data->>'plan_id','')::uuid;
 insert into tenants(name,vertical,slug,owner_id,subscription_plan,status,plan_id,plan_billing_cycle) values(new.raw_user_meta_data->>'business_name',coalesce(new.raw_user_meta_data->>'business_type','restaurant'),v_slug,new.id,coalesce(new.raw_user_meta_data->>'plan','pending'),'pending',v_plan,coalesce(nullif(new.raw_user_meta_data->>'plan_billing_cycle',''),'monthly')) returning id into v_tenant_id;
 insert into profiles(id,tenant_id,role,full_name,phone) values(new.id,v_tenant_id,'tenant_owner',new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'phone');
 insert into restaurant_settings(tenant_id,display_name) values(v_tenant_id,new.raw_user_meta_data->>'business_name') on conflict(tenant_id) do nothing;return new;
end $$;
create or replace function public.admin_set_tenant_status(p_tenant_id uuid,p_status text)
returns tenants language plpgsql security definer set search_path=public as $$
declare saved tenants;
begin
 if not is_super_admin() then raise exception 'Super-admin access required'; end if;
 if p_status not in ('pending','trial','active','suspended','expired') then raise exception 'Invalid status'; end if;
 update tenants set status=p_status,is_frozen=(p_status='suspended'),freeze_reason=case when p_status='suspended' then coalesce(freeze_reason,'Suspended by RVC Control') else null end where id=p_tenant_id returning * into saved;
 if not found then raise exception 'Tenant not found'; end if;return saved;
end $$;
grant execute on function public.admin_set_tenant_status(uuid,text) to authenticated;
notify pgrst,'reload schema';
