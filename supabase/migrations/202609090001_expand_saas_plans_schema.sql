-- 202609090001_expand_saas_plans_schema.sql
-- Expand public.saas_plans table with multi-domain, quarterly pricing, promotional perks, and onboarding offer rules.

ALTER TABLE public.saas_plans 
ADD COLUMN IF NOT EXISTS target_vertical text DEFAULT 'restaurant',
ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS price_quarterly numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS promotional_perk text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS onboarding_offer_type text DEFAULT 'trial_7_day',
ADD COLUMN IF NOT EXISTS badge_text text DEFAULT NULL;

-- 1. Safely update saas_plans check constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'saas_plans_billing_interval_check'
    ) THEN
        ALTER TABLE public.saas_plans 
        ADD CONSTRAINT saas_plans_billing_interval_check 
        CHECK (billing_interval IN ('monthly', 'quarterly', 'yearly', 'lifetime'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'saas_plans_onboarding_offer_type_check'
    ) THEN
        ALTER TABLE public.saas_plans 
        ADD CONSTRAINT saas_plans_onboarding_offer_type_check 
        CHECK (onboarding_offer_type IN ('trial_7_day', 'promotional_bundle', 'direct_paid', 'free_tier'));
    END IF;
END $$;

-- 2. Update tenants table plan_billing_cycle check constraint to allow 'quarterly'
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_plan_billing_cycle_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_plan_billing_cycle_check 
  CHECK (plan_billing_cycle IN ('monthly', 'quarterly', 'yearly', 'lifetime'));

-- 3. Update handle_new_rvc_user trigger function with safe billing cycle handling & error boundaries
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
  v_cycle text;
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
  v_cycle := COALESCE(nullif(new.raw_user_meta_data->>'plan_billing_cycle', ''), 'monthly');
  IF v_cycle NOT IN ('monthly', 'quarterly', 'yearly', 'lifetime') THEN
    v_cycle := 'monthly';
  END IF;

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
    v_cycle,
    now(),
    now() + interval '7 days',
    now() + interval '7 days'
  ) RETURNING id INTO v_tenant_id;

  -- Create tenant owner profile
  INSERT INTO public.profiles (id, tenant_id, role, full_name, phone)
  VALUES (new.id, v_tenant_id, 'tenant_owner', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  -- Create default restaurant settings
  INSERT INTO public.restaurant_settings (tenant_id, display_name)
  VALUES (v_tenant_id, new.raw_user_meta_data->>'business_name')
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Safeguard fallback so user sign-up never crashes with 500
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (new.id, 'tenant_owner', COALESCE(new.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- 4. Update existing plans with sample promotional perks and vertical tags
UPDATE public.saas_plans 
SET 
  target_vertical = 'restaurant',
  price_quarterly = CASE 
    WHEN price_monthly > 0 THEN ROUND(price_monthly * 2.7) 
    ELSE 0 
  END,
  promotional_perk = CASE 
    WHEN name ILIKE '%pro%' OR name ILIKE '%growth%' OR is_popular = true THEN 'Get 10 Free QR Acrylic Stands + Free AI Menu Digitization'
    WHEN name ILIKE '%enterprise%' OR name ILIKE '%multi%' THEN 'Get 25 Free QR Acrylic Stands + Dedicated Onboarding Manager'
    ELSE 'Get 5 Free QR Table Stickers'
  END,
  badge_text = CASE 
    WHEN is_popular THEN '3-Month Promo Bundle'
    ELSE NULL
  END
WHERE target_vertical IS NULL OR price_quarterly = 0;

NOTIFY pgrst, 'reload schema';
