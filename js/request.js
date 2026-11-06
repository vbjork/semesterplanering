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
let period = null;
let selected = new Set();
let submitting = false;

const reqGrid = document.getElementById('req-grid');
const reqError = document.getElementById('req-error');
const reqStatus = document.getElementById('req-status');

function getLeaveTypeName(index) {
  return leaveTypes[index] || COLORS[index].default;
}

function showError(msg) {
  document.querySelector('.req-header').style.display = 'none';
  document.querySelector('.req-body').style.display = 'none';
  document.getElementById('req-submit-bar').style.display = 'none';
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

  const { data: periodRows } = await db.rpc('get_vacation_period_by_token', { p_token: token, p_year: currentYear });
  period = (periodRows && periodRows[0]) || null;

  for (const key of [...selected]) {
    if (schedule[key] !== undefined || requests[key]) selected.delete(key);
  }
}

function dayKey(week, day) {
  return week + '_' + day;
}

function updateSubmitBar() {
  const bar = document.getElementById('req-submit-bar');
  const btn = document.getElementById('req-submit-btn');
  const count = document.getElementById('req-submit-count');
  if (!period) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const n = selected.size;
  btn.disabled = n === 0 || submitting;
  btn.textContent = submitting ? 'Skickar…' : 'Skicka ansökan';
  count.textContent = n === 0 ? 'Inga dagar valda' : (n === 1 ? '1 dag vald' : n + ' dagar valda');
}

function toggleDay(week, day) {
  const key = dayKey(week, day);
  if (selected.has(key)) selected.delete(key);
  else selected.add(key);
  renderGrid();
}

function renderGrid() {
  reqGrid.innerHTML = '';

  if (!period) {
    reqGrid.innerHTML = '<p class="req-msg">Ingen semesterperiod har ställts in ännu.</p>';
    updateSubmitBar();
    return;
  }

  const weeks = [];
  for (let w = period.start_week; w <= period.end_week; w++) weeks.push(w);

  const list = document.createElement('div');
  list.className = 'req-weeks';

  weeks.forEach(w => {
    const section = document.createElement('section');
    section.className = 'req-week';

    const head = document.createElement('div');
    head.className = 'req-week-head';
    const weekName = document.createElement('span');
    weekName.textContent = 'Vecka ' + w;
    const weekDates = document.createElement('span');
    weekDates.className = 'req-week-dates';
    weekDates.textContent = weekRangeLabel(currentYear, w);
    head.appendChild(weekName);
    head.appendChild(weekDates);
    section.appendChild(head);

    const days = document.createElement('div');
    days.className = 'req-days';

    for (let d = 1; d <= 7; d++) {
      const key = dayKey(w, d);
      const info = dayColumnInfo(currentYear, w, d);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'req-day';
      if (d >= 6) btn.classList.add('weekend');
      if (info.redName) btn.classList.add('red-day');

      const nameEl = document.createElement('span');
      nameEl.className = 'req-day-name';
      nameEl.textContent = DAY_NAMES[d - 1];
      const numEl = document.createElement('span');
      numEl.className = 'req-day-num';
      numEl.textContent = info.dateLabel;
      btn.appendChild(nameEl);
      btn.appendChild(numEl);

      const lockedApproved = schedule[key] !== undefined || requests[key] === 'approved';
      if (lockedApproved) {
        const category = schedule[key] !== undefined ? schedule[key] : 0;
        btn.classList.add('approved');
        btn.style.background = COLORS[category].bg;
        btn.disabled = true;
        btn.title = getLeaveTypeName(category) + ' (godkänd)';
      } else if (requests[key] === 'pending') {
        btn.classList.add('pending');
        btn.title = 'Din ansökan väntar — tryck för att ta bort';
        btn.addEventListener('click', () => cancelRequest(w, d));
      } else if (selected.has(key)) {
        btn.classList.add('selected');
        btn.setAttribute('aria-pressed', 'true');
        btn.title = info.redName ? info.title + ' — vald' : 'Vald, inte skickad';
        btn.addEventListener('click', () => toggleDay(w, d));
      } else {
        btn.setAttribute('aria-pressed', 'false');
        btn.title = info.redName ? info.title : 'Markera dag';
        btn.addEventListener('click', () => toggleDay(w, d));
      }

      days.appendChild(btn);
    }

    section.appendChild(days);
    list.appendChild(section);
  });

  reqGrid.appendChild(list);
  updateSubmitBar();
}

async function submitSelected() {
  if (selected.size === 0 || submitting) return;
  submitting = true;
  updateSubmitBar();
  const days = [...selected];
  for (const key of days) {
    const [week, day] = key.split('_').map(Number);
    const { error } = await db.rpc('submit_vacation_request', {
      p_token: token, p_year: currentYear, p_week: week, p_day: day, p_category: 0
    });
    if (error) {
      submitting = false;
      showStatus('Kunde inte skicka ansökan: ' + error.message, 'error');
      await loadData();
      renderGrid();
      return;
    }
    selected.delete(key);
  }
  submitting = false;
  const n = days.length;
  showStatus(n === 1 ? 'Ansökan skickad för 1 dag' : 'Ansökan skickad för ' + n + ' dagar', 'success');
  await loadData();
  renderGrid();
}

async function cancelRequest(week, day) {
  const when = 'vecka ' + week + ' ' + ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'][day - 1];
  const ok = await askConfirm('Ta bort den skickade ansökan för ' + employee.name + ', ' + when + '?');
  if (!ok) return;
  await db.rpc('cancel_vacation_request', {
    p_token: token, p_year: currentYear, p_week: week, p_day: day
  });
  delete requests[week + '_' + day];
  showStatus('Ansökan borttagen för V' + week + ' ' + DAY_NAMES[day - 1], 'success');
  await loadData();
  renderGrid();
}

document.getElementById('req-submit-btn').addEventListener('click', submitSelected);

init();
