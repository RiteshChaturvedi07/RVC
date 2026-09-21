-- Migration: Customer Order Tracker RPC overload and Restaurant Order Feedback Table

-- 1. Create restaurant_order_feedback table for reviews
CREATE TABLE IF NOT EXISTS public.restaurant_order_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  table_number text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  tags text[] DEFAULT '{}'::text[],
  comments text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS restaurant_order_feedback_tenant_id_idx ON public.restaurant_order_feedback (tenant_id);
CREATE INDEX IF NOT EXISTS restaurant_order_feedback_order_id_idx ON public.restaurant_order_feedback (order_id);

ALTER TABLE public.restaurant_order_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public customer can insert feedback" ON public.restaurant_order_feedback;
CREATE POLICY "Public customer can insert feedback" ON public.restaurant_order_feedback FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant staff view feedback" ON public.restaurant_order_feedback;
CREATE POLICY "Tenant staff view feedback" ON public.restaurant_order_feedback FOR ALL USING (tenant_member_of(tenant_id)) WITH CHECK (tenant_member_of(tenant_id));

GRANT ALL ON public.restaurant_order_feedback TO anon, authenticated;

-- 2. RPC to fetch order status by order_id directly (without requiring table_token)
CREATE OR REPLACE FUNCTION public.public_restaurant_order_status(p_order_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'table_number', rt.table_number,
    'table_token', rt.public_token,
    'tenant_slug', t.slug,
    'total', o.total,
    'subtotal', o.subtotal,
    'tax_amount', o.tax_amount,
    'discount_amount', o.discount_amount,
    'created_at', o.created_at,
    'restaurant', jsonb_build_object(
      'name', coalesce(s.display_name, t.name),
      'currency', coalesce(s.currency, 'INR'),
      'merchant_upi_id', s.merchant_upi_id,
      'merchant_upi_qr_url', s.merchant_upi_qr_url
    ),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'name', i.item_name,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'line_total', i.line_total,
        'notes', i.notes
      ) ORDER BY i.id)
      FROM public.restaurant_order_items i
      WHERE i.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.restaurant_orders o
  JOIN public.restaurant_tables rt ON rt.id = o.table_id
  JOIN public.tenants t ON t.id = o.tenant_id
  LEFT JOIN public.restaurant_settings s ON s.tenant_id = o.tenant_id
  WHERE o.id = p_order_id;
$$;

GRANT EXECUTE ON FUNCTION public.public_restaurant_order_status(uuid) TO anon, authenticated;

-- 3. RPC to submit order feedback
CREATE OR REPLACE FUNCTION public.submit_restaurant_order_feedback(
  p_order_id uuid,
  p_rating integer,
  p_tags text[] DEFAULT '{}'::text[],
  p_comments text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.restaurant_orders%rowtype;
  v_table public.restaurant_tables%rowtype;
  v_feedback_id uuid;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  SELECT * INTO v_order FROM public.restaurant_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT table_number INTO v_table.table_number FROM public.restaurant_tables WHERE id = v_order.table_id;

  INSERT INTO public.restaurant_order_feedback (
    tenant_id,
    order_id,
    table_number,
    rating,
    tags,
    comments
  ) VALUES (
    v_order.tenant_id,
    v_order.id,
    coalesce(v_table.table_number, 'QR'),
    p_rating,
    coalesce(p_tags, '{}'::text[]),
    nullif(trim(p_comments), '')
  ) RETURNING id INTO v_feedback_id;

  RETURN jsonb_build_object('success', true, 'id', v_feedback_id);
END $$;

GRANT EXECUTE ON FUNCTION public.submit_restaurant_order_feedback(uuid, integer, text[], text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
