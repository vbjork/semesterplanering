let currentYear = new Date().getFullYear();
let employees = [];
let vacationPeriod = null;
let assignments = {};
let groups = [];
let currentGroupId = null;
let appLoaded = false;
let activeColor = 0;
let leaveTypes = {};
let viewSpan = null;
let viewStart = null;

const DAY_NAMES = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

const COLORS = [
  { bg: '#b6e2c8', hover: '#8fd4ac', default: 'Semester' },
  { bg: '#bbc5f5', hover: '#9aa8f0', default: 'Föräldraledig' },
  { bg: '#f5c4a1', hover: '#f0a878', default: 'VAB' },
  { bg: '#f5dfa1', hover: '#f0d078', default: 'Tjänstledig' },
  { bg: '#f5b0c5', hover: '#f08da8', default: 'Sjuk' },
  { bg: '#a1ddd5', hover: '#78d0c4', default: 'Utbildning' },
  { bg: '#f5d4a8', hover: '#f0c080', default: 'Kompledigt' },
  { bg: '#e2b5f5', hover: '#d494f0', default: 'Permission' },
  { bg: '#f5a8a8', hover: '#f08080', default: 'Annat 1' },
  { bg: '#c8ced8', hover: '#aeb6c4', default: 'Annat 2' },
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
const exportBtn = document.getElementById('export-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const dashboardOverlay = document.getElementById('dashboard-overlay');
const closeDashboard = document.getElementById('close-dashboard');
const dashboardChart = document.getElementById('dashboard-chart');
const noteModal = document.getElementById('note-modal');
const noteText = document.getElementById('note-text');
const noteModalTitle = document.getElementById('note-modal-title');
const saveNoteBtn = document.getElementById('save-note-btn');
const deleteNoteBtn = document.getElementById('delete-note-btn');
const closeNote = document.getElementById('close-note');
let cellNotes = {};
let currentNoteKey = null;

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

const rangeStartLabel = document.getElementById('range-start-label');
const rangeEndLabel = document.getElementById('range-end-label');
const rangeFill = document.getElementById('range-fill');

function populateWeekSelects() {
  startWeekSelect.value = 25;
  endWeekSelect.value = 35;
  updateRangeSlider();
}

function updateRangeSlider() {
  let startVal = parseInt(startWeekSelect.value);
  let endVal = parseInt(endWeekSelect.value);
  if (startVal > endVal) {
    const tmp = startVal;
    startVal = endVal;
    endVal = tmp;
    startWeekSelect.value = startVal;
    endWeekSelect.value = endVal;
  }
  rangeStartLabel.textContent = startVal;
  rangeEndLabel.textContent = endVal;
  const min = 1, max = 53;
  const leftPct = ((startVal - min) / (max - min)) * 100;
  const rightPct = ((endVal - min) / (max - min)) * 100;
  rangeFill.style.left = leftPct + '%';
  rangeFill.style.width = (rightPct - leftPct) + '%';
}

startWeekSelect.addEventListener('input', () => {
  if (parseInt(startWeekSelect.value) > parseInt(endWeekSelect.value)) {
    startWeekSelect.value = endWeekSelect.value;
  }
  updateRangeSlider();
});

endWeekSelect.addEventListener('input', () => {
  if (parseInt(endWeekSelect.value) < parseInt(startWeekSelect.value)) {
    endWeekSelect.value = startWeekSelect.value;
  }
  updateRangeSlider();
});

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
  await loadNotes();
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
    updateRangeSlider();
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
  const emp = employees.find(e => e.id === employeeId);
  const empName = emp ? emp.name : '?';
  const oldCat = assignments[key] ? assignments[key].category : null;

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

  logActivity(empName, weekNumber, dayNumber, oldCat, category);
}

async function logActivity(empName, week, day, oldCategory, newCategory) {
  const dayNames = ['', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
  let description;
  if (oldCategory !== null && newCategory !== null) {
    description = empName + ': ändrade V' + week + ' ' + dayNames[day] + ' från ' + getLeaveTypeName(oldCategory) + ' till ' + getLeaveTypeName(newCategory);
  } else if (newCategory !== null) {
    description = empName + ': la till ' + getLeaveTypeName(newCategory) + ' V' + week + ' ' + dayNames[day];
  } else {
    description = empName + ': tog bort ' + getLeaveTypeName(oldCategory) + ' V' + week + ' ' + dayNames[day];
  }
  const { data: { session } } = await db.auth.getSession();
  await db.from('activity_log').insert({
    user_id: session.user.id,
    year: currentYear,
    group_id: currentGroupId,
    description: description
  });
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

  document.getElementById('week-nav-container').innerHTML = '';

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
  const totalWeeks = endW - startW + 1;

  if (viewStart === null) viewStart = startW;
  if (viewStart < startW) viewStart = startW;

  const allWeeks = [];
  for (let w = startW; w <= endW; w++) allWeeks.push(w);

  let weeks;
  if (viewSpan === null) {
    weeks = allWeeks;
  } else {
    if (viewStart + viewSpan - 1 > endW) viewStart = endW - viewSpan + 1;
    if (viewStart < startW) viewStart = startW;
    const visEnd = Math.min(viewStart + viewSpan - 1, endW);
    weeks = [];
    for (let w = viewStart; w <= visEnd; w++) weeks.push(w);
  }

  const nav = document.createElement('div');
  nav.className = 'week-nav';

  const step = viewSpan || 1;

  const leftBtn = document.createElement('button');
  leftBtn.className = 'week-nav-btn';
  leftBtn.textContent = '‹';
  leftBtn.disabled = viewSpan === null || viewStart <= startW;
  leftBtn.addEventListener('click', () => { viewStart = Math.max(startW, viewStart - step); renderGrid(); });

  const rightBtn = document.createElement('button');
  rightBtn.className = 'week-nav-btn';
  rightBtn.textContent = '›';
  rightBtn.disabled = viewSpan === null || viewStart + viewSpan - 1 >= endW;
  rightBtn.addEventListener('click', () => { viewStart = Math.min(endW - step + 1, viewStart + step); renderGrid(); });

  const spanLabel = document.createElement('span');
  spanLabel.className = 'week-nav-label';
  spanLabel.textContent = viewSpan === null
    ? 'V' + startW + '–V' + endW
    : 'V' + weeks[0] + '–V' + weeks[weeks.length - 1] + ' av V' + startW + '–V' + endW;

  const makeZoom = (label, span) => {
    const btn = document.createElement('button');
    btn.className = 'week-nav-zoom' + (viewSpan === span ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      viewSpan = span;
      if (viewSpan !== null && viewSpan >= totalWeeks) viewSpan = null;
      renderGrid();
    });
    return btn;
  };

  nav.appendChild(leftBtn);
  nav.appendChild(makeZoom('4v', 4));
  nav.appendChild(makeZoom('8v', 8));
  nav.appendChild(makeZoom('Alla', null));
  nav.appendChild(spanLabel);
  nav.appendChild(rightBtn);

  const weekNavContainer = document.getElementById('week-nav-container');
  weekNavContainer.innerHTML = '';
  weekNavContainer.appendChild(nav);

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
    const categoryCounts = {};
    const dayCells = [];

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
          categoryCounts[assignment.category] = (categoryCounts[assignment.category] || 0) + 1;
        }

        const noteKey = emp.id + '_' + w + '_' + d;
        if (cellNotes[noteKey]) {
          td.classList.add('has-note');
          const noteTooltip = document.createElement('div');
          noteTooltip.className = 'note-tooltip';
          noteTooltip.textContent = cellNotes[noteKey].note;
          td.appendChild(noteTooltip);
        }

        td.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          handleDragStart(td, emp.id, w, d);
        });
        td.addEventListener('mouseenter', () => handleDragEnter(td, emp.id, w, d));
        td.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          openNoteModal(emp.id, w, d, emp.name);
        });

        dayCells.push(td);
        row.appendChild(td);
      }
    });

    for (let i = 0; i < dayCells.length; i++) {
      if (!dayCells[i].classList.contains('active')) continue;
      const prev = i > 0 && dayCells[i - 1].classList.contains('active');
      const next = i < dayCells.length - 1 && dayCells[i + 1].classList.contains('active');
      if (!prev && !next) dayCells[i].classList.add('cluster-single');
      else if (!prev) dayCells[i].classList.add('cluster-start');
      else if (!next) dayCells[i].classList.add('cluster-end');
    }

    const totalCell = document.createElement('td');
    totalCell.className = 'col-total emp-total';
    totalCell.textContent = totalDays;
    if (totalDays > 0) {
      totalCell.classList.add('has-tooltip');
      const tooltip = document.createElement('div');
      tooltip.className = 'emp-tooltip';
      Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
          const row = document.createElement('div');
          row.className = 'emp-tooltip-row';
          const dot = document.createElement('span');
          dot.className = 'emp-tooltip-dot';
          dot.style.background = COLORS[parseInt(cat)].bg;
          const text = document.createElement('span');
          text.textContent = `${count} ${count === 1 ? 'dag' : 'dagar'} ${getLeaveTypeName(parseInt(cat))}`;
          row.appendChild(dot);
          row.appendChild(text);
          tooltip.appendChild(row);
        });
      totalCell.appendChild(tooltip);
    }
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

