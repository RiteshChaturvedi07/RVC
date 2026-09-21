-- Migration: Multi-order consolidation, automatic table session release, and feedback summary RPC

-- 1. Update create_public_restaurant_order to consolidate new items into an active unsettled order if one exists for the table
DROP FUNCTION IF EXISTS public.create_public_restaurant_order(uuid, text, text, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.create_public_restaurant_order(uuid, text, jsonb, text, text, text, text);

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
  v_existing_order_id uuid;
  v_existing_order_number integer;
  v_existing_item_id uuid;
  v_existing_item_qty integer;
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

  -- Check if there is already an active, unsettled order for this table/session
  SELECT id, order_number INTO v_existing_order_id, v_existing_order_number
  FROM restaurant_orders
  WHERE table_id = v_table.id
    AND (table_session_id = v_session_id OR table_session_id IS NULL)
    AND status IN ('new', 'accepted', 'preparing', 'ready', 'served')
    AND payment_status <> 'paid'
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

  IF v_existing_order_id IS NOT NULL THEN
    -- Append / Consolidation Mode: Merge items into existing order
    v_order_id := v_existing_order_id;
    v_order_number := v_existing_order_number;

    FOR v_item_id, v_quantity, v_item_notes IN
      SELECT (value->>'id')::uuid, (value->>'quantity')::integer, (value->>'notes')::text
      FROM jsonb_array_elements(p_items)
    LOOP
      IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 50 THEN
        RAISE EXCEPTION 'Invalid item quantity';
      END IF;

      SELECT * INTO v_menu FROM menu_items WHERE id=v_item_id AND tenant_id=v_table.tenant_id AND is_available FOR SHARE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'An item in your cart is unavailable';
      END IF;

      -- Check if item already exists in this order
      SELECT id, quantity INTO v_existing_item_id, v_existing_item_qty
      FROM restaurant_order_items
      WHERE order_id = v_order_id AND menu_item_id = v_menu.id
      LIMIT 1;

      IF v_existing_item_id IS NOT NULL THEN
        UPDATE restaurant_order_items
        SET quantity = quantity + v_quantity,
            line_total = (quantity + v_quantity) * unit_price,
            notes = coalesce(nullif(trim(v_item_notes), ''), notes)
        WHERE id = v_existing_item_id;
      ELSE
        v_line := v_menu.price * v_quantity;
        INSERT INTO restaurant_order_items(order_id, menu_item_id, item_name, unit_price, quantity, line_total, notes)
        VALUES(v_order_id, v_menu.id, v_menu.name, v_menu.price, v_quantity, v_line, v_item_notes);
      END IF;
    END LOOP;

    -- Recalculate Subtotal & Totals for the consolidated order
    SELECT coalesce(sum(line_total), 0) INTO v_subtotal FROM restaurant_order_items WHERE order_id = v_order_id;

    -- Coupon check
    IF nullif(trim(coalesce(p_coupon_code,'')),'') IS NOT NULL THEN
      SELECT * INTO v_coupon FROM restaurant_promotions
      WHERE tenant_id=v_table.tenant_id AND lower(coupon_code)=lower(trim(p_coupon_code)) AND active AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now());
      IF v_coupon.id IS NOT NULL AND v_subtotal >= v_coupon.minimum_order_amount THEN
        v_discount := CASE WHEN v_coupon.discount_type='flat' THEN v_coupon.discount_value ELSE round(v_subtotal*v_coupon.discount_value/100, 2) END;
        v_discount := least(v_discount, coalesce(v_coupon.max_discount_amount, v_discount), v_subtotal);
      END IF;
    END IF;

    UPDATE restaurant_orders
    SET subtotal = v_subtotal,
        discount_amount = v_discount,
        tax_amount = round((v_subtotal-v_discount)*v_tax/100, 2),
        total = round((v_subtotal-v_discount)*(1+v_tax/100), 2),
        customer_phone = coalesce(nullif(trim(p_customer_phone), ''), customer_phone),
        customer_name = coalesce(nullif(trim(p_customer_name), ''), customer_name),
        updated_at = now()
    WHERE id = v_order_id;

  ELSE
    -- New Order Creation Mode
    IF nullif(trim(coalesce(p_coupon_code,'')),'') IS NOT NULL THEN
      SELECT * INTO v_coupon FROM restaurant_promotions
      WHERE tenant_id=v_table.tenant_id AND lower(coupon_code)=lower(trim(p_coupon_code)) AND active AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now());
      IF NOT FOUND THEN RAISE EXCEPTION 'Coupon is invalid or expired'; END IF;
    END IF;

    INSERT INTO restaurant_orders(tenant_id, table_id, table_session_id, customer_phone, customer_name, notes, coupon_code, dining_type)
    VALUES(v_table.tenant_id, v_table.id, v_session_id, nullif(trim(p_customer_phone), ''), nullif(trim(p_customer_name), ''), nullif(trim(p_notes), ''), nullif(trim(p_coupon_code), ''), coalesce(p_dining_type, 'dine_in'))
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

    IF v_coupon.id IS NOT NULL THEN
      IF v_subtotal < v_coupon.minimum_order_amount THEN RAISE EXCEPTION 'Minimum order amount for coupon not met'; END IF;
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

    UPDATE restaurant_tables SET status='occupied', updated_at=now() WHERE id=v_table.id AND status='available';
  END IF;

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

