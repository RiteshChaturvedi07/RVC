create or replace function public.get_platform_payment_settings()
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('rvc_upi_id',rvc_upi_id,'rvc_upi_qr_url',rvc_upi_qr_url)
 from public.platform_settings where id=true;
$$;
grant execute on function public.get_platform_payment_settings() to authenticated;
notify pgrst,'reload schema';
