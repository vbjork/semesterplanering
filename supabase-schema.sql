-- ============================================
-- Semesterplanering.se — Databasschema
-- Kör detta i Supabase Dashboard → SQL Editor
-- ============================================

-- Anställda
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own employees"
  ON employees FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Semesterperioder (en per användare och år)
CREATE TABLE vacation_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  start_week INTEGER NOT NULL CHECK (start_week BETWEEN 1 AND 53),
  end_week INTEGER NOT NULL CHECK (end_week BETWEEN 1 AND 53),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year)
);

ALTER TABLE vacation_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own periods"
  ON vacation_periods FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Semestertilldelningar
CREATE TABLE vacation_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, year, week_number)
);

ALTER TABLE vacation_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assignments"
  ON vacation_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = vacation_assignments.employee_id
      AND employees.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = vacation_assignments.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- Index för prestanda
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_vacation_periods_user_year ON vacation_periods(user_id, year);
CREATE INDEX idx_vacation_assignments_employee ON vacation_assignments(employee_id, year);
