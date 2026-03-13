-- ============================================
-- Save Google avatar URL on signup
-- ============================================
-- Google OAuth provides a profile picture in raw_user_meta_data->>'picture'.
-- This migration updates the trigger to store it in profiles.avatar_url.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' IN ('admin', 'master_ib', 'client')
      THEN NEW.raw_user_meta_data->>'role'
    ELSE 'client'
  END;

  INSERT INTO public.profiles (id, email, full_name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
    v_role,
    NEW.raw_user_meta_data->>'picture'
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- For existing users who signed up via Google but don't have avatar_url yet,
-- update from auth.users metadata
UPDATE public.profiles p
SET avatar_url = u.raw_user_meta_data->>'picture'
FROM auth.users u
WHERE p.id = u.id
  AND p.avatar_url IS NULL
  AND u.raw_user_meta_data->>'picture' IS NOT NULL;
