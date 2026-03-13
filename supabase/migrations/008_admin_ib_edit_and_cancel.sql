-- ============================================
-- Admin Edit + IB Edit + IB Cancel Client Account
-- ============================================

-- 1. Admin can edit client account fields (any status), including investor password
CREATE OR REPLACE FUNCTION public.admin_edit_client_account(
  p_account_id uuid,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_nickname text,
  p_mt5_account_id text,
  p_mt5_server text,
  p_mt5_investor_password text,  -- encrypted, NULL = no change
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  account_row public.client_accounts%ROWTYPE;
  trimmed_name text := btrim(COALESCE(p_client_name, ''));
  trimmed_email text := public.normalize_email(p_client_email);
  trimmed_phone text := NULLIF(btrim(COALESCE(p_client_phone, '')), '');
  trimmed_nickname text := NULLIF(btrim(COALESCE(p_nickname, '')), '');
  trimmed_mt5 text := btrim(COALESCE(p_mt5_account_id, ''));
  trimmed_server text := btrim(COALESCE(p_mt5_server, ''));
  conflict_account_id uuid;
  changes jsonb;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RAISE EXCEPTION 'Actor mismatch'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO actor_role FROM public.profiles WHERE id = p_actor_id;

  IF actor_role <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden'
      USING ERRCODE = '42501';
  END IF;

  -- Validate required fields
  IF trimmed_name = '' OR length(trimmed_name) < 2 THEN
    RAISE EXCEPTION 'ชื่อลูกค้าต้องมีอย่างน้อย 2 ตัวอักษร'
      USING ERRCODE = 'P0001';
  END IF;

  IF trimmed_mt5 = '' OR trimmed_mt5 !~ '^\d+$' THEN
    RAISE EXCEPTION 'MT5 Account ID ต้องเป็นตัวเลขเท่านั้น'
      USING ERRCODE = 'P0001';
  END IF;

  IF trimmed_server = '' OR length(trimmed_server) < 3 THEN
    RAISE EXCEPTION 'ชื่อ MT5 Server ไม่ถูกต้อง'
      USING ERRCODE = 'P0001';
  END IF;

  -- Lock the row
  SELECT * INTO account_row
  FROM public.client_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found'
      USING ERRCODE = 'P0001';
  END IF;

  -- Check email conflict if changing to approved and email changed
  IF account_row.status = 'approved' AND trimmed_email IS NOT NULL
     AND trimmed_email IS DISTINCT FROM public.normalize_email(account_row.client_email) THEN
    SELECT id INTO conflict_account_id
    FROM public.client_accounts
    WHERE id <> account_row.id
      AND public.normalize_email(client_email) = trimmed_email
      AND (status = 'approved' OR user_id IS NOT NULL)
    LIMIT 1;

    IF conflict_account_id IS NOT NULL THEN
      RAISE EXCEPTION 'อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- Check MT5 uniqueness if changed
  IF trimmed_mt5 IS DISTINCT FROM account_row.mt5_account_id
     OR trimmed_server IS DISTINCT FROM account_row.mt5_server THEN
    IF EXISTS (
      SELECT 1 FROM public.client_accounts
      WHERE id <> account_row.id
        AND mt5_account_id = trimmed_mt5
        AND mt5_server = trimmed_server
    ) THEN
      RAISE EXCEPTION 'MT5 account นี้มีอยู่ในระบบแล้ว'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- Build changes log
  changes := jsonb_build_object(
    'previous', jsonb_build_object(
      'client_name', account_row.client_name,
      'client_email', account_row.client_email,
      'client_phone', account_row.client_phone,
      'nickname', account_row.nickname,
      'mt5_account_id', account_row.mt5_account_id,
      'mt5_server', account_row.mt5_server,
      'password_changed', p_mt5_investor_password IS NOT NULL
    ),
    'updated', jsonb_build_object(
      'client_name', trimmed_name,
      'client_email', trimmed_email,
      'client_phone', trimmed_phone,
      'nickname', trimmed_nickname,
      'mt5_account_id', trimmed_mt5,
      'mt5_server', trimmed_server,
      'password_changed', p_mt5_investor_password IS NOT NULL
    )
  );

  -- Update
  UPDATE public.client_accounts
  SET client_name = trimmed_name,
      client_email = trimmed_email,
      client_phone = trimmed_phone,
      nickname = trimmed_nickname,
      mt5_account_id = trimmed_mt5,
      mt5_server = trimmed_server,
      mt5_investor_password = COALESCE(p_mt5_investor_password, mt5_investor_password),
      mt5_validated = CASE WHEN p_mt5_investor_password IS NOT NULL THEN FALSE ELSE mt5_validated END,
      mt5_validation_error = CASE WHEN p_mt5_investor_password IS NOT NULL THEN NULL ELSE mt5_validation_error END,
      last_validated_at = CASE WHEN p_mt5_investor_password IS NOT NULL THEN NULL ELSE last_validated_at END,
      updated_at = now()
  WHERE id = account_row.id
  RETURNING * INTO account_row;

  -- Log the edit
  INSERT INTO public.approval_log (
    client_account_id, action, performed_by,
    previous_status, new_status, reason, metadata
  ) VALUES (
    account_row.id, 'edited', p_actor_id,
    account_row.status, account_row.status,
    'Admin edited client account',
    changes
  );

  RETURN public.sanitized_client_account_json(account_row);
END;
$$;

-- 2. IB can edit their own client's basic info (any status except suspended)
CREATE OR REPLACE FUNCTION public.ib_edit_client_account(
  p_account_id uuid,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_nickname text,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  actor_master_ib_id uuid;
  account_row public.client_accounts%ROWTYPE;
  trimmed_name text := btrim(COALESCE(p_client_name, ''));
  trimmed_email text := public.normalize_email(p_client_email);
  trimmed_phone text := NULLIF(btrim(COALESCE(p_client_phone, '')), '');
  trimmed_nickname text := NULLIF(btrim(COALESCE(p_nickname, '')), '');
  conflict_account_id uuid;
  changes jsonb;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RAISE EXCEPTION 'Actor mismatch'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO actor_role FROM public.profiles WHERE id = p_actor_id;

  IF actor_role NOT IN ('admin', 'master_ib') THEN
    RAISE EXCEPTION 'Forbidden'
      USING ERRCODE = '42501';
  END IF;

  -- Validate
  IF trimmed_name = '' OR length(trimmed_name) < 2 THEN
    RAISE EXCEPTION 'ชื่อลูกค้าต้องมีอย่างน้อย 2 ตัวอักษร'
      USING ERRCODE = 'P0001';
  END IF;

  -- Lock the row
  SELECT * INTO account_row
  FROM public.client_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found'
      USING ERRCODE = 'P0001';
  END IF;

  -- IB ownership check
  IF actor_role = 'master_ib' THEN
    SELECT id INTO actor_master_ib_id
    FROM public.master_ibs WHERE user_id = p_actor_id;

    IF actor_master_ib_id IS NULL OR actor_master_ib_id <> account_row.master_ib_id THEN
      RAISE EXCEPTION 'Forbidden'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Cannot edit suspended accounts
  IF account_row.status = 'suspended' THEN
    RAISE EXCEPTION 'ไม่สามารถแก้ไขบัญชีที่ถูกระงับได้'
      USING ERRCODE = 'P0001';
  END IF;

  -- Check email conflict for approved accounts
  IF account_row.status = 'approved' AND trimmed_email IS NOT NULL
     AND trimmed_email IS DISTINCT FROM public.normalize_email(account_row.client_email) THEN
    SELECT id INTO conflict_account_id
    FROM public.client_accounts
    WHERE id <> account_row.id
      AND public.normalize_email(client_email) = trimmed_email
      AND (status = 'approved' OR user_id IS NOT NULL)
    LIMIT 1;

    IF conflict_account_id IS NOT NULL THEN
      RAISE EXCEPTION 'อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- Build changes log
  changes := jsonb_build_object(
    'previous', jsonb_build_object(
      'client_name', account_row.client_name,
      'client_email', account_row.client_email,
      'client_phone', account_row.client_phone,
      'nickname', account_row.nickname
    ),
    'updated', jsonb_build_object(
      'client_name', trimmed_name,
      'client_email', trimmed_email,
      'client_phone', trimmed_phone,
      'nickname', trimmed_nickname
    )
  );

  -- Update (IB can only edit basic info, NOT MT5 details)
  UPDATE public.client_accounts
  SET client_name = trimmed_name,
      client_email = trimmed_email,
      client_phone = trimmed_phone,
      nickname = trimmed_nickname,
      updated_at = now()
  WHERE id = account_row.id
  RETURNING * INTO account_row;

  -- Log
  INSERT INTO public.approval_log (
    client_account_id, action, performed_by,
    previous_status, new_status, reason, metadata
  ) VALUES (
    account_row.id, 'edited', p_actor_id,
    account_row.status, account_row.status,
    'IB edited client account',
    changes
  );

  RETURN public.sanitized_client_account_json(account_row);
END;
$$;

-- 3. IB can cancel (withdraw) their own pending/rejected clients
CREATE OR REPLACE FUNCTION public.ib_cancel_client_account(
  p_account_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  actor_master_ib_id uuid;
  account_row public.client_accounts%ROWTYPE;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RAISE EXCEPTION 'Actor mismatch'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO actor_role FROM public.profiles WHERE id = p_actor_id;

  IF actor_role NOT IN ('admin', 'master_ib') THEN
    RAISE EXCEPTION 'Forbidden'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the row
  SELECT * INTO account_row
  FROM public.client_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found'
      USING ERRCODE = 'P0001';
  END IF;

  -- IB ownership check
  IF actor_role = 'master_ib' THEN
    SELECT id INTO actor_master_ib_id
    FROM public.master_ibs WHERE user_id = p_actor_id;

    IF actor_master_ib_id IS NULL OR actor_master_ib_id <> account_row.master_ib_id THEN
      RAISE EXCEPTION 'Forbidden'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Only allow canceling pending or rejected accounts
  IF account_row.status NOT IN ('pending', 'rejected') THEN
    RAISE EXCEPTION 'สามารถยกเลิกได้เฉพาะบัญชีที่รออนุมัติหรือถูกปฏิเสธเท่านั้น'
      USING ERRCODE = 'P0001';
  END IF;

  -- Log before delete
  INSERT INTO public.approval_log (
    client_account_id, action, performed_by,
    previous_status, new_status, reason
  ) VALUES (
    account_row.id, 'cancelled', p_actor_id,
    account_row.status, 'cancelled',
    'IB cancelled client account'
  );

  -- Delete the account
  DELETE FROM public.client_accounts WHERE id = account_row.id;

  RETURN public.sanitized_client_account_json(account_row);
END;
$$;

-- 4. Admin can delete any client account (any status)
CREATE OR REPLACE FUNCTION public.admin_delete_client_account(
  p_account_id uuid,
  p_reason text,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  account_row public.client_accounts%ROWTYPE;
  trimmed_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  -- Auth check
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RAISE EXCEPTION 'Actor mismatch'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO actor_role FROM public.profiles WHERE id = p_actor_id;

  IF actor_role <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the row
  SELECT * INTO account_row
  FROM public.client_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found'
      USING ERRCODE = 'P0001';
  END IF;

  -- Log before delete
  INSERT INTO public.approval_log (
    client_account_id, action, performed_by,
    previous_status, new_status, reason, metadata
  ) VALUES (
    account_row.id, 'deleted', p_actor_id,
    account_row.status, 'deleted',
    COALESCE(trimmed_reason, 'Admin deleted client account'),
    jsonb_build_object(
      'client_name', account_row.client_name,
      'mt5_account_id', account_row.mt5_account_id,
      'mt5_server', account_row.mt5_server
    )
  );

  -- Delete the account (cascades to stats, trades, positions, etc.)
  DELETE FROM public.client_accounts WHERE id = account_row.id;

  RETURN public.sanitized_client_account_json(account_row);
END;
$$;

-- 5. Add 'edited', 'cancelled', 'deleted' to approval_log action check
ALTER TABLE public.approval_log DROP CONSTRAINT IF EXISTS approval_log_action_check;
ALTER TABLE public.approval_log
  ADD CONSTRAINT approval_log_action_check
  CHECK (action IN ('submitted', 'approved', 'rejected', 'suspended', 'reactivated', 'resubmitted', 'auto_unlinked', 'edited', 'cancelled', 'deleted'));
