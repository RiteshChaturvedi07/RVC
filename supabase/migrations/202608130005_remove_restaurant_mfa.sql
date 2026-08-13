-- Restaurant workspaces use email + password only. MFA remains mandatory for
-- RVC Control super-admin accounts in the application access guard.
alter table public.restaurant_settings drop column if exists mfa_required;
notify pgrst,'reload schema';
