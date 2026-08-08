-- Assign an already registered RVC user to a restaurant without exposing auth.users to the browser.
create or replace function public.restaurant_add_staff(p_email text)
returns profiles language plpgsql security definer set search_path=public,auth as $$
declare v_tenant uuid; v_user uuid; saved profiles;
begin
 select tenant_id into v_tenant from profiles where id=auth.uid() and role='tenant_owner';
 if v_tenant is null then raise exception 'Restaurant owner access required'; end if;
 select id into v_user from auth.users where lower(email)=lower(trim(p_email));
 if v_user is null then raise exception 'This person must create an RVC account first, then you can add their login email.'; end if;
 update profiles set tenant_id=v_tenant,role='staff' where id=v_user returning * into saved;
 if not found then raise exception 'The registered account has no profile yet. Ask them to sign in once.'; end if;
 return saved;
end $$;

create or replace function public.restaurant_remove_staff(p_profile_id uuid)
returns profiles language plpgsql security definer set search_path=public as $$
declare v_tenant uuid; saved profiles;
begin
 select tenant_id into v_tenant from profiles where id=auth.uid() and role='tenant_owner';
 if v_tenant is null then raise exception 'Restaurant owner access required'; end if;
 update profiles set tenant_id=null,role='customer' where id=p_profile_id and tenant_id=v_tenant and role='staff' returning * into saved;
 if not found then raise exception 'Staff member not found'; end if;
 return saved;
end $$;
grant execute on function public.restaurant_add_staff(text) to authenticated;
grant execute on function public.restaurant_remove_staff(uuid) to authenticated;
notify pgrst,'reload schema';