-- 2. Update complete_restaurant_order to mark all table session orders completed & set table available
CREATE OR REPLACE FUNCTION public.complete_restaurant_order(p_order_id uuid, p_method text, p_reference text DEFAULT NULL)
RETURNS public.restaurant_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  saved public.restaurant_orders;
  v_table_id uuid;
  v_session_id uuid;
BEGIN
  IF p_method NOT IN ('cash','online','complimentary') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  SELECT * INTO saved FROM public.restaurant_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT public.tenant_member_of(saved.tenant_id) THEN RAISE EXCEPTION 'Order not found'; END IF;

  v_table_id := saved.table_id;
  v_session_id := saved.table_session_id;

  IF saved.payment_status <> 'paid' AND NOT EXISTS(SELECT 1 FROM public.restaurant_payments WHERE order_id=saved.id AND status='paid') THEN
    INSERT INTO public.restaurant_payments(tenant_id, order_id, amount, method, status, gateway_reference)
    VALUES(saved.tenant_id, saved.id, saved.total, p_method, 'paid', nullif(trim(p_reference),''));
  END IF;

  -- Complete the target order
  UPDATE public.restaurant_orders
  SET status='completed',
      payment_status='paid',
      payment_method=p_method,
      bill_requested=false,
      paid_at=coalesce(paid_at, now()),
      payment_reference=coalesce(nullif(trim(p_reference),''), payment_reference),
      updated_at=now()
  WHERE id=saved.id RETURNING * INTO saved;

  -- Complete all other active orders associated with this table / session
  UPDATE public.restaurant_orders
  SET status='completed',
      payment_status='paid',
      payment_method=p_method,
      bill_requested=false,
      paid_at=coalesce(paid_at, now()),
      updated_at=now()
  WHERE table_id = v_table_id
    AND status IN ('new','accepted','preparing','ready','served')
    AND payment_status <> 'paid';

  -- Set table to available and close open table session
  UPDATE public.restaurant_tables
  SET status = 'available',
      current_session_token = gen_random_uuid(),
      updated_at = now()
  WHERE id = v_table_id;

  IF v_session_id IS NOT NULL THEN
    UPDATE public.restaurant_table_sessions
    SET status = 'closed', closed_at = now()
    WHERE id = v_session_id AND status = 'open';
  END IF;

  RETURN saved;
END $$;

GRANT EXECUTE ON FUNCTION public.complete_restaurant_order(uuid, text, text) TO authenticated;

-- 3. RPC to fetch feedback summary for restaurant dashboard reviews portal
CREATE OR REPLACE FUNCTION public.get_restaurant_feedback_summary(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_summary jsonb;
  v_reviews jsonb;
BEGIN
  SELECT jsonb_build_object(
    'avg_rating', coalesce(round(avg(rating)::numeric, 1), 5.0),
    'total_reviews', count(*),
    'five_star_count', count(*) FILTER (WHERE rating = 5),
    'four_star_count', count(*) FILTER (WHERE rating = 4),
    'three_star_count', count(*) FILTER (WHERE rating = 3),
    'two_star_count', count(*) FILTER (WHERE rating = 2),
    'one_star_count', count(*) FILTER (WHERE rating = 1)
  ) INTO v_summary
  FROM public.restaurant_order_feedback
  WHERE tenant_id = p_tenant_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'order_id', r.order_id,
    'order_number', o.order_number,
    'table_number', r.table_number,
    'guest_name', o.customer_name,
    'guest_phone', o.customer_phone,
    'rating', r.rating,
    'tags', r.tags,
    'comments', r.comments,
    'created_at', r.created_at
  ) ORDER BY r.created_at DESC), '[]'::jsonb) INTO v_reviews
  FROM public.restaurant_order_feedback r
  LEFT JOIN public.restaurant_orders o ON o.id = r.order_id
  WHERE r.tenant_id = p_tenant_id;

  RETURN coalesce(v_summary, '{}'::jsonb) || jsonb_build_object('reviews', v_reviews);
END $$;

GRANT EXECUTE ON FUNCTION public.get_restaurant_feedback_summary(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
