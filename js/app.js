let currentYear = new Date().getFullYear();
let employees = [];
let vacationPeriod = null;
let assignments = {};
let groups = [];
let currentGroupId = null;
let appLoaded = false;
let activeColor = 0;
let leaveTypes = {};

const DAY_NAMES = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

const COLORS = [
  { bg: '#4ade80', hover: '#22c55e', default: 'Semester' },
  { bg: '#60a5fa', hover: '#3b82f6', default: 'Föräldraledig' },
  { bg: '#c084fc', hover: '#a855f7', default: 'VAB' },
  { bg: '#fb923c', hover: '#f97316', default: 'Tjänstledig' },
  { bg: '#f472b6', hover: '#ec4899', default: 'Sjuk' },
  { bg: '#2dd4bf', hover: '#14b8a6', default: 'Utbildning' },
  { bg: '#facc15', hover: '#eab308', default: 'Kompledigt' },
  { bg: '#f87171', hover: '#ef4444', default: 'Permission' },
  { bg: '#818cf8', hover: '#6366f1', default: 'Annat 1' },
  { bg: '#94a3b8', hover: '#64748b', default: 'Annat 2' },
];

function getLeaveTypeName(index) {
  return leaveTypes[index] || COLORS[index].default;
}

// Drag state
let isDragging = false;
let dragMode = null; // 'add' or 'remove'
let dragCells = [];

const yearSelect = document.getElementById('year-select');
const startWeekSelect = document.getElementById('start-week');
const endWeekSelect = document.getElementById('end-week');
const savePeriodBtn = document.getElementById('save-period-btn');
const employeeNameInput = document.getElementById('employee-name');
const addEmployeeBtn = document.getElementById('add-employee-btn');
const employeeList = document.getElementById('employee-list');
const vacationGrid = document.getElementById('vacation-grid');
const periodStatus = document.getElementById('period-status');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsBtn = document.getElementById('settings-btn');
const closeSettings = document.getElementById('close-settings');
const groupTabs = document.getElementById('group-tabs');
const groupList = document.getElementById('group-list');
const groupNameInput = document.getElementById('group-name');
const addGroupBtn = document.getElementById('add-group-btn');
const periodBadge = document.getElementById('period-badge');
const currentGroupNameEl = document.getElementById('current-group-name');
const colorPalette = document.getElementById('color-palette');
const leaveTypeList = document.getElementById('leave-type-list');

// Settings panel
settingsBtn.addEventListener('click', () => {
  settingsOverlay.classList.remove('hidden');
});
closeSettings.addEventListener('click', () => {
  settingsOverlay.classList.add('hidden');
});
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) {
    settingsOverlay.classList.add('hidden');
  }
});

// Color palette
function renderColorPalette() {
  colorPalette.innerHTML = '';
  COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.className = 'color-swatch' + (i === activeColor ? ' active' : '');
    btn.style.background = c.bg;
    btn.title = getLeaveTypeName(i);
    btn.addEventListener('click', () => {
      activeColor = i;
      renderColorPalette();
    });
    colorPalette.appendChild(btn);
  });

  const label = document.createElement('span');
  label.className = 'color-label';
  label.textContent = getLeaveTypeName(activeColor);
  colorPalette.appendChild(label);
}

// Leave types
async function loadLeaveTypes() {
  const { data } = await db
    .from('leave_types')
    .select('*');

  leaveTypes = {};
  (data || []).forEach(lt => {
    leaveTypes[lt.color_index] = lt.name;
  });
}

function renderLeaveTypeList() {
  leaveTypeList.innerHTML = '';
  COLORS.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = 'leave-type-item';

    const swatch = document.createElement('span');
    swatch.className = 'leave-type-swatch';
    swatch.style.background = c.bg;
    item.appendChild(swatch);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'ds-input leave-type-input';
    nameInput.value = getLeaveTypeName(i);
    nameInput.placeholder = c.default;

    let saveTimeout;
    nameInput.addEventListener('input', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => saveLeaveType(i, nameInput.value.trim()), 600);
    });

    item.appendChild(nameInput);
    leaveTypeList.appendChild(item);
  });
}

async function saveLeaveType(index, name) {
  const { data: { session } } = await db.auth.getSession();
  const effectiveName = name || COLORS[index].default;

  await db
    .from('leave_types')
    .upsert({
      user_id: session.user.id,
      color_index: index,
      name: effectiveName
    }, { onConflict: 'user_id,color_index' });

  leaveTypes[index] = effectiveName;
  renderColorPalette();
}