document.addEventListener('keydown', (e) => {
  if (!vacationPeriod || viewSpan === null) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const startW = vacationPeriod.start_week;
  const endW = vacationPeriod.end_week;
  if (e.key === 'ArrowLeft' && viewStart > startW) {
    viewStart = Math.max(startW, viewStart - viewSpan);
    renderGrid();
  } else if (e.key === 'ArrowRight' && viewStart + viewSpan - 1 < endW) {
    viewStart = Math.min(endW - viewSpan + 1, viewStart + viewSpan);
    renderGrid();
  }
});

// Export to Excel
function exportToExcel() {
  if (!vacationPeriod || employees.length === 0) return;
  const startW = vacationPeriod.start_week;
  const endW = vacationPeriod.end_week;
  const weeks = [];
  for (let w = startW; w <= endW; w++) weeks.push(w);

  const header1 = ['Anställd'];
  const header2 = [''];
  weeks.forEach(w => {
    DAY_NAMES.forEach((d, i) => {
      header1.push(i === 0 ? 'V' + w : '');
      header2.push(d);
    });
  });
  header1.push('Dagar');
  header2.push('');

  const rows = [header1, header2];
  employees.forEach(emp => {
    const row = [emp.name];
    let total = 0;
    weeks.forEach(w => {
      for (let d = 1; d <= 7; d++) {
        const key = emp.id + '_' + w + '_' + d;
        const a = assignments[key];
        if (a) {
          row.push(getLeaveTypeName(a.category));
          total++;
        } else {
          row.push('');
        }
      }
    });
    row.push(total);
    rows.push(row);
  });

  const summaryRow = ['Antal lediga'];
  weeks.forEach(w => {
    for (let d = 1; d <= 7; d++) {
      let count = 0;
      employees.forEach(emp => {
        if (assignments[emp.id + '_' + w + '_' + d]) count++;
      });
      summaryRow.push(count || '');
    }
  });
  summaryRow.push('');
  rows.push(summaryRow);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const merges = [];
  weeks.forEach((w, i) => {
    const col = 1 + i * 7;
    merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + 6 } });
  });
  ws['!merges'] = merges;

  const wb = XLSX.utils.book_new();
  const groupName = groups.find(g => g.id === currentGroupId)?.name || 'Schema';
  XLSX.utils.book_append_sheet(wb, ws, groupName);
  XLSX.writeFile(wb, `Semesterplanering_${groupName}_${currentYear}.xlsx`);
}

