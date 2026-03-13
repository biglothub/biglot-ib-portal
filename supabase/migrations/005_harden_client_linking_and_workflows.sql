-- ============================================
-- Harden Client Linking And Workflow Transitions
-- ============================================

CREATE OR REPLACE FUNCTION public.normalize_email(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(btrim(value)), '');
$$;

UPDATE public.client_accounts
SET client_email = public.normalize_email(client_email),
    updated_at = now()
WHERE client_email IS DISTINCT FROM public.normalize_email(client_email);

ALTER TABLE public.approval_log DROP CONSTRAINT IF EXISTS approval_log_action_check;
ALTER TABLE public.approval_log
  ADD CONSTRAINT approval_log_action_check
  CHECK (action IN ('submitted', 'approved', 'rejected', 'suspended', 'reactivated', 'resubmitted', 'auto_unlinked'));

CREATE INDEX IF NOT EXISTS idx_client_accounts_email_normalized_approved
  ON public.client_accounts (public.normalize_email(client_email))
  WHERE client_email IS NOT NULL AND status = 'approved';

DO $$
DECLARE
  admin_actor uuid;
  duplicate_group record;
  duplicate_row record;
  keep_id uuid;
BEGIN
  SELECT id
  INTO admin_actor
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  FOR duplicate_group IN
    SELECT user_id
    FROM public.client_accounts
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
  LOOP
    SELECT id
    INTO keep_id
    FROM public.client_accounts
    WHERE user_id = duplicate_group.user_id
    ORDER BY submitted_at ASC, id ASC
    LIMIT 1;

    FOR duplicate_row IN
      SELECT id, status
      FROM public.client_accounts
      WHERE user_id = duplicate_group.user_id
        AND id <> keep_id
    LOOP
      UPDATE public.client_accounts
      SET user_id = NULL,
          updated_at = now()
      WHERE id = duplicate_row.id;

      IF admin_actor IS NOT NULL THEN
        INSERT INTO public.approval_log (
          client_account_id,
          action,
          performed_by,
          previous_status,
          new_status,
          reason,
          metadata
        )
        VALUES (
          duplicate_row.id,
          'auto_unlinked',
          admin_actor,
          duplicate_row.status,
          duplicate_row.status,
          'Auto-unlinked duplicate linked client during migration',
          jsonb_build_object(
            'duplicate_type', 'user_id',
            'canonical_account_id', keep_id,
            'duplicate_user_id', duplicate_group.user_id
          )
        );
      END IF;
    END LOOP;
  END LOOP;

  FOR duplicate_group IN
    SELECT public.normalize_email(client_email) AS normalized_email
    FROM public.client_accounts
    WHERE client_email IS NOT NULL
      AND status = 'approved'
    GROUP BY public.normalize_email(client_email)
    HAVING COUNT(*) > 1
  LOOP
    SELECT id
    INTO keep_id
    FROM public.client_accounts
    WHERE public.normalize_email(client_email) = duplicate_group.normalized_email
      AND status = 'approved'
    ORDER BY submitted_at ASC, id ASC
    LIMIT 1;

    FOR duplicate_row IN
      SELECT id, status
      FROM public.client_accounts
      WHERE public.normalize_email(client_email) = duplicate_group.normalized_email
        AND status = 'approved'
        AND id <> keep_id
        AND user_id IS NOT NULL
    LOOP
      UPDATE public.client_accounts
      SET user_id = NULL,
          updated_at = now()
      WHERE id = duplicate_row.id;

      IF admin_actor IS NOT NULL THEN
        INSERT INTO public.approval_log (
          client_account_id,
          action,
          performed_by,
          previous_status,
          new_status,
          reason,
          metadata
        )
        VALUES (
          duplicate_row.id,
          'auto_unlinked',
          admin_actor,
          duplicate_row.status,
          duplicate_row.status,
          'Auto-unlinked duplicate approved client email during migration',
          jsonb_build_object(
            'duplicate_type', 'client_email',
            'canonical_account_id', keep_id,
            'normalized_email', duplicate_group.normalized_email
          )
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_accounts_user_id_unique
  ON public.client_accounts (user_id)
  WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sanitized_client_account_json(account_row public.client_accounts)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', account_row.id,
    'user_id', account_row.user_id,
    'master_ib_id', account_row.master_ib_id,
    'client_name', account_row.client_name,
    'client_email', account_row.client_email,
    'client_phone', account_row.client_phone,
    'nickname', account_row.nickname,
    'mt5_account_id', account_row.mt5_account_id,
    'mt5_server', account_row.mt5_server,
    'status', account_row.status,
    'submitted_at', account_row.submitted_at,
    'reviewed_at', account_row.reviewed_at,
    'reviewed_by', account_row.reviewed_by,
    'rejection_reason', account_row.rejection_reason,
    'mt5_validated', account_row.mt5_validated,
    'mt5_validation_error', account_row.mt5_validation_error,
    'last_validated_at', account_row.last_validated_at,
    'last_synced_at', account_row.last_synced_at,
    'sync_error', account_row.sync_error,
    'sync_count', account_row.sync_count,
    'created_at', account_row.created_at,
    'updated_at', account_row.updated_at
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_transition_client_account(
  p_account_id uuid,
  p_action text,
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
  ib_user_id uuid;
  next_status text;
  normalized_client_email text;
  conflict_account_id uuid;
  trimmed_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  notif_type text;
  notif_title text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RAISE EXCEPTION 'Actor mismatch'
      USING ERRCODE = '42501';
  END IF;

  SELECT role
  INTO actor_role
  FROM public.profiles
  WHERE id = p_actor_id;

  IF actor_role <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO account_row
  FROM public.client_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found'
      USING ERRCODE = 'P0001';
  END IF;

  CASE p_action
    WHEN 'approved' THEN
      IF account_row.status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending accounts can be approved'
          USING ERRCODE = 'P0001';
      END IF;
      next_status := 'approved';
    WHEN 'rejected' THEN
      IF account_row.status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending accounts can be rejected'
          USING ERRCODE = 'P0001';
      END IF;
      next_status := 'rejected';
    WHEN 'suspended' THEN
      IF account_row.status <> 'approved' THEN
        RAISE EXCEPTION 'Only approved accounts can be suspended'
          USING ERRCODE = 'P0001';
      END IF;
      next_status := 'suspended';
    WHEN 'reactivated' THEN
      IF account_row.status <> 'suspended' THEN
        RAISE EXCEPTION 'Only suspended accounts can be reactivated'
          USING ERRCODE = 'P0001';
      END IF;
      next_status := 'approved';
    ELSE
      RAISE EXCEPTION 'Unsupported action'
        USING ERRCODE = 'P0001';
  END CASE;

  normalized_client_email := public.normalize_email(account_row.client_email);

  IF next_status = 'approved' AND normalized_client_email IS NOT NULL THEN
    SELECT id
    INTO conflict_account_id
    FROM public.client_accounts
    WHERE id <> account_row.id
      AND public.normalize_email(client_email) = normalized_client_email
      AND (status = 'approved' OR user_id IS NOT NULL)
    ORDER BY submitted_at ASC, id ASC
    LIMIT 1;

    IF conflict_account_id IS NOT NULL THEN
      RAISE EXCEPTION 'Client email is already tied to another approved or linked account'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE public.client_accounts
  SET status = next_status,
      reviewed_at = now(),
      reviewed_by = p_actor_id,
      rejection_reason = CASE WHEN p_action = 'rejected' THEN trimmed_reason ELSE NULL END,
      updated_at = now()
  WHERE id = account_row.id
  RETURNING *
  INTO account_row;

  INSERT INTO public.approval_log (
    client_account_id,
    action,
    performed_by,
    previous_status,
    new_status,
    reason
  )
  VALUES (
    account_row.id,
    p_action,
    p_actor_id,
    CASE
      WHEN p_action = 'approved' THEN 'pending'
      WHEN p_action = 'rejected' THEN 'pending'
      WHEN p_action = 'suspended' THEN 'approved'
      ELSE 'suspended'
    END,
    next_status,
    trimmed_reason
  );

  IF next_status = 'approved' AND account_row.client_email IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, metadata)
    VALUES (
      p_actor_id,
      'client_approved',
      format('ลูกค้า %s ได้รับอนุมัติแล้ว', account_row.client_name),
      format('ลูกค้าสามารถล็อกอินด้วย Google (%s)', account_row.client_email),
      jsonb_build_object(
        'client_account_id', account_row.id,
        'client_email', account_row.client_email
      )
    );
  END IF;

  SELECT user_id
  INTO ib_user_id
  FROM public.master_ibs
  WHERE id = account_row.master_ib_id;

  IF ib_user_id IS NOT NULL THEN
    notif_type := CASE
      WHEN next_status = 'approved' THEN 'client_approved'
      WHEN p_action = 'suspended' THEN 'client_suspended'
      ELSE 'client_rejected'
    END;

    notif_title := CASE
      WHEN p_action = 'reactivated' THEN format('ลูกค้า %s ถูกเปิดใช้งานอีกครั้ง', account_row.client_name)
      WHEN next_status = 'approved' THEN format('ลูกค้า %s ได้รับอนุมัติแล้ว', account_row.client_name)
      WHEN p_action = 'suspended' THEN format('ลูกค้า %s ถูกระงับ', account_row.client_name)
      ELSE format('ลูกค้า %s ถูกปฏิเสธ', account_row.client_name)
    END;

    INSERT INTO public.notifications (user_id, type, title, body, metadata)
    VALUES (
      ib_user_id,
      notif_type,
      notif_title,
      trimmed_reason,
      jsonb_build_object('client_account_id', account_row.id)
    );
  END IF;

  RETURN public.sanitized_client_account_json(account_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.ib_resubmit_client_account(
  p_account_id uuid,
  p_mt5_account_id text,
  p_mt5_password_encrypted text,
  p_mt5_server text,
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
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
    RAISE EXCEPTION 'Actor mismatch'
      USING ERRCODE = '42501';
  END IF;

  SELECT role
  INTO actor_role
  FROM public.profiles
  WHERE id = p_actor_id;

  IF actor_role NOT IN ('admin', 'master_ib') THEN
    RAISE EXCEPTION 'Forbidden'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO account_row
  FROM public.client_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF actor_role = 'master_ib' THEN
    SELECT id
    INTO actor_master_ib_id
    FROM public.master_ibs
    WHERE user_id = p_actor_id;

    IF actor_master_ib_id IS NULL OR actor_master_ib_id <> account_row.master_ib_id THEN
      RAISE EXCEPTION 'Forbidden'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF account_row.status <> 'rejected' THEN
    RAISE EXCEPTION 'Only rejected accounts can be resubmitted'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.client_accounts
  SET mt5_account_id = p_mt5_account_id,
      mt5_investor_password = p_mt5_password_encrypted,
      mt5_server = p_mt5_server,
      status = 'pending',
      mt5_validated = FALSE,
      mt5_validation_error = NULL,
      last_validated_at = NULL,
      rejection_reason = NULL,
      reviewed_at = NULL,
      reviewed_by = NULL,
      sync_error = NULL,
      updated_at = now()
  WHERE id = account_row.id
  RETURNING *
  INTO account_row;

  INSERT INTO public.approval_log (
    client_account_id,
    action,
    performed_by,
    previous_status,
    new_status
  )
  VALUES (
    account_row.id,
    'resubmitted',
    p_actor_id,
    'rejected',
    'pending'
  );

  INSERT INTO public.notifications (user_id, type, title, metadata)
  SELECT
    id,
    'client_resubmitted',
    format('ลูกค้า %s ส่งตรวจสอบใหม่', account_row.client_name),
    jsonb_build_object('client_account_id', account_row.id)
  FROM public.profiles
  WHERE role = 'admin';

  RETURN public.sanitized_client_account_json(account_row);
END;
$$;
