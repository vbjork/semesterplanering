-- Migration: Jour
-- Kör detta i Supabase Dashboard → SQL Editor

CREATE TABLE jour_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, year, week_number, day_number)
);

ALTER TABLE jour_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own jour assignments"
  ON jour_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = jour_assignments.employee_id
      AND employees.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = jour_assignments.employee_id
      AND employees.user_id = auth.uid()
    )
  );