const exportMenu = document.getElementById('export-menu');
const exportExcelBtn = document.getElementById('export-excel');
const exportPdfBtn = document.getElementById('export-pdf');

exportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  exportMenu.classList.toggle('open');
});
document.addEventListener('click', () => exportMenu.classList.remove('open'));

exportExcelBtn.addEventListener('click', () => {
  exportMenu.classList.remove('open');
  exportToExcel();
});

exportPdfBtn.addEventListener('click', () => {
  exportMenu.classList.remove('open');
  const groupName = groups.find(g => g.id === currentGroupId)?.name || '';
  const subtitle = document.getElementById('print-subtitle');
  subtitle.textContent = groupName + ' — V' + vacationPeriod.start_week + '–V' + vacationPeriod.end_week + ' ' + currentYear;

  const legend = document.getElementById('print-legend');
  legend.innerHTML = '';
  const usedCategories = new Set();
  Object.values(assignments).forEach(a => usedCategories.add(a.category));
  usedCategories.forEach(cat => {
    const item = document.createElement('span');
    item.className = 'print-legend-item';
    item.innerHTML = '<span class="print-legend-dot" style="background:' + COLORS[cat].bg + '"></span>' + getLeaveTypeName(cat);
    legend.appendChild(item);
  });

  document.getElementById('print-date').textContent = 'Utskriven ' + new Date().toLocaleDateString('sv-SE');
  window.print();
});

