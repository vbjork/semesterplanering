let currentYear = new Date().getFullYear();
let employees = [];
let vacationPeriod = null;
let assignments = {};

const yearSelect = document.getElementById('year-select');
const startWeekSelect = document.getElementById('start-week');
const endWeekSelect = document.getElementById('end-week');
const savePeriodBtn = document.getElementById('save-period-btn');
const employeeNameInput = document.getElementById('employee-name');
const addEmployeeBtn = document.getElementById('add-employee-btn');
const employeeList = document.getElementById('employee-list');
const vacationGrid = document.getElementById('vacation-grid');
const periodStatus = document.getElementById('period-status');

function populateYearSelect() {
  const thisYear = new Date().getFullYear();
  for (let y = thisYear - 1; y <= thisYear + 2; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === thisYear) opt.selected = true;
    yearSelect.appendChild(opt);
  }
}

function populateWeekSelects() {
  [startWeekSelect, endWeekSelect].forEach((sel, i) => {
    sel.innerHTML = '';
    for (let w = 1; w <= 53; w++) {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = `V${w}`;
      sel.appendChild(opt);
    }
  });
  startWeekSelect.value = 25;
  endWeekSelect.value = 35;
}

async function loadVacationPeriod() {
  const { data } = await db
    .from('vacation_periods')
    .select('*')
    .eq('year', currentYear)
    .maybeSingle();

  vacationPeriod = data;
  if (data) {
    startWeekSelect.value = data.start_week;
    endWeekSelect.value = data.end_week;
    periodStatus.textContent = `Semesterperiod: V${data.start_week}–V${data.end_week}`;
    periodStatus.className = 'period-status saved';
  } else {
    periodStatus.textContent = 'Ingen period sparad för detta år';
    periodStatus.className = 'period-status';
  }
}

async function savePeriod() {
  const startWeek = parseInt(startWeekSelect.value);
  const endWeek = parseInt(endWeekSelect.value);

  if (startWeek > endWeek) {
    periodStatus.textContent = 'Startvecka måste vara före slutvecka';
    periodStatus.className = 'period-status error';
    return;
  }

  const { data: { session } } = await db.auth.getSession();

  const { error } = await db
    .from('vacation_periods')
    .upsert({
      user_id: session.user.id,
      year: currentYear,
      start_week: startWeek,
      end_week: endWeek
    }, { onConflict: 'user_id,year' });

  if (error) {
    periodStatus.textContent = 'Fel vid sparande: ' + error.message;
    periodStatus.className = 'period-status error';
    return;
  }

  await loadVacationPeriod();
  renderGrid();
}

async function loadEmployees() {
  const { data } = await db
    .from('employees')
    .select('*')
    .order('name');

  employees = data || [];
  renderEmployeeList();
}

async function addEmployee() {
  const name = employeeNameInput.value.trim();
  if (!name) return;

  const { data: { session } } = await db.auth.getSession();

  const { error } = await db
    .from('employees')
    .insert({ user_id: session.user.id, name });

  if (error) {
    alert('Kunde inte lägga till: ' + error.message);
    return;
  }

  employeeNameInput.value = '';
  await loadEmployees();
  await loadAssignments();
  renderGrid();
}

async function deleteEmployee(id) {
  const { error } = await db
    .from('employees')
    .delete()
    .eq('id', id);

  if (!error) {
    await loadEmployees();
    await loadAssignments();
    renderGrid();
  }
}

