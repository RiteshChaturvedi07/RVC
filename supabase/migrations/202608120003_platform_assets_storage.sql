-- Public read is required because restaurant billing shows the platform's UPI QR.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('platform_assets','platform_assets',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];

drop policy if exists "Public reads platform assets" on storage.objects;
create policy "Public reads platform assets" on storage.objects
for select using (bucket_id='platform_assets');

drop policy if exists "Super admins manage platform assets" on storage.objects;
create policy "Super admins manage platform assets" on storage.objects
for all using (bucket_id='platform_assets' and public.is_super_admin())
with check (bucket_id='platform_assets' and public.is_super_admin());
