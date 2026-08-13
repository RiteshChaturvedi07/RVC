-- Restaurant owners control MFA for their own workspace. RVC Control remains
-- mandatory MFA in application access guards.
alter table public.restaurant_settings add column if not exists mfa_required boolean not null default false;
notify pgrst,'reload schema';