function renderEmployeeList() {
  employeeList.innerHTML = '';
  employees.forEach(emp => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="employee-name">${emp.name}</span>
      <button class="delete-btn" title="Ta bort">&times;</button>
    `;
    li.querySelector('.delete-btn').addEventListener('click', () => {
      if (confirm(`Ta bort ${emp.name}?`)) {
        deleteEmployee(emp.id);
      }
    });
    employeeList.appendChild(li);
  });
}

async function loadAssignments() {
  if (employees.length === 0) {
    assignments = {};
    return;
  }

  const employeeIds = employees.map(e => e.id);
  const { data } = await db
    .from('vacation_assignments')
    .select('*')
    .in('employee_id', employeeIds)
    .eq('year', currentYear);

  assignments = {};
  (data || []).forEach(a => {
    const key = `${a.employee_id}_${a.week_number}`;
    assignments[key] = a.id;
  });
}

async function toggleAssignment(employeeId, weekNumber) {
  const key = `${employeeId}_${weekNumber}`;

  if (assignments[key]) {
    await db
      .from('vacation_assignments')
      .delete()
      .eq('id', assignments[key]);
    delete assignments[key];
  } else {
    const { data, error } = await db
      .from('vacation_assignments')
      .insert({ employee_id: employeeId, year: currentYear, week_number: weekNumber })
      .select()
      .single();

    if (!error) {
      assignments[key] = data.id;
    }
  }

  renderGrid();
}

function renderGrid() {
  vacationGrid.innerHTML = '';

  if (!vacationPeriod || employees.length === 0) {
    vacationGrid.innerHTML = '<p class="grid-empty">Lägg till anställda och spara en semesterperiod för att se schemat.</p>';
    return;
  }

  const startW = vacationPeriod.start_week;
  const endW = vacationPeriod.end_week;
  const weeks = [];
  for (let w = startW; w <= endW; w++) {
    weeks.push(w);
  }

  const table = document.createElement('table');
  table.className = 'vacation-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const nameHeader = document.createElement('th');
  nameHeader.textContent = 'Anställd';
  nameHeader.className = 'name-col';
  headerRow.appendChild(nameHeader);

  weeks.forEach(w => {
    const th = document.createElement('th');
    th.textContent = `V${w}`;
    th.className = 'week-col';
    headerRow.appendChild(th);
  });

  const totalHeader = document.createElement('th');
  totalHeader.textContent = 'Veckor';
  totalHeader.className = 'total-col';
  headerRow.appendChild(totalHeader);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  employees.forEach(emp => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = emp.name;
    nameCell.className = 'name-col';
    row.appendChild(nameCell);

    let totalWeeks = 0;

    weeks.forEach(w => {
      const cell = document.createElement('td');
      cell.className = 'week-cell';
      const key = `${emp.id}_${w}`;
      const isVacation = !!assignments[key];

      if (isVacation) {
        cell.classList.add('vacation');
        totalWeeks++;
      }

      cell.addEventListener('click', () => toggleAssignment(emp.id, w));
      row.appendChild(cell);
    });

    const totalCell = document.createElement('td');
    totalCell.textContent = totalWeeks;
    totalCell.className = 'total-col total-value';
    row.appendChild(totalCell);

    tbody.appendChild(row);
  });

  // Summary row
  const summaryRow = document.createElement('tr');
  summaryRow.className = 'summary-row';
  const summaryLabel = document.createElement('td');
  summaryLabel.textContent = 'Antal lediga';
  summaryLabel.className = 'name-col';
  summaryRow.appendChild(summaryLabel);

  weeks.forEach(w => {
    const cell = document.createElement('td');
    cell.className = 'week-col summary-cell';
    let count = 0;
    employees.forEach(emp => {
      if (assignments[`${emp.id}_${w}`]) count++;
    });
    cell.textContent = count;
    if (count > 0) cell.classList.add('has-vacation');
    summaryRow.appendChild(cell);
  });

  const emptyTotal = document.createElement('td');
  summaryRow.appendChild(emptyTotal);
  tbody.appendChild(summaryRow);

  table.appendChild(tbody);
  vacationGrid.appendChild(table);
}

// Event listeners
savePeriodBtn.addEventListener('click', savePeriod);

addEmployeeBtn.addEventListener('click', addEmployee);
employeeNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addEmployee();
});

yearSelect.addEventListener('change', async () => {
  currentYear = parseInt(yearSelect.value);
  await loadVacationPeriod();
  await loadAssignments();
  renderGrid();
});

async function loadApp() {
  populateYearSelect();
  populateWeekSelects();
  await loadVacationPeriod();
  await loadEmployees();
  await loadAssignments();
  renderGrid();
}
