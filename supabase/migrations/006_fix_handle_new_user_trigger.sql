-- ============================================
-- Fix: handle_new_user trigger "Database error creating new user"
-- ============================================
-- Ensures the trigger function:
--   1. Is owned by postgres so SECURITY DEFINER bypasses RLS
--   2. Validates the role value before inserting (guards against CHECK constraint failure)
--   3. Is executable by supabase_auth_admin (the role GoTrue uses)
--   4. The trigger itself is present on auth.users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Validate role from metadata against allowed values; fall back to 'client'
  v_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' IN ('admin', 'master_ib', 'client')
      THEN NEW.raw_user_meta_data->>'role'
    ELSE 'client'
  END;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
    v_role
  );

  RETURN NEW;
END;
$$;

-- Ensure postgres owns the function so SECURITY DEFINER grants superuser privileges
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Grant execute to the role GoTrue uses internally
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- Recreate the trigger in case it was dropped or never created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
