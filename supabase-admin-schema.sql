-- ============================================
-- Admin-funktioner för Semesterplanering.se
-- Kör detta i Supabase Dashboard → SQL Editor
-- ============================================

-- Funktion: Hämta alla användare (bara admin kan köra)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Kontrollera att anroparen är admin
  IF (SELECT au.email FROM auth.users au WHERE au.id = auth.uid()) != 'v.bjork@outlook.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    au.id,
    au.email::TEXT,
    au.created_at,
    au.last_sign_in_at
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$;

-- Funktion: Ta bort en användare (bara admin kan köra)
CREATE OR REPLACE FUNCTION delete_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Kontrollera att anroparen är admin
  IF (SELECT au.email FROM auth.users au WHERE au.id = auth.uid()) != 'v.bjork@outlook.com' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Förhindra att admin tar bort sig själv
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete own account';
  END IF;

  -- Ta bort användarens data (cascade hanterar employees → assignments)
  DELETE FROM vacation_periods WHERE user_id = target_user_id;
  DELETE FROM employees WHERE user_id = target_user_id;

  -- Ta bort användaren från auth
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
