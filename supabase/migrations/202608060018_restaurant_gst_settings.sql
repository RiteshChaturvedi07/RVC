alter table restaurant_settings add column if not exists tax_label text not null default 'GST';
notify pgrst,'reload schema';
