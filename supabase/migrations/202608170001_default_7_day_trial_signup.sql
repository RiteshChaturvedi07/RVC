-- Migration: Default new signups to 7-Day Trial version instead of Pending Approval

-- 1. Update trigger function for new user signups
CREATE OR REPLACE FUNCTION public.handle_new_rvc_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_slug text;
  v_plan uuid;
BEGIN
  -- If customer account, skip tenant creation
  IF COALESCE(new.raw_user_meta_data->>'business_name', '') = '' THEN
    INSERT INTO public.profiles (id, role, full_name)
    VALUES (new.id, 'customer', COALESCE(new.raw_user_meta_data->>'full_name', ''))
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
  END IF;

  -- Generate unique slug for tenant
  v_slug := trim(both '-' from regexp_replace(lower(new.raw_user_meta_data->>'business_name'), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  v_plan := nullif(new.raw_user_meta_data->>'plan_id', '')::uuid;

  -- Insert tenant with default 'trial' status and 7 days trial period window
  INSERT INTO public.tenants (
    name,
    vertical,
    slug,
    owner_id,
    subscription_plan,
    status,
    plan_id,
    plan_billing_cycle,
    subscription_start_date,
    subscription_end_date,
    subscription_expires_at
  ) VALUES (
    new.raw_user_meta_data->>'business_name',
    COALESCE(new.raw_user_meta_data->>'business_type', 'restaurant'),
    v_slug,
    new.id,
    COALESCE(new.raw_user_meta_data->>'plan', 'starter'),
    'trial',
    v_plan,
    COALESCE(nullif(new.raw_user_meta_data->>'plan_billing_cycle', ''), 'monthly'),
    now(),
    now() + interval '7 days',
    now() + interval '7 days'
  ) RETURNING id INTO v_tenant_id;

  -- Create tenant owner profile
  INSERT INTO public.profiles (id, tenant_id, role, full_name, phone)
  VALUES (new.id, v_tenant_id, 'tenant_owner', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');

  -- Create default restaurant settings
  INSERT INTO public.restaurant_settings (tenant_id, display_name)
  VALUES (v_tenant_id, new.raw_user_meta_data->>'business_name')
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN new;
END;
$$;

-- 2. Backfill existing 'pending' tenants to 'trial' status with 7-day window from their creation date
UPDATE public.tenants
SET
  status = 'trial',
  subscription_start_date = COALESCE(subscription_start_date, created_at),
  subscription_end_date = COALESCE(subscription_end_date, created_at + interval '7 days'),
  subscription_expires_at = COALESCE(subscription_expires_at, created_at + interval '7 days')
WHERE status = 'pending';

NOTIFY pgrst, 'reload schema';
