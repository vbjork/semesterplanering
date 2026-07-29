-- Migration: Dela upp veckor i 7 dagar
-- Kör detta i Supabase Dashboard → SQL Editor

-- Lägg till dag-kolumn (1=Mån, 2=Tis, ... 7=Sön)
ALTER TABLE vacation_assignments ADD COLUMN day_number INTEGER NOT NULL DEFAULT 1;

-- Ta bort gammal unik constraint och skapa ny med dag
ALTER TABLE vacation_assignments DROP CONSTRAINT IF EXISTS vacation_assignments_employee_id_year_week_number_key;
ALTER TABLE vacation_assignments ADD CONSTRAINT vacation_assignments_emp_year_week_day_key
  UNIQUE (employee_id, year, week_number, day_number);

-- Validering: dag måste vara 1-7
ALTER TABLE vacation_assignments ADD CONSTRAINT vacation_assignments_day_check
  CHECK (day_number >= 1 AND day_number <= 7);
