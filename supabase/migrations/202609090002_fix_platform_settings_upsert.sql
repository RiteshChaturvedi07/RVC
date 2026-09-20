-- 202609090002_fix_platform_settings_upsert.sql
-- Ensure platform_settings columns for UPI ID and UPI QR URL exist, update subscription_payment_requests billing cycle check constraint, and update RPC.

ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS rvc_upi_id text DEFAULT 'rvcpay@okaxis',
ADD COLUMN IF NOT EXISTS rvc_upi_qr_url text DEFAULT NULL;

-- Pre-populate platform_settings single row
INSERT INTO public.platform_settings (id, rvc_upi_id, rvc_upi_qr_url)
VALUES (true, 'rvcpay@okaxis', NULL)
ON CONFLICT (id) DO NOTHING;

-- Update subscription_payment_requests check constraint to allow 'quarterly'
ALTER TABLE public.subscription_payment_requests DROP CONSTRAINT IF EXISTS subscription_payment_requests_billing_cycle_check;
ALTER TABLE public.subscription_payment_requests ADD CONSTRAINT subscription_payment_requests_billing_cycle_check 
  CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly', 'lifetime'));

-- Update tenants check constraint to allow 'quarterly'
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_plan_billing_cycle_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_plan_billing_cycle_check 
  CHECK (plan_billing_cycle IN ('monthly', 'quarterly', 'yearly', 'lifetime'));

-- Update get_platform_payment_settings RPC
CREATE OR REPLACE FUNCTION public.get_platform_payment_settings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'rvc_upi_id', COALESCE(rvc_upi_id, 'rvcpay@okaxis'),
    'rvc_upi_qr_url', rvc_upi_qr_url,
    'invoice_prefix', COALESCE(invoice_prefix, 'RVC-INV'),
    'support_email', COALESCE(support_email, 'support@rvcplatform.in'),
    'support_phone', COALESCE(support_phone, '+91 98765 43210')
  )
  FROM public.platform_settings WHERE id = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_payment_settings() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