// Dashboard
function renderDashboard() {
  dashboardChart.innerHTML = '';
  if (!vacationPeriod || employees.length === 0) {
    dashboardChart.innerHTML = '<p class="grid-empty">Ingen data att visa.</p>';
    return;
  }
  const startW = vacationPeriod.start_week;
  const endW = vacationPeriod.end_week;
  const maxCount = employees.length;

  for (let w = startW; w <= endW; w++) {
    const section = document.createElement('div');
    section.className = 'dashboard-week';
    const label = document.createElement('div');
    label.className = 'dashboard-week-label';
    label.textContent = 'Vecka ' + w;
    section.appendChild(label);

    for (let d = 1; d <= 5; d++) {
      let count = 0;
      employees.forEach(emp => {
        if (assignments[emp.id + '_' + w + '_' + d]) count++;
      });
      const row = document.createElement('div');
      row.className = 'dashboard-bar-row';

      const dayLabel = document.createElement('span');
      dayLabel.className = 'dashboard-bar-label';
      dayLabel.textContent = DAY_NAMES[d - 1];
      row.appendChild(dayLabel);

      const track = document.createElement('div');
      track.className = 'dashboard-bar-track';
      const fill = document.createElement('div');
      fill.className = 'dashboard-bar-fill';
      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
      fill.style.width = pct + '%';
      fill.style.background = pct > 60 ? '#f5a8a8' : pct > 30 ? '#f5dfa1' : '#b6e2c8';
      if (count > 0) {
        const countSpan = document.createElement('span');
        countSpan.className = 'dashboard-bar-count';
        countSpan.textContent = count;
        fill.appendChild(countSpan);
      }
      track.appendChild(fill);
      row.appendChild(track);

      section.appendChild(row);
    }
    dashboardChart.appendChild(section);
  }
}

dashboardBtn.addEventListener('click', () => {
  renderDashboard();
  dashboardOverlay.classList.remove('hidden');
});
closeDashboard.addEventListener('click', () => dashboardOverlay.classList.add('hidden'));
dashboardOverlay.addEventListener('click', (e) => {
  if (e.target === dashboardOverlay) dashboardOverlay.classList.add('hidden');
});

