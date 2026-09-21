-- Migration: Fix multi-ordering KDS visibility, table session multi-round ordering, and settlement auto-redirect

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
DECLARE
  v_table restaurant_tables%rowtype;
  v_tax numeric;
  v_order_id uuid;
  v_order_number integer;
  v_session_id uuid;
  v_subtotal numeric := 0;
  v_quantity integer;
  v_item_id uuid;
  v_menu menu_items%rowtype;
  v_line numeric;
  v_item_notes text;
  v_coupon restaurant_promotions%rowtype;
  v_discount numeric := 0;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty';
  END IF;

  SELECT rt.* INTO v_table
  FROM restaurant_tables rt
  JOIN tenants t ON t.id=rt.tenant_id
  LEFT JOIN restaurant_settings s ON s.tenant_id=t.id
  WHERE rt.public_token=p_table_token
    AND rt.status <> 'disabled'
    AND t.status in ('active','trial')
    AND coalesce(s.ordering_enabled, true)
  FOR UPDATE OF rt;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This QR table is no longer accepting orders';
  END IF;

  SELECT tax_rate INTO v_tax FROM restaurant_settings WHERE tenant_id=v_table.tenant_id;
  v_tax := coalesce(v_tax, 0);

  -- Get or create open table session
  SELECT id INTO v_session_id
  FROM restaurant_table_sessions
  WHERE table_id = v_table.id AND status = 'open'
  ORDER BY started_at DESC LIMIT 1 FOR UPDATE;

  IF v_session_id IS NULL THEN
    INSERT INTO restaurant_table_sessions (tenant_id, table_id, status, started_at)
    VALUES (v_table.tenant_id, v_table.id, 'open', now())
    RETURNING id INTO v_session_id;
  END IF;

  -- Validate coupon if provided
  IF nullif(trim(coalesce(p_coupon_code,'')),'') IS NOT NULL THEN
    SELECT * INTO v_coupon FROM restaurant_promotions
    WHERE tenant_id=v_table.tenant_id AND lower(coupon_code)=lower(trim(p_coupon_code)) AND active AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now());
    IF NOT FOUND THEN RAISE EXCEPTION 'Coupon is invalid or expired'; END IF;
  END IF;

  -- Create fresh distinct order for this ordering round so KDS & staff get real-time alerts
  INSERT INTO restaurant_orders(tenant_id, table_id, table_session_id, customer_phone, customer_name, notes, coupon_code, dining_type, status, payment_status)
  VALUES(v_table.tenant_id, v_table.id, v_session_id, nullif(trim(p_customer_phone), ''), nullif(trim(p_customer_name), ''), nullif(trim(p_notes), ''), nullif(trim(p_coupon_code), ''), coalesce(p_dining_type, 'dine_in'), 'new', 'unpaid')
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item_id, v_quantity, v_item_notes IN
    SELECT (value->>'id')::uuid, (value->>'quantity')::integer, (value->>'notes')::text
    FROM jsonb_array_elements(p_items)
  LOOP
    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
    SELECT * INTO v_menu FROM menu_items WHERE id=v_item_id AND tenant_id=v_table.tenant_id AND is_available FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item in your cart is unavailable'; END IF;
    v_line := v_menu.price * v_quantity;
    v_subtotal := v_subtotal + v_line;
    INSERT INTO restaurant_order_items(order_id, menu_item_id, item_name, unit_price, quantity, line_total, notes)
    VALUES(v_order_id, v_menu.id, v_menu.name, v_menu.price, v_quantity, v_line, v_item_notes);
  END LOOP;

  -- Calculate coupon discount
  IF v_coupon.id IS NOT NULL AND v_subtotal >= v_coupon.minimum_order_amount THEN
    v_discount := CASE WHEN v_coupon.discount_type='flat' THEN v_coupon.discount_value ELSE round(v_subtotal*v_coupon.discount_value/100, 2) END;
    v_discount := least(v_discount, coalesce(v_coupon.max_discount_amount, v_discount), v_subtotal);
  END IF;

  UPDATE restaurant_orders
  SET subtotal=v_subtotal,
      discount_amount=v_discount,
      tax_amount=round((v_subtotal-v_discount)*v_tax/100, 2),
      total=round((v_subtotal-v_discount)*(1+v_tax/100), 2),
      updated_at=now()
  WHERE id=v_order_id;

  -- Set table status to occupied
  UPDATE restaurant_tables SET status='occupied', updated_at=now() WHERE id=v_table.id AND status<>'occupied';

  RETURN (
    SELECT jsonb_build_object(
      'id', id,
      'order_number', order_number,
      'status', status,
      'total', total,
      'discount_amount', discount_amount
    ) FROM restaurant_orders WHERE id=v_order_id
  );
END $$;

GRANT EXECUTE ON FUNCTION public.create_public_restaurant_order(uuid, text, text, jsonb, text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
