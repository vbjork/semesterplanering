-- Migration: Grupper (arbetslag)
-- Kör detta i Supabase Dashboard → SQL Editor

-- Ny tabell: grupper
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own groups" ON groups
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX idx_groups_user ON groups(user_id);

-- Lägg till group_id på employees
ALTER TABLE employees ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

-- Skapa en standardgrupp för varje befintlig användare och flytta deras anställda dit
DO $$
DECLARE
  u RECORD;
  new_group_id UUID;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM employees LOOP
    INSERT INTO groups (user_id, name) VALUES (u.user_id, 'Arbetslag 1')
    RETURNING id INTO new_group_id;

    UPDATE employees SET group_id = new_group_id WHERE user_id = u.user_id AND group_id IS NULL;
  END LOOP;
END $$;

-- Gör group_id obligatorisk efter migrering
ALTER TABLE employees ALTER COLUMN group_id SET NOT NULL;