// Cell notes
async function loadNotes() {
  if (employees.length === 0) { cellNotes = {}; return; }
  const employeeIds = employees.map(e => e.id);
  const { data, error } = await db
    .from('cell_notes')
    .select('*')
    .in('employee_id', employeeIds)
    .eq('year', currentYear);

  cellNotes = {};
  if (!error && data) {
    data.forEach(n => {
      cellNotes[n.employee_id + '_' + n.week_number + '_' + n.day_number] = { id: n.id, note: n.note };
    });
  }
}

function openNoteModal(employeeId, week, day, empName) {
  currentNoteKey = { employeeId, week, day };
  const key = employeeId + '_' + week + '_' + day;
  const existing = cellNotes[key];
  noteText.value = existing ? existing.note : '';
  noteModalTitle.textContent = empName + ' — V' + week + ' ' + DAY_NAMES[day - 1];
  deleteNoteBtn.style.display = existing ? '' : 'none';
  noteModal.classList.remove('hidden');
  noteText.focus();
}

async function saveNote() {
  if (!currentNoteKey) return;
  const { employeeId, week, day } = currentNoteKey;
  const key = employeeId + '_' + week + '_' + day;
  const text = noteText.value.trim();

  if (!text) {
    await deleteNote();
    return;
  }

  if (cellNotes[key]) {
    await db.from('cell_notes').update({ note: text }).eq('id', cellNotes[key].id);
    cellNotes[key].note = text;
  } else {
    const { data, error } = await db
      .from('cell_notes')
      .insert({
        employee_id: employeeId,
        year: currentYear,
        week_number: week,
        day_number: day,
        note: text
      })
      .select()
      .single();
    if (!error) cellNotes[key] = { id: data.id, note: data.note };
  }

  noteModal.classList.add('hidden');
  renderGrid();
}

async function deleteNote() {
  if (!currentNoteKey) return;
  const { employeeId, week, day } = currentNoteKey;
  const key = employeeId + '_' + week + '_' + day;
  if (cellNotes[key]) {
    await db.from('cell_notes').delete().eq('id', cellNotes[key].id);
    delete cellNotes[key];
  }
  noteModal.classList.add('hidden');
  renderGrid();
}

saveNoteBtn.addEventListener('click', saveNote);
deleteNoteBtn.addEventListener('click', deleteNote);
closeNote.addEventListener('click', () => noteModal.classList.add('hidden'));
noteModal.addEventListener('click', (e) => {
  if (e.target === noteModal) noteModal.classList.add('hidden');
});
noteText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(); }
  if (e.key === 'Escape') noteModal.classList.add('hidden');
});

// Activity log
const logOverlay = document.getElementById('log-overlay');
const logBtn = document.getElementById('log-btn');
const closeLog = document.getElementById('close-log');
const logList = document.getElementById('log-list');

logBtn.addEventListener('click', () => {
  logOverlay.classList.remove('hidden');
  loadActivityLog();
});
closeLog.addEventListener('click', () => logOverlay.classList.add('hidden'));
logOverlay.addEventListener('click', (e) => {
  if (e.target === logOverlay) logOverlay.classList.add('hidden');
});

async function loadActivityLog() {
  logList.innerHTML = '<p style="color:var(--color-text-muted)">Laddar...</p>';
  const { data, error } = await db
    .from('activity_log')
    .select('*')
    .eq('group_id', currentGroupId)
    .eq('year', currentYear)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) {
    logList.innerHTML = '<p style="color:var(--color-text-muted)">Kunde inte ladda loggen.</p>';
    return;
  }
  if (data.length === 0) {
    logList.innerHTML = '<p style="color:var(--color-text-muted)">Inga ändringar ännu.</p>';
    return;
  }

  logList.innerHTML = '';
  data.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'log-item';
    const time = new Date(entry.created_at);
    const timeStr = time.toLocaleDateString('sv-SE') + ' ' + time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    item.innerHTML = '<span class="log-time">' + timeStr + '</span><span class="log-desc">' + entry.description + '</span>';
    logList.appendChild(item);
  });
}

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
  await loadNotes();
  renderGrid();
}
