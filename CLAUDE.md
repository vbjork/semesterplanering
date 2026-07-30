# Semesterplanering

Vacation planning web app. Vanilla HTML/CSS/JS hosted on GitHub Pages. No build step.

Live: https://vbjork.github.io/semesterplanering/
Repo: https://github.com/vbjork/semesterplanering

## Supabase

- URL: https://iaokbiyualhhjtbjrhlg.supabase.co
- Key: sb_publishable_RXZ1-GTJ_ifdCt7q9sS1zg_IJW0A851
- Client variable MUST be named `db` (not `supabase`) — avoids collision with CDN global
- Admin email: v.bjork@outlook.com (hardcoded in auth.js and SQL SECURITY DEFINER functions)
- RLS enabled on all tables

## Database tables

- `employees` — id, user_id, name, group_id (FK to groups)
- `vacation_periods` — id, user_id, year, start_week, end_week, UNIQUE(user_id, year)
- `vacation_assignments` — id, employee_id, year, week_number, day_number (1-7), category (0-9)
- `groups` — id, user_id, name
- `leave_types` — id, user_id, color_index (0-9), name, UNIQUE(user_id, color_index)

## Code structure

- `js/supabase-config.js` — Supabase client init (`const db = ...`)
- `js/auth.js` — login/signup/logout/reset, admin panel, session handling
- `js/app.js` — grid rendering, drag-to-select, color categories, leave types, groups, CRUD
- `css/style.css` — ProjektPuls Design System variables and all styling
- `index.html` — single page: auth-container, app-container, admin-container

## Key patterns

- `appLoaded` flag in app.js prevents double `loadApp()` calls (race between checkSession and onAuthStateChange)
- Assignment keys: `employeeId + '_' + weekNumber + '_' + dayNumber`
- 10 color categories with customizable names (COLORS array in app.js)
- Settings panel slides in from right as overlay
- Group tabs in topbar for switching between arbetslag

## Deploy

- Push to main, GitHub Pages auto-deploys
- CSS can be aggressively cached by GitHub Pages CDN — may need cache-busting
- `gh` CLI is NOT installed on this machine
- Git user: v.bjork@outlook.com

## Language

User communicates in Swedish. UI text is in Swedish.
