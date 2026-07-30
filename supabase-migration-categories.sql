-- Migration: Ledighetstyper med färger
-- Kör detta i Supabase Dashboard → SQL Editor

-- Lägg till kategori på assignments (0-9)
ALTER TABLE vacation_assignments ADD COLUMN category INTEGER NOT NULL DEFAULT 0;

-- Tabell för användarens namngivna ledighetstyper
CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  color_index INTEGER NOT NULL CHECK (color_index >= 0 AND color_index <= 9),
  name TEXT NOT NULL,
  UNIQUE(user_id, color_index)
);

ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own leave types" ON leave_types
  FOR ALL USING (user_id = auth.uid());
