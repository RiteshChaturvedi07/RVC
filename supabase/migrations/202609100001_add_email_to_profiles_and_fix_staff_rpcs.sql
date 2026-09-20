-- Migration: Add email & updated_at columns to profiles, backfill emails, update RLS, and fix staff RPCs without FK leaks

-- 1. Add email and updated_at columns to public.profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Create index on lower(email) for fast staff lookups
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (lower(email));

-- 3. Backfill existing profiles with email from auth.users
UPDATE public.profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 4. Enable RLS and add tenant staff management policies on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant managers can insert staff profiles" ON public.profiles;
CREATE POLICY "Tenant managers can insert staff profiles" ON public.profiles
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Tenant managers can update staff profiles" ON public.profiles;
CREATE POLICY "Tenant managers can update staff profiles" ON public.profiles
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tenant_id = public.profiles.tenant_id)
);

-- 5. Update handle_new_rvc_user trigger to save email on signup
CREATE OR REPLACE FUNCTION public.handle_new_rvc_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant_id uuid;
  v_slug text;
BEGIN
  IF coalesce(new.raw_user_meta_data->>'business_name','') = '' THEN
    INSERT INTO public.profiles(id, email, role, full_name, updated_at)
    VALUES(new.id, lower(new.email), 'customer', coalesce(new.raw_user_meta_data->>'full_name',''), now())
    ON CONFLICT (id) DO UPDATE SET email = excluded.email, updated_at = now();
    RETURN new;
  END IF;

  v_slug := regexp_replace(lower(new.raw_user_meta_data->>'business_name'), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug) || '-' || substr(replace(new.id::text, '-', ''), 1, 6);

  INSERT INTO public.tenants(name, vertical, slug, owner_id, subscription_plan, status)
  VALUES(new.raw_user_meta_data->>'business_name', coalesce(new.raw_user_meta_data->>'business_type','other'), v_slug, new.id, coalesce(new.raw_user_meta_data->>'plan','starter'), 'trial')
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles(id, email, tenant_id, role, full_name, phone, updated_at)
  VALUES(new.id, lower(new.email), v_tenant_id, 'tenant_owner', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone', now())
  ON CONFLICT (id) DO UPDATE SET tenant_id = excluded.tenant_id, role = excluded.role, email = excluded.email, updated_at = now();

  IF new.raw_user_meta_data->>'business_type' = 'restaurant' THEN
    INSERT INTO public.restaurant_settings(tenant_id, display_name)
    VALUES(v_tenant_id, new.raw_user_meta_data->>'business_name')
    ON CONFLICT (tenant_id) DO NOTHING;
  END IF;

  RETURN new;
END $$;

-- 6. Fix restaurant_add_staff functions with clean exception for unregistered users (No FK leaks)
CREATE OR REPLACE FUNCTION public.restaurant_add_staff(
  p_email text
)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_tenant uuid;
  v_user uuid;
  saved public.profiles;
  clean_email text;
BEGIN
  clean_email := lower(trim(p_email));
  IF clean_email IS NULL OR clean_email = '' THEN
    RAISE EXCEPTION 'Email address is required to add staff.';
  END IF;

  -- Get current user's tenant ID from profiles
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL LIMIT 1;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Authorized restaurant tenant access is required.';
  END IF;

  -- 1. Check if user exists in auth.users by email
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = clean_email LIMIT 1;

  IF v_user IS NULL THEN
    -- 2. Check if a profile exists by email
    SELECT id INTO v_user FROM public.profiles WHERE lower(email) = clean_email LIMIT 1;
  END IF;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No registered RVC account found for "%". Ask them to sign up for an RVC account first.', clean_email;
  END IF;

  -- Upsert profile with staff role and tenant_id
  INSERT INTO public.profiles (id, email, tenant_id, role, updated_at)
  VALUES (v_user, clean_email, v_tenant, 'staff', now())
  ON CONFLICT (id) DO UPDATE SET
    tenant_id = excluded.tenant_id,
    role = 'staff',
    email = excluded.email,
    updated_at = now()
  RETURNING * INTO saved;

  RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.restaurant_add_staff(
  p_email text,
  p_full_name text,
  p_phone text
)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  saved public.profiles;
BEGIN
  saved := public.restaurant_add_staff(p_email);

  IF saved.id IS NOT NULL THEN
    UPDATE public.profiles SET
      full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone = coalesce(nullif(trim(p_phone), ''), phone),
      updated_at = now()
    WHERE id = saved.id
    RETURNING * INTO saved;
  END IF;

  RETURN saved;
END $$;

-- 7. Fix restaurant_save_staff_assignment
CREATE OR REPLACE FUNCTION public.restaurant_save_staff_assignment(
  p_profile_id uuid,
  p_role_label text,
  p_permissions jsonb
)
RETURNS public.restaurant_staff_assignments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid;
  saved public.restaurant_staff_assignments;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL LIMIT 1;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Authorized restaurant tenant access is required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_profile_id AND tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'Staff member profile not found in your restaurant tenant.';
  END IF;

  INSERT INTO public.restaurant_staff_assignments (profile_id, tenant_id, role_label, permissions, is_active, updated_at)
  VALUES (
    p_profile_id,
    v_tenant,
    coalesce(nullif(trim(p_role_label), ''), 'Waiter / Service'),
    coalesce(p_permissions, '[]'::jsonb),
    true,
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    role_label = excluded.role_label,
    permissions = excluded.permissions,
    is_active = true,
    updated_at = now()
  RETURNING * INTO saved;

  RETURN saved;
END $$;

-- 8. Fix restaurant_remove_staff
CREATE OR REPLACE FUNCTION public.restaurant_remove_staff(p_profile_id uuid)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid;
  saved public.profiles;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL LIMIT 1;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Authorized restaurant tenant access is required.';
  END IF;

  DELETE FROM public.restaurant_staff_assignments WHERE profile_id = p_profile_id;

  UPDATE public.profiles SET tenant_id = null, role = 'customer', updated_at = now()
  WHERE id = p_profile_id AND tenant_id = v_tenant AND role = 'staff'
  RETURNING * INTO saved;

  RETURN saved;
END $$;

GRANT EXECUTE ON FUNCTION public.restaurant_add_staff(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_add_staff(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_save_staff_assignment(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_remove_staff(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
