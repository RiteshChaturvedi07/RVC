-- Migration: Add Tenant Audit Logs Table & RPC
CREATE TABLE IF NOT EXISTS public.tenant_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenant_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owners and staff can view audit events"
  ON public.tenant_audit_events
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE OR REPLACE FUNCTION public.log_tenant_audit_event(
  p_tenant_id uuid,
  p_action text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.tenant_audit_events (tenant_id, user_id, action, details)
  VALUES (p_tenant_id, auth.uid(), p_action, COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;
