-- Migration: Table session anti-abuse token, timeout settings, and waiter calls table

-- 1. Add current_session_token to restaurant_tables if missing
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS current_session_token uuid DEFAULT gen_random_uuid();
UPDATE public.restaurant_tables SET current_session_token = gen_random_uuid() WHERE current_session_token IS NULL;

-- 2. Add session timeout config columns to restaurant_settings if missing
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS session_timeout_unit text DEFAULT 'minutes' CHECK (session_timeout_unit IN ('seconds', 'minutes'));
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS session_timeout_value integer DEFAULT 10 CHECK (session_timeout_value > 0);

-- 3. Create restaurant_service_requests table for real-time waiter calls
CREATE TABLE IF NOT EXISTS public.restaurant_service_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  table_number text NOT NULL,
  request_type text NOT NULL DEFAULT 'waiter' CHECK (request_type IN ('waiter', 'water', 'bill', 'cleaning')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS restaurant_service_requests_tenant_status_idx ON public.restaurant_service_requests (tenant_id, status);

ALTER TABLE public.restaurant_service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public customer can request waiter service" ON public.restaurant_service_requests;
CREATE POLICY "Public customer can request waiter service" ON public.restaurant_service_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant staff manage service requests" ON public.restaurant_service_requests;
CREATE POLICY "Tenant staff manage service requests" ON public.restaurant_service_requests FOR ALL USING (tenant_member_of(tenant_id)) WITH CHECK (tenant_member_of(tenant_id));

GRANT ALL ON public.restaurant_service_requests TO anon, authenticated;

-- 4. RPC for public customers to trigger waiter call service request reliably
CREATE OR REPLACE FUNCTION public.public_call_restaurant_waiter(p_table_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_table restaurant_tables%rowtype; v_req_id uuid;
BEGIN
  SELECT * INTO v_table FROM restaurant_tables WHERE public_token = p_table_token AND status <> 'disabled';
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid table QR code'; END IF;

  INSERT INTO restaurant_service_requests (tenant_id, table_id, table_number, request_type, status)
  VALUES (v_table.tenant_id, v_table.id, v_table.table_number, 'waiter', 'pending')
  RETURNING id INTO v_req_id;

  RETURN jsonb_build_object('success', true, 'id', v_req_id, 'table_number', v_table.table_number);
END $$;

GRANT EXECUTE ON FUNCTION public.public_call_restaurant_waiter(uuid) TO anon, authenticated;

-- 5. Update public_restaurant_menu to return session token & timeout config
CREATE OR REPLACE FUNCTION public.public_restaurant_menu(p_slug text, p_table_number text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'restaurant', jsonb_build_object(
      'name', coalesce(s.display_name, t.name),
      'currency', coalesce(s.currency, 'INR'),
      'tax_rate', coalesce(s.tax_rate, 0),
      'merchant_upi_id', s.merchant_upi_id,
      'merchant_upi_qr_url', s.merchant_upi_qr_url,
      'session_timeout_unit', coalesce(s.session_timeout_unit, 'minutes'),
      'session_timeout_value', coalesce(s.session_timeout_value, 10)
    ),
    'table', jsonb_build_object(
      'id', rt.id,
      'tenant_id', rt.tenant_id,
      'number', rt.table_number,
      'token', rt.public_token,
      'current_session_token', coalesce(rt.current_session_token, gen_random_uuid())
    ),
    'categories', coalesce((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) ORDER BY c.sort_order, c.name) FROM menu_categories c WHERE c.tenant_id=t.id AND c.is_active), '[]'::jsonb),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'description', m.description, 'price', m.price, 'category_id', m.category_id, 'category', c.name, 'image_url', m.image_url, 'is_featured', m.is_featured, 'is_vegetarian', m.is_vegetarian) ORDER BY m.sort_order, m.name) FROM menu_items m LEFT JOIN menu_categories c ON c.id=m.category_id WHERE m.tenant_id=t.id AND m.is_available), '[]'::jsonb)
  ) INTO result
  FROM tenants t JOIN restaurant_tables rt ON rt.tenant_id=t.id LEFT JOIN restaurant_settings s ON s.tenant_id=t.id
  WHERE t.slug=p_slug AND t.status='active' AND rt.table_number=p_table_number AND rt.status <> 'disabled' AND coalesce(s.ordering_enabled, true);
  RETURN result;