function populateYearSelect() {
  yearSelect.innerHTML = '';
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
  [startWeekSelect, endWeekSelect].forEach(sel => {
    sel.innerHTML = '';
    for (let w = 1; w <= 53; w++) {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = w;
      sel.appendChild(opt);
    }
  });
  startWeekSelect.value = 25;
  endWeekSelect.value = 35;
}

// Groups
async function loadGroups() {
  const { data } = await db
    .from('groups')
    .select('*')
    .order('created_at');

  groups = data || [];

  if (groups.length === 0) {
    const { data: { session } } = await db.auth.getSession();
    const { data: newGroup } = await db
      .from('groups')
      .insert({ user_id: session.user.id, name: 'Arbetslag 1' })
      .select()
      .single();
    if (newGroup) groups = [newGroup];
  }

  if (!currentGroupId || !groups.find(g => g.id === currentGroupId)) {
    currentGroupId = groups.length > 0 ? groups[0].id : null;
  }

  renderGroupTabs();
  renderGroupList();
  updateCurrentGroupName();
}

function renderGroupTabs() {
  groupTabs.innerHTML = '';
  groups.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'group-tab' + (g.id === currentGroupId ? ' active' : '');
    btn.textContent = g.name;
    btn.addEventListener('click', () => switchGroup(g.id));
    groupTabs.appendChild(btn);
  });
}

function renderGroupList() {
  groupList.innerHTML = '';
  groups.forEach(g => {
    const item = document.createElement('div');
    item.className = 'group-manage-item';

    const name = document.createElement('span');
    name.className = 'group-item-name';
    name.textContent = g.name;
    name.title = 'Dubbelklicka för att byta namn';
    name.addEventListener('dblclick', () => startRenameGroup(g, name));
    item.appendChild(name);

    if (groups.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.innerHTML = '&times;';
      delBtn.addEventListener('click', () => {
        if (confirm('Ta bort grupp "' + g.name + '"? Alla anställda i gruppen raderas.')) {
          deleteGroup(g.id);
        }
      });
      item.appendChild(delBtn);
    }

    groupList.appendChild(item);
  });
}

function startRenameGroup(group, spanEl) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'ds-input';
  input.value = group.name;
  input.style.padding = '4px 8px';
  input.style.fontSize = '0.82rem';
  spanEl.replaceWith(input);
  input.focus();
  input.select();

  const save = async () => {
    const newName = input.value.trim();
    if (newName && newName !== group.name) {
      await db.from('groups').update({ name: newName }).eq('id', group.id);
      await loadGroups();
    } else {
      renderGroupList();
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = group.name; input.blur(); }
  });
}

function updateCurrentGroupName() {
  const g = groups.find(g => g.id === currentGroupId);
  currentGroupNameEl.textContent = g ? '— ' + g.name : '';
}

async function addGroup() {
  const name = groupNameInput.value.trim();
  if (!name) return;
  const { data: { session } } = await db.auth.getSession();
  const { error } = await db.from('groups').insert({ user_id: session.user.id, name });
  if (error) { alert('Kunde inte skapa grupp: ' + error.message); return; }
  groupNameInput.value = '';
  await loadGroups();
}

async function deleteGroup(id) {
  const { error } = await db.from('groups').delete().eq('id', id);
  if (!error) {
    if (currentGroupId === id) currentGroupId = null;
    await loadGroups();
    await loadEmployees();
    await loadAssignments();
    renderGrid();
  }
}

async function switchGroup(id) {
  currentGroupId = id;
  renderGroupTabs();
  updateCurrentGroupName();
  await loadEmployees();
  await loadAssignments();
  renderGrid();
}

addGroupBtn.addEventListener('click', addGroup);
groupNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addGroup(); });

// Vacation period
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
    periodStatus.textContent = 'Sparad: V' + data.start_week + '–V' + data.end_week;
    periodStatus.className = 'period-status saved';
    periodBadge.textContent = 'V' + data.start_week + '–V' + data.end_week + ' ' + currentYear;
  } else {
    periodStatus.textContent = 'Ingen period sparad';
    periodStatus.className = 'period-status';
    periodBadge.textContent = '';
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
  const { error } = await db.from('vacation_periods').upsert({
    user_id: session.user.id, year: currentYear, start_week: startWeek, end_week: endWeek
  }, { onConflict: 'user_id,year' });
  if (error) {
    periodStatus.textContent = 'Fel: ' + error.message;
    periodStatus.className = 'period-status error';
    return;
  }
  await loadVacationPeriod();
  renderGrid();
}

