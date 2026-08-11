alter table public.support_tickets add column if not exists category text not null default 'General';
notify pgrst,'reload schema';