END $$;

-- 6. Update create_public_restaurant_order to drop all overloaded versions and create clean single signature
DROP FUNCTION IF EXISTS public.create_public_restaurant_order(uuid, text, text, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.create_public_restaurant_order(uuid, text, jsonb, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_public_restaurant_order(uuid, text, text, jsonb, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_public_restaurant_order(uuid, text, jsonb, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_public_restaurant_order(uuid, text, text, jsonb, text, text);
DROP FUNCTION IF EXISTS public.create_public_restaurant_order(uuid, text, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.create_public_restaurant_order(
  p_table_token uuid,
  p_customer_phone text DEFAULT null,
  p_customer_name text DEFAULT null,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT null,
  p_coupon_code text DEFAULT null,
  p_dining_type text DEFAULT 'dine_in'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_table restaurant_tables%rowtype; v_tax numeric; v_order_id uuid; v_session_id uuid; v_subtotal numeric := 0; v_quantity integer; v_item_id uuid; v_menu menu_items%rowtype; v_line numeric; v_item_notes text; v_coupon restaurant_promotions%rowtype; v_discount numeric := 0;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Your cart is empty'; END IF;
  SELECT rt.* INTO v_table FROM restaurant_tables rt JOIN tenants t ON t.id=rt.tenant_id LEFT JOIN restaurant_settings s ON s.tenant_id=t.id WHERE rt.public_token=p_table_token AND rt.status <> 'disabled' AND t.status in ('active','trial') AND coalesce(s.ordering_enabled, true) FOR UPDATE OF rt;
  IF NOT FOUND THEN RAISE EXCEPTION 'This QR table is no longer accepting orders'; END IF;

  -- Get or create open table session
  SELECT id INTO v_session_id FROM restaurant_table_sessions WHERE table_id = v_table.id AND status = 'open' ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
  IF v_session_id IS NULL THEN
    INSERT INTO restaurant_table_sessions (tenant_id, table_id, status, started_at)
    VALUES (v_table.tenant_id, v_table.id, 'open', now())
    RETURNING id INTO v_session_id;
  END IF;

  -- Validate coupon if code provided
  IF nullif(trim(coalesce(p_coupon_code,'')),'') IS NOT NULL THEN
    SELECT * INTO v_coupon FROM restaurant_promotions WHERE tenant_id=v_table.tenant_id AND lower(coupon_code)=lower(trim(p_coupon_code)) AND active AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now());
    IF NOT FOUND THEN RAISE EXCEPTION 'Coupon is invalid or expired'; END IF;
  END IF;

  SELECT tax_rate INTO v_tax FROM restaurant_settings WHERE tenant_id=v_table.tenant_id;
  v_tax := coalesce(v_tax, 0);

  INSERT INTO restaurant_orders(tenant_id, table_id, table_session_id, customer_phone, customer_name, notes, coupon_code, dining_type)
  VALUES(v_table.tenant_id, v_table.id, v_session_id, nullif(trim(p_customer_phone), ''), nullif(trim(p_customer_name), ''), nullif(trim(p_notes), ''), nullif(trim(p_coupon_code), ''), coalesce(p_dining_type, 'dine_in'))
  RETURNING id INTO v_order_id;

  FOR v_item_id, v_quantity, v_item_notes IN SELECT (value->>'id')::uuid, (value->>'quantity')::integer, (value->>'notes')::text FROM jsonb_array_elements(p_items) LOOP
    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
    SELECT * INTO v_menu FROM menu_items WHERE id=v_item_id AND tenant_id=v_table.tenant_id AND is_available FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item in your cart is unavailable'; END IF;
    v_line := v_menu.price * v_quantity; v_subtotal := v_subtotal + v_line;
    INSERT INTO restaurant_order_items(order_id, menu_item_id, item_name, unit_price, quantity, line_total, notes) VALUES(v_order_id, v_menu.id, v_menu.name, v_menu.price, v_quantity, v_line, v_item_notes);
  END LOOP;

  IF v_coupon.id IS NOT NULL THEN
    IF v_subtotal < v_coupon.minimum_order_amount THEN RAISE EXCEPTION 'Minimum order amount for coupon not met'; END IF;
    v_discount := CASE WHEN v_coupon.discount_type='flat' THEN v_coupon.discount_value ELSE round(v_subtotal*v_coupon.discount_value/100, 2) END;
    v_discount := least(v_discount, coalesce(v_coupon.max_discount_amount, v_discount), v_subtotal);
  END IF;

  UPDATE restaurant_orders SET subtotal=v_subtotal, discount_amount=v_discount, tax_amount=round((v_subtotal-v_discount)*v_tax/100, 2), total=round((v_subtotal-v_discount)*(1+v_tax/100), 2), updated_at=now() WHERE id=v_order_id;
  UPDATE restaurant_tables SET status='occupied', updated_at=now() WHERE id=v_table.id AND status='available';
  RETURN (SELECT jsonb_build_object('id', id, 'order_number', order_number, 'status', status, 'total', total, 'discount_amount', discount_amount) FROM restaurant_orders WHERE id=v_order_id);
END $$;

GRANT EXECUTE ON FUNCTION public.create_public_restaurant_order(uuid, text, text, jsonb, text, text, text) TO anon, authenticated;

-- 7. RPC to clear restaurant table, close open session, and regenerate current_session_token
DROP FUNCTION IF EXISTS public.clear_restaurant_table(uuid, uuid);
DROP FUNCTION IF EXISTS public.clear_restaurant_table(uuid);

CREATE OR REPLACE FUNCTION public.clear_restaurant_table(p_table_id uuid, p_tenant_id uuid DEFAULT NULL)
RETURNS public.restaurant_tables LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_table public.restaurant_tables;
BEGIN
  -- Close any open session for this table
  UPDATE public.restaurant_table_sessions
  SET status = 'closed', closed_at = now()
  WHERE table_id = p_table_id AND status = 'open';

  UPDATE public.restaurant_tables
  SET status = 'available', current_session_token = gen_random_uuid(), updated_at = now()
  WHERE id = p_table_id
  RETURNING * INTO v_table;
  RETURN v_table;
END $$;

GRANT EXECUTE ON FUNCTION public.clear_restaurant_table(uuid, uuid) TO anon, authenticated;

-- 8. RPC to expose live current active orders for QR customer page
DROP FUNCTION IF EXISTS public.public_restaurant_table_session_orders(uuid);

CREATE OR REPLACE FUNCTION public.public_restaurant_table_session_orders(p_table_token uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH target_table AS (
    SELECT id FROM public.restaurant_tables WHERE public_token = p_table_token
  ), active_session AS (
    SELECT s.id, s.started_at FROM public.restaurant_table_sessions s JOIN target_table t ON t.id = s.table_id
    WHERE s.status = 'open'
    ORDER BY s.started_at DESC
    LIMIT 1
  ), recent_orders AS (
    SELECT o.*
    FROM target_table t
    JOIN public.restaurant_orders o ON o.table_id = t.id
    JOIN active_session s ON (o.table_session_id = s.id OR o.created_at >= s.started_at)
    WHERE o.status NOT IN ('completed', 'closed', 'cancelled')
      AND o.payment_status <> 'paid'
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'total', o.total,
    'subtotal', o.subtotal,
    'tax_amount', o.tax_amount,
    'discount_amount', o.discount_amount,
    'dining_type', o.dining_type,
    'notes', o.notes,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
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
  ) ORDER BY o.created_at), '[]'::jsonb)
  FROM recent_orders o;
$$;

GRANT EXECUTE ON FUNCTION public.public_restaurant_table_session_orders(uuid) TO anon, authenticated;

-- Ensure an open session exists for any table that has recent non-cancelled orders
INSERT INTO public.restaurant_table_sessions (tenant_id, table_id, status, started_at)
SELECT rt.tenant_id, rt.id, 'open', coalesce(min(o.created_at), now())
FROM public.restaurant_tables rt
JOIN public.restaurant_orders o ON o.table_id = rt.id
WHERE o.status <> 'cancelled'
  AND NOT EXISTS (SELECT 1 FROM public.restaurant_table_sessions s WHERE s.table_id = rt.id AND s.status = 'open')
GROUP BY rt.tenant_id, rt.id;

UPDATE public.restaurant_orders o
SET table_session_id = s.id
FROM public.restaurant_table_sessions s
WHERE s.table_id = o.table_id AND s.status = 'open' AND o.table_session_id IS NULL;

NOTIFY pgrst, 'reload schema';