// Employees
async function loadEmployees() {
  if (!currentGroupId) { employees = []; renderEmployeeList(); return; }
  const { data } = await db.from('employees').select('*').eq('group_id', currentGroupId).order('name');
  employees = data || [];
  renderEmployeeList();
}

async function addEmployee() {
  const name = employeeNameInput.value.trim();
  if (!name || !currentGroupId) return;
  const { data: { session } } = await db.auth.getSession();
  const { error } = await db.from('employees').insert({ user_id: session.user.id, name, group_id: currentGroupId });
  if (error) { alert('Kunde inte lägga till: ' + error.message); return; }
  employeeNameInput.value = '';
  await loadEmployees();
  await loadAssignments();
  renderGrid();
}

async function deleteEmployee(id) {
  const { error } = await db.from('employees').delete().eq('id', id);
  if (!error) { await loadEmployees(); await loadAssignments(); renderGrid(); }
}

function renderEmployeeList() {
  employeeList.innerHTML = '';
  employees.forEach(emp => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'employee-name';
    nameSpan.textContent = emp.name;
    li.appendChild(nameSpan);
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.title = 'Ta bort';
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', () => {
      if (confirm('Ta bort ' + emp.name + '?')) deleteEmployee(emp.id);
    });
    li.appendChild(delBtn);
    employeeList.appendChild(li);
  });
}

// Assignments
async function loadAssignments() {
  if (employees.length === 0) { assignments = {}; return; }
  const employeeIds = employees.map(e => e.id);
  const { data } = await db
    .from('vacation_assignments')
    .select('*')
    .in('employee_id', employeeIds)
    .eq('year', currentYear);

  assignments = {};
  (data || []).forEach(a => {
    const key = a.employee_id + '_' + a.week_number + '_' + a.day_number;
    assignments[key] = { id: a.id, category: a.category || 0 };
  });
}

async function setAssignment(employeeId, weekNumber, dayNumber, category) {
  const key = employeeId + '_' + weekNumber + '_' + dayNumber;

  if (assignments[key]) {
    await db.from('vacation_assignments').delete().eq('id', assignments[key].id);
    delete assignments[key];
  }

  if (category !== null) {
    const { data, error } = await db
      .from('vacation_assignments')
      .insert({
        employee_id: employeeId,
        year: currentYear,
        week_number: weekNumber,
        day_number: dayNumber,
        category: category
      })
      .select()
      .single();

    if (!error) {
      assignments[key] = { id: data.id, category: data.category };
    }
  }
}

// Drag handling
function handleDragStart(td, employeeId, week, day) {
  isDragging = true;
  const key = employeeId + '_' + week + '_' + day;
  dragMode = assignments[key] ? 'remove' : 'add';
  dragCells = [{ td, employeeId, week, day }];
  applyDragPreview(td);
}

function handleDragEnter(td, employeeId, week, day) {
  if (!isDragging) return;
  if (!dragCells.find(c => c.employeeId === employeeId && c.week === week && c.day === day)) {
    dragCells.push({ td, employeeId, week, day });
    applyDragPreview(td);
  }
}

function applyDragPreview(td) {
  if (dragMode === 'add') {
    td.style.background = COLORS[activeColor].bg;
    td.style.opacity = '0.6';
  } else {
    td.style.background = '#fee2e2';
    td.style.opacity = '0.6';
  }
}

async function handleDragEnd() {
  if (!isDragging) return;
  isDragging = false;

  for (const cell of dragCells) {
    cell.td.style.opacity = '';
    cell.td.style.background = '';

    if (dragMode === 'add') {
      await setAssignment(cell.employeeId, cell.week, cell.day, activeColor);
    } else {
      await setAssignment(cell.employeeId, cell.week, cell.day, null);
    }
  }

  dragCells = [];
  renderGrid();
}

document.addEventListener('mouseup', handleDragEnd);

