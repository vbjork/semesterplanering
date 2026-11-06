// ISO weeks and Swedish red days. Shared by the planning grid and the request page.

const SV_MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const SV_MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const SV_WEEKDAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];

const redDayCache = new Map();

function isoWeekDate(year, week, dayNumber) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = Date.UTC(year, 0, 4 - jan4Dow + 1);
  return new Date(week1Monday + ((week - 1) * 7 + (dayNumber - 1)) * 86400000);
}

function addDaysUTC(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function dateKey(date) {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return date.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
}

function easterSundayUTC(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function saturdayBetween(year, monthIndex, startDay, endDay) {
  for (let day = startDay; day <= endDay; day++) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    if (date.getUTCDay() === 6) return date;
  }
  return null;
}

function redDaysForYear(year) {
  if (redDayCache.has(year)) return redDayCache.get(year);
  const map = new Map();
  const add = (date, name) => map.set(dateKey(date), name);
  const easter = easterSundayUTC(year);
  const midsummer = saturdayBetween(year, 5, 20, 26);

  add(new Date(Date.UTC(year, 0, 1)), 'Nyårsdagen');
  add(new Date(Date.UTC(year, 0, 6)), 'Trettondedag jul');
  add(addDaysUTC(easter, -2), 'Långfredagen');
  add(easter, 'Påskdagen');
  add(addDaysUTC(easter, 1), 'Annandag påsk');
  add(new Date(Date.UTC(year, 4, 1)), 'Första maj');
  add(addDaysUTC(easter, 39), 'Kristi himmelsfärdsdag');
  add(addDaysUTC(easter, 49), 'Pingstdagen');
  add(new Date(Date.UTC(year, 5, 6)), 'Sveriges nationaldag');
  add(addDaysUTC(midsummer, -1), 'Midsommarafton');
  add(midsummer, 'Midsommardagen');
  add(saturdayBetween(year, 9, 31, 37), 'Alla helgons dag');
  add(new Date(Date.UTC(year, 11, 24)), 'Julafton');
  add(new Date(Date.UTC(year, 11, 25)), 'Juldagen');
  add(new Date(Date.UTC(year, 11, 26)), 'Annandag jul');
  add(new Date(Date.UTC(year, 11, 31)), 'Nyårsafton');

  redDayCache.set(year, map);
  return map;
}

function redDayName(date) {
  return redDaysForYear(date.getUTCFullYear()).get(dateKey(date)) || null;
}

function formatSwedishLongDate(date) {
  const weekday = SV_WEEKDAYS[(date.getUTCDay() + 6) % 7];
  return weekday + ' ' + date.getUTCDate() + ' ' + SV_MONTHS[date.getUTCMonth()] + ' ' + date.getUTCFullYear();
}

function dayColumnInfo(year, week, dayNumber) {
  const date = isoWeekDate(year, week, dayNumber);
  const redName = redDayName(date);
  const longDate = formatSwedishLongDate(date);
  return {
    date: date,
    day: date.getUTCDate(),
    dateLabel: String(date.getUTCDate()),
    redName: redName,
    title: redName ? longDate + ' — ' + redName : longDate
  };
}

function weekRangeLabel(year, week) {
  const start = isoWeekDate(year, week, 1);
  const end = isoWeekDate(year, week, 7);
  const startMonth = SV_MONTHS_SHORT[start.getUTCMonth()];
  const endMonth = SV_MONTHS_SHORT[end.getUTCMonth()];
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return start.getUTCDate() + '–' + end.getUTCDate() + ' ' + startMonth;
  }
  return start.getUTCDate() + ' ' + startMonth + '–' + end.getUTCDate() + ' ' + endMonth;
}

function fillDayHeader(th, weekdayLetter, info) {
  th.className = 'col-day' + (info.redName ? ' red-day' : '');
  th.title = info.title;
  const nameEl = document.createElement('span');
  nameEl.className = 'col-day-name';
  nameEl.textContent = weekdayLetter;
  const dateEl = document.createElement('span');
  dateEl.className = 'col-day-num';
  dateEl.textContent = info.dateLabel;
  th.appendChild(nameEl);
  th.appendChild(dateEl);
}

function markRedDayCell(td, info) {
  if (!info.redName) return;
  td.classList.add('red-day');
  td.title = td.title ? td.title + ' — ' + info.redName : info.redName;
}

function redDayFillVisible(td) {
  if (!td || !td.classList.contains('red-day')) return false;
  return !td.classList.contains('active')
    && !td.classList.contains('pending-request')
    && !td.classList.contains('rejected-request')
    && !td.classList.contains('request-pending');
}

function applyRedDayClusters(dayCells) {
  for (let i = 0; i < dayCells.length; i++) {
    if (!redDayFillVisible(dayCells[i])) continue;
    const prev = redDayFillVisible(dayCells[i - 1]);
    const next = redDayFillVisible(dayCells[i + 1]);
    if (!prev && !next) dayCells[i].classList.add('red-cluster-single');
    else if (!prev) dayCells[i].classList.add('red-cluster-start');
    else if (!next) dayCells[i].classList.add('red-cluster-end');
  }
}
