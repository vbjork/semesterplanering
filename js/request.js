const COLORS = [
  { bg: '#b6e2c8', default: 'Semester' },
  { bg: '#bbc5f5', default: 'Föräldraledig' },
  { bg: '#f5c4a1', default: 'VAB' },
  { bg: '#f5dfa1', default: 'Tjänstledig' },
  { bg: '#f5b0c5', default: 'Sjuk' },
  { bg: '#a1ddd5', default: 'Utbildning' },
  { bg: '#f5d4a8', default: 'Kompledigt' },
  { bg: '#e2b5f5', default: 'Permission' },
  { bg: '#f5a8a8', default: 'Annat 1' },
  { bg: '#c8ced8', default: 'Annat 2' },
];

const DAY_NAMES = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];

const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const currentYear = new Date().getFullYear();

let employee = null;
let schedule = {};
let requests = {};
let leaveTypes = {};

const reqGrid = document.getElementById('req-grid');
const reqError = document.getElementById('req-error');
const reqStatus = document.getElementById('req-status');

function getLeaveTypeName(index) {
  return leaveTypes[index] || COLORS[index].default;
}

function showError(msg) {
  document.querySelector('.req-header').style.display = 'none';
  document.querySelector('.req-body').style.display = 'none';
  reqError.style.display = 'block';
  reqError.textContent = msg;
}

function showStatus(msg, type) {
  reqStatus.textContent = msg;
  reqStatus.className = 'req-status ' + type;
  setTimeout(() => { reqStatus.className = 'req-status'; }, 3000);
}

async function init() {
  if (!token) { showError('Ogiltig länk — ingen token angiven.'); return; }

  const { data: emp } = await db.rpc('get_employee_by_token', { p_token: token });
  if (!emp || emp.length === 0) { showError('Ogiltig länk — anställd hittades inte.'); return; }
  employee = emp[0];
  document.getElementById('req-emp-name').textContent = employee.name;

  const { data: lt } = await db.rpc('get_leave_types_by_token', { p_token: token });
  if (lt) lt.forEach(l => { leaveTypes[l.color_index] = l.name; });

  await loadData();
  renderGrid();
}

async function loadData() {
  const { data: sched } = await db.rpc('get_employee_schedule', { p_token: token, p_year: currentYear });
  schedule = {};
  if (sched) sched.forEach(s => { schedule[s.week_number + '_' + s.day_number] = s.category; });

  const { data: reqs } = await db.rpc('get_employee_requests', { p_token: token, p_year: currentYear });
  requests = {};
  if (reqs) reqs.forEach(r => { requests[r.week_number + '_' + r.day_number] = r.status; });
}

async function renderGrid() {
  reqGrid.innerHTML = '';

  const { data: period } = await db.rpc('get_vacation_period_by_token', { p_token: token, p_year: currentYear });
  if (!period || period.length === 0) {
    reqGrid.innerHTML = '<p class="req-msg">Ingen semesterperiod har ställts in ännu.</p>';
    return;
  }

  const startW = period[0].start_week;
  const endW = period[0].end_week;
  const weeks = [];
  for (let w = startW; w <= endW; w++) weeks.push(w);

  const table = document.createElement('table');
  table.className = 'vacation-table';

  const thead = document.createElement('thead');
  const weekRow = document.createElement('tr');
  const nameHeader = document.createElement('th');
  nameHeader.className = 'col-name';
  nameHeader.textContent = employee.name;
  nameHeader.rowSpan = 2;
  weekRow.appendChild(nameHeader);

  weeks.forEach(w => {
    const th = document.createElement('th');
    th.className = 'col-week-group';
    th.colSpan = 7;
    th.textContent = 'V' + w;
    weekRow.appendChild(th);
  });
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
  const row = document.createElement('tr');
  const nameCell = document.createElement('td');
  nameCell.className = 'col-name';
  nameCell.textContent = employee.name;
  row.appendChild(nameCell);

  weeks.forEach(w => {
    for (let d = 1; d <= 7; d++) {
      const td = document.createElement('td');
      td.className = 'day-cell';
      if (d === 6 || d === 7) td.classList.add('weekend');

      const key = w + '_' + d;

      if (schedule[key] !== undefined) {
        td.classList.add('active');
        td.style.background = COLORS[schedule[key]].bg;
        td.title = getLeaveTypeName(schedule[key]) + ' (godkänd)';
      } else if (requests[key] === 'pending') {
        td.classList.add('request-pending');
        td.title = 'Din ansökan (väntande)';
        td.addEventListener('click', () => cancelRequest(w, d));
      } else if (requests[key] === 'approved') {
        td.classList.add('active', 'request-approved');
        td.style.background = COLORS[0].bg;
        td.title = 'Godkänd';
      } else {
        td.addEventListener('click', () => submitRequest(w, d));
      }

      row.appendChild(td);
    }
  });

  tbody.appendChild(row);
  table.appendChild(tbody);
  reqGrid.appendChild(table);
}

async function submitRequest(week, day) {
  await db.rpc('submit_vacation_request', {
    p_token: token, p_year: currentYear, p_week: week, p_day: day, p_category: 0
  });
  requests[week + '_' + day] = 'pending';
  showStatus('Ansökan skickad för V' + week + ' ' + DAY_NAMES[day - 1], 'success');
  renderGrid();
}

async function cancelRequest(week, day) {
  await db.rpc('cancel_vacation_request', {
    p_token: token, p_year: currentYear, p_week: week, p_day: day
  });
  delete requests[week + '_' + day];
  showStatus('Ansökan borttagen för V' + week + ' ' + DAY_NAMES[day - 1], 'success');
  renderGrid();
}

init();