// Grid
function renderGrid() {
  vacationGrid.innerHTML = '';

  if (!vacationPeriod || employees.length === 0) {
    const msg = !currentGroupId
      ? 'Öppna Inställningar för att skapa en grupp.'
      : !vacationPeriod
        ? 'Öppna Inställningar för att ange semesterperiod.'
        : 'Öppna Inställningar för att lägga till anställda.';
    vacationGrid.innerHTML = '<p class="grid-empty">' + msg + '</p>';
    return;
  }

  const startW = vacationPeriod.start_week;
  const endW = vacationPeriod.end_week;
  const weeks = [];
  for (let w = startW; w <= endW; w++) weeks.push(w);

  const table = document.createElement('table');
  table.className = 'vacation-table';
  table.addEventListener('selectstart', (e) => { if (isDragging) e.preventDefault(); });

  const thead = document.createElement('thead');
  const weekRow = document.createElement('tr');

  const nameHeader = document.createElement('th');
  nameHeader.className = 'col-name';
  nameHeader.textContent = 'Anställd';
  nameHeader.rowSpan = 2;
  weekRow.appendChild(nameHeader);

  weeks.forEach(w => {
    const th = document.createElement('th');
    th.className = 'col-week-group';
    th.colSpan = 7;
    th.textContent = 'V' + w;
    weekRow.appendChild(th);
  });

  const totalHeader = document.createElement('th');
  totalHeader.className = 'col-total';
  totalHeader.textContent = 'Dagar';
  totalHeader.rowSpan = 2;
  weekRow.appendChild(totalHeader);

  thead.appendChild(weekRow);

  const dayRow = document.createElement('tr');
  weeks.forEach(() => {
    DAY_NAMES.forEach(d => {
      const th = document.createElement('th');
      th.className = 'col-day';
      th.textContent = d;
      dayRow.appendChild(th);
    });
  });
  thead.appendChild(dayRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  employees.forEach(emp => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.className = 'col-name';
    nameCell.textContent = emp.name;
    row.appendChild(nameCell);

    let totalDays = 0;

    weeks.forEach(w => {
      for (let d = 1; d <= 7; d++) {
        const td = document.createElement('td');
        td.className = 'day-cell';
        if (d === 6 || d === 7) td.classList.add('weekend');

        const key = emp.id + '_' + w + '_' + d;
        const assignment = assignments[key];
        if (assignment) {
          td.classList.add('active');
          td.style.background = COLORS[assignment.category].bg;
          td.title = getLeaveTypeName(assignment.category);
          totalDays++;
        }

        td.addEventListener('mousedown', (e) => {
          e.preventDefault();
          handleDragStart(td, emp.id, w, d);
        });
        td.addEventListener('mouseenter', () => handleDragEnter(td, emp.id, w, d));

        row.appendChild(td);
      }
    });

    const totalCell = document.createElement('td');
    totalCell.className = 'col-total emp-total';
    totalCell.textContent = totalDays;
    row.appendChild(totalCell);

    tbody.appendChild(row);
  });

  // Summary row
  const summaryRow = document.createElement('tr');
  summaryRow.className = 'summary-row';
  const summaryLabel = document.createElement('td');
  summaryLabel.className = 'col-name';
  summaryLabel.textContent = 'Antal lediga';
  summaryRow.appendChild(summaryLabel);

  weeks.forEach(w => {
    for (let d = 1; d <= 7; d++) {
      const td = document.createElement('td');
      let count = 0;
      employees.forEach(emp => {
        if (assignments[emp.id + '_' + w + '_' + d]) count++;
      });
      td.textContent = count || '';
      if (count > 0) td.classList.add('has-count');
      summaryRow.appendChild(td);
    }
  });

  const emptyTotal = document.createElement('td');
  summaryRow.appendChild(emptyTotal);
  tbody.appendChild(summaryRow);

  table.appendChild(tbody);
  vacationGrid.appendChild(table);
}

// Events
savePeriodBtn.addEventListener('click', savePeriod);
addEmployeeBtn.addEventListener('click', addEmployee);
employeeNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addEmployee(); });

yearSelect.addEventListener('change', async () => {
  currentYear = parseInt(yearSelect.value);
  await loadVacationPeriod();
  await loadAssignments();
  renderGrid();
});

async function loadApp() {
  if (appLoaded) return;
  appLoaded = true;
  populateYearSelect();
  populateWeekSelects();
  await loadLeaveTypes();
  renderColorPalette();
  renderLeaveTypeList();
  await loadGroups();
  await loadVacationPeriod();
  await loadEmployees();
  await loadAssignments();
  renderGrid();
}
