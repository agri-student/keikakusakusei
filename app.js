// ========================================
// 状態管理
// ========================================
const state = {
  clubs: [],            // { id, name, color }
  schoolEvents: [],     // { id, name, startDate, endDate, gymClosed }
  examPeriods: [],      // { start, end }
  clubOffDays: {},      // { clubId: [weekday numbers] }
  clubOffDates: {},     // { clubId: [{ date, reason }] }
  tournaments: [],      // { clubId, date, name, priorityDays }
  useSaturday: true,
  useSunday: false,
  useHoliday: false,
  targetMonth: '',
  schedule: {},         // { 'YYYY-MM-DD': { clubId: true/false, ... } }
};

// 日本の祝日（2025-2027年の主な祝日）
const HOLIDAYS = [
  '2025-01-01','2025-01-13','2025-02-11','2025-02-23','2025-02-24',
  '2025-03-20','2025-04-29','2025-05-03','2025-05-04','2025-05-05',
  '2025-05-06','2025-07-21','2025-08-11','2025-09-15','2025-09-23',
  '2025-10-13','2025-11-03','2025-11-23','2025-11-24','2025-12-23',
  '2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20',
  '2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-05-06',
  '2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23',
  '2026-10-12','2026-11-03','2026-11-23','2026-12-23',
  '2027-01-01','2027-01-11','2027-02-11','2027-02-23','2027-03-21',
  '2027-04-29','2027-05-03','2027-05-04','2027-05-05','2027-07-19',
  '2027-08-11','2027-09-20','2027-09-23','2027-10-11','2027-11-03',
  '2027-11-23','2027-12-23',
];

let nextClubId = 1;
let nextEventId = 1;

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTabs();
  initClubManagement();
  initEvents();
  initConditions();
  initSchedule();
  renderAll();
});

// ========================================
// LocalStorage 永続化
// ========================================
function saveState() {
  localStorage.setItem('gymScheduleState', JSON.stringify(state));
  localStorage.setItem('gymScheduleNextId', nextClubId.toString());
  localStorage.setItem('gymScheduleNextEventId', nextEventId.toString());
}

function loadState() {
  const saved = localStorage.getItem('gymScheduleState');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
    // 旧データ互換: schoolEvents がない場合
    if (!state.schoolEvents) state.schoolEvents = [];
  }
  const savedId = localStorage.getItem('gymScheduleNextId');
  if (savedId) nextClubId = parseInt(savedId, 10);
  const savedEventId = localStorage.getItem('gymScheduleNextEventId');
  if (savedEventId) nextEventId = parseInt(savedEventId, 10);
  if (!state.targetMonth) {
    const now = new Date();
    state.targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

// ========================================
// タブ切り替え
// ========================================
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

// ========================================
// 部活動管理
// ========================================
function initClubManagement() {
  document.getElementById('add-club-btn').addEventListener('click', addClub);
  document.getElementById('club-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') addClub();
  });
}

function addClub() {
  const nameInput = document.getElementById('club-name');
  const colorInput = document.getElementById('club-color');
  const name = nameInput.value.trim();
  if (!name) return;
  state.clubs.push({ id: nextClubId++, name, color: colorInput.value });
  nameInput.value = '';
  saveState();
  renderAll();
}

function removeClub(id) {
  if (!confirm('この部活動を削除しますか？')) return;
  state.clubs = state.clubs.filter(c => c.id !== id);
  delete state.clubOffDays[id];
  delete state.clubOffDates[id];
  state.tournaments = state.tournaments.filter(t => t.clubId !== id);
  for (const date in state.schedule) {
    if (state.schedule[date]) delete state.schedule[date][id];
  }
  saveState();
  renderAll();
}

function renderClubsTable() {
  const tbody = document.getElementById('clubs-tbody');
  tbody.innerHTML = '';
  state.clubs.forEach(club => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span style="display:inline-block;width:24px;height:24px;background:${club.color};border-radius:4px;"></span></td>
      <td>${escapeHtml(club.name)}</td>
      <td><button class="btn btn-danger" data-remove-club="${club.id}">削除</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-remove-club]').forEach(btn => {
    btn.addEventListener('click', () => removeClub(parseInt(btn.dataset.removeClub, 10)));
  });
}

// ========================================
// 学校行事管理
// ========================================
function initEvents() {
  document.getElementById('add-event-btn').addEventListener('click', addEvent);
}

function addEvent() {
  const startInput = document.getElementById('event-start');
  const endInput = document.getElementById('event-end');
  const nameInput = document.getElementById('event-name');
  const gymClosedInput = document.getElementById('event-gym-closed');

  const startDate = startInput.value;
  const name = nameInput.value.trim();
  if (!startDate || !name) { alert('開始日と行事名を入力してください。'); return; }

  const endDate = endInput.value || startDate;
  if (endDate < startDate) { alert('終了日は開始日以降にしてください。'); return; }

  state.schoolEvents.push({
    id: nextEventId++,
    name,
    startDate,
    endDate,
    gymClosed: gymClosedInput.checked
  });

  startInput.value = '';
  endInput.value = '';
  nameInput.value = '';
  gymClosedInput.checked = false;
  saveState();
  renderEventsTable();
}

function removeEvent(id) {
  state.schoolEvents = state.schoolEvents.filter(e => e.id !== id);
  saveState();
  renderEventsTable();
}

function renderEventsTable() {
  const tbody = document.getElementById('events-tbody');
  tbody.innerHTML = '';
  // 日付順にソート
  const sorted = [...state.schoolEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));
  sorted.forEach(ev => {
    const tr = document.createElement('tr');
    const isMulti = ev.startDate !== ev.endDate;
    const dateStr = isMulti ? `${ev.startDate} 〜 ${ev.endDate}` : ev.startDate;
    const multiBadge = isMulti ? '<span class="badge badge-multi">複数日</span>' : '';
    const gymBadge = ev.gymClosed
      ? '<span class="badge badge-closed">使用不可</span>'
      : '<span class="badge badge-open">使用可</span>';
    tr.innerHTML = `
      <td>${dateStr}${multiBadge}</td>
      <td>${escapeHtml(ev.name)}</td>
      <td>${gymBadge}</td>
      <td><button class="btn btn-danger" data-remove-event="${ev.id}">削除</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-remove-event]').forEach(btn => {
    btn.addEventListener('click', () => removeEvent(parseInt(btn.dataset.removeEvent, 10)));
  });
}

// ========================================
// 条件設定
// ========================================
function initConditions() {
  document.getElementById('target-month').addEventListener('change', e => {
    state.targetMonth = e.target.value;
    saveState();
  });

  document.getElementById('add-exam-btn').addEventListener('click', addExamPeriod);
  document.getElementById('save-weekday-btn').addEventListener('click', saveWeekdayOff);
  document.getElementById('add-club-off-date-btn').addEventListener('click', addClubOffDate);
  document.getElementById('add-tournament-btn').addEventListener('click', addTournament);

  document.getElementById('use-saturday').addEventListener('change', e => {
    state.useSaturday = e.target.checked; saveState();
  });
  document.getElementById('use-sunday').addEventListener('change', e => {
    state.useSunday = e.target.checked; saveState();
  });
  document.getElementById('use-holiday').addEventListener('change', e => {
    state.useHoliday = e.target.checked; saveState();
  });
  document.getElementById('club-off-select').addEventListener('change', loadWeekdayChecks);
}

function addExamPeriod() {
  const start = document.getElementById('exam-start').value;
  const end = document.getElementById('exam-end').value;
  if (!start || !end) return;
  if (start > end) { alert('開始日は終了日より前にしてください。'); return; }
  state.examPeriods.push({ start, end });
  document.getElementById('exam-start').value = '';
  document.getElementById('exam-end').value = '';
  saveState();
  renderExamList();
}

function renderExamList() {
  const ul = document.getElementById('exam-list');
  ul.innerHTML = '';
  state.examPeriods.forEach((item, i) => {
    const li = document.createElement('li');
    li.innerHTML = `${item.start} 〜 ${item.end} <button class="btn btn-danger" data-idx="${i}">削除</button>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.btn-danger').forEach(btn => {
    btn.addEventListener('click', () => {
      state.examPeriods.splice(parseInt(btn.dataset.idx, 10), 1);
      saveState();
      renderExamList();
    });
  });
}

function populateClubSelects() {
  const selects = [
    document.getElementById('club-off-select'),
    document.getElementById('club-off-date-select'),
    document.getElementById('tournament-club-select'),
  ];
  selects.forEach(sel => {
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- 部活動を選択 --</option>';
    state.clubs.forEach(club => {
      const opt = document.createElement('option');
      opt.value = club.id;
      opt.textContent = club.name;
      sel.appendChild(opt);
    });
    if (currentVal) sel.value = currentVal;
  });
}

function loadWeekdayChecks() {
  const clubId = document.getElementById('club-off-select').value;
  const checks = document.querySelectorAll('#weekday-checks input[type="checkbox"]');
  const offDays = state.clubOffDays[clubId] || [];
  checks.forEach(cb => {
    cb.checked = offDays.includes(parseInt(cb.value, 10));
  });
}

function saveWeekdayOff() {
  const clubId = document.getElementById('club-off-select').value;
  if (!clubId) { alert('部活動を選択してください。'); return; }
  const checks = document.querySelectorAll('#weekday-checks input[type="checkbox"]');
  const offDays = [];
  checks.forEach(cb => {
    if (cb.checked) offDays.push(parseInt(cb.value, 10));
  });
  state.clubOffDays[clubId] = offDays;
  saveState();
  renderClubOffSummary();
  alert('保存しました。');
}

function renderClubOffSummary() {
  const container = document.getElementById('club-off-summary');
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  let html = '';
  state.clubs.forEach(club => {
    const offDays = state.clubOffDays[club.id];
    if (offDays && offDays.length > 0) {
      html += `<div><strong>${escapeHtml(club.name)}</strong>: 毎週 ${offDays.map(d => dayNames[d]).join(', ')} は活動なし</div>`;
    }
  });
  container.innerHTML = html || '<div>設定なし</div>';
}

function addClubOffDate() {
  const clubId = document.getElementById('club-off-date-select').value;
  const date = document.getElementById('club-off-date').value;
  const reason = document.getElementById('club-off-date-reason').value.trim();
  if (!clubId || !date) return;
  if (!state.clubOffDates[clubId]) state.clubOffDates[clubId] = [];
  state.clubOffDates[clubId].push({ date, reason: reason || '活動なし' });
  document.getElementById('club-off-date').value = '';
  document.getElementById('club-off-date-reason').value = '';
  saveState();
  renderClubOffDateList();
}

function renderClubOffDateList() {
  const ul = document.getElementById('club-off-date-list');
  ul.innerHTML = '';
  state.clubs.forEach(club => {
    const dates = state.clubOffDates[club.id] || [];
    dates.forEach((item, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${escapeHtml(club.name)}</strong> ${item.date} - ${escapeHtml(item.reason)} <button class="btn btn-danger" data-club="${club.id}" data-idx="${i}">削除</button>`;
      ul.appendChild(li);
    });
  });
  ul.querySelectorAll('.btn-danger').forEach(btn => {
    btn.addEventListener('click', () => {
      const cid = parseInt(btn.dataset.club, 10);
      state.clubOffDates[cid].splice(parseInt(btn.dataset.idx, 10), 1);
      saveState();
      renderClubOffDateList();
    });
  });
}

function addTournament() {
  const clubId = document.getElementById('tournament-club-select').value;
  const date = document.getElementById('tournament-date').value;
  const name = document.getElementById('tournament-name').value.trim();
  const priorityDays = parseInt(document.getElementById('tournament-priority-days').value, 10);
  if (!clubId || !date) return;
  state.tournaments.push({
    clubId: parseInt(clubId, 10), date, name: name || '大会', priorityDays
  });
  document.getElementById('tournament-date').value = '';
  document.getElementById('tournament-name').value = '';
  saveState();
  renderTournamentList();
}

function renderTournamentList() {
  const ul = document.getElementById('tournament-list');
  ul.innerHTML = '';
  state.tournaments.forEach((item, i) => {
    const club = state.clubs.find(c => c.id === item.clubId);
    const clubName = club ? club.name : '(削除済み)';
    const li = document.createElement('li');
    li.innerHTML = `<strong>${escapeHtml(clubName)}</strong> ${item.date} ${escapeHtml(item.name)} (${item.priorityDays}日前から優先) <button class="btn btn-danger" data-idx="${i}">削除</button>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.btn-danger').forEach(btn => {
    btn.addEventListener('click', () => {
      state.tournaments.splice(parseInt(btn.dataset.idx, 10), 1);
      saveState();
      renderTournamentList();
    });
  });
}

// ========================================
// ヘルパー関数
// ========================================
function getMonthDates(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const dates = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dates;
}

function isHoliday(dateStr) {
  return HOLIDAYS.includes(dateStr);
}

function isDateInExamPeriod(dateStr) {
  return state.examPeriods.some(p => dateStr >= p.start && dateStr <= p.end);
}

function getEventsForDate(dateStr) {
  return state.schoolEvents.filter(ev => dateStr >= ev.startDate && dateStr <= ev.endDate);
}

function isGymClosedByEvent(dateStr) {
  return state.schoolEvents.some(ev => ev.gymClosed && dateStr >= ev.startDate && dateStr <= ev.endDate);
}

function isClubAvailable(clubId, dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay();
  const offDays = state.clubOffDays[clubId] || [];
  if (offDays.includes(dow)) return false;
  const offDates = state.clubOffDates[clubId] || [];
  if (offDates.some(d => d.date === dateStr)) return false;
  if (state.tournaments.some(t => t.clubId === clubId && t.date === dateStr)) return false;
  return true;
}

function isDayAvailable(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay();
  if (isGymClosedByEvent(dateStr)) return false;
  if (isDateInExamPeriod(dateStr)) return false;
  if (dow === 0 && !state.useSunday) return false;
  if (dow === 6 && !state.useSaturday) return false;
  if (isHoliday(dateStr) && !state.useHoliday) return false;
  return true;
}

function getTournamentPriority(clubId, dateStr) {
  let maxPriority = 0;
  state.tournaments.forEach(t => {
    if (t.clubId !== clubId) return;
    const tournamentDate = new Date(t.date + 'T00:00:00');
    const currentDate = new Date(dateStr + 'T00:00:00');
    const diffDays = (tournamentDate - currentDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 0 && diffDays <= t.priorityDays) {
      const priority = 1 + (t.priorityDays - diffDays) / t.priorityDays;
      if (priority > maxPriority) maxPriority = priority;
    }
  });
  return maxPriority;
}

// ========================================
// スケジュール自動生成
// ========================================
function initSchedule() {
  document.getElementById('generate-btn').addEventListener('click', generateSchedule);
  document.getElementById('export-excel-btn').addEventListener('click', exportExcel);
  document.getElementById('export-pdf-btn').addEventListener('click', exportPdf);
}

function generateSchedule() {
  if (state.clubs.length === 0) { alert('部活動を登録してください。'); return; }
  if (!state.targetMonth) { alert('対象月を選択してください。'); return; }

  // 前回のスケジュールを完全にクリア
  state.schedule = {};

  const dates = getMonthDates(state.targetMonth);
  const schedule = {};
  const clubCounts = {};
  state.clubs.forEach(c => { clubCounts[c.id] = 0; });

  const availableDates = dates.filter(d => isDayAvailable(d));

  // 各日の各部活の利用可否を作成
  availableDates.forEach(dateStr => {
    schedule[dateStr] = {};
    state.clubs.forEach(club => {
      schedule[dateStr][club.id] = false;
    });
  });

  // 使用不可日も空で記録
  dates.forEach(d => {
    if (!schedule[d]) {
      schedule[d] = {};
      state.clubs.forEach(club => { schedule[d][club.id] = false; });
    }
  });

  // 割り当てアルゴリズム: 各利用可能日に2つの部活を割り当てる
  const MAX_CLUBS_PER_DAY = 2;

  // 大会前優先度を計算
  const priorityDates = availableDates.filter(d =>
    state.clubs.some(c => getTournamentPriority(c.id, d) > 0)
  );
  const normalDates = availableDates.filter(d =>
    !state.clubs.some(c => getTournamentPriority(c.id, d) > 0)
  );

  // 各日に最大2つの部活を割り当てるヘルパー
  function assignClubsToDate(dateStr, scoreFn) {
    const available = state.clubs.filter(c => isClubAvailable(c.id, dateStr));
    if (available.length === 0) return;

    // スコアにランダム要素を加えて毎回異なる結果にする
    const scored = available.map(club => ({
      club,
      score: scoreFn(club) + Math.random() * 0.5
    }));
    scored.sort((a, b) => b.score - a.score);

    const assignCount = Math.min(MAX_CLUBS_PER_DAY, scored.length);
    for (let i = 0; i < assignCount; i++) {
      schedule[dateStr][scored[i].club.id] = true;
      clubCounts[scored[i].club.id]++;
    }
  }

  // 日付の処理順もシャッフルして偏りを減らす
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 優先日: 大会前の部活を優先割り当て
  shuffle(priorityDates).forEach(dateStr => {
    assignClubsToDate(dateStr, club => {
      const priority = getTournamentPriority(club.id, dateStr);
      const equalityPenalty = clubCounts[club.id] * 0.3;
      return priority * 2 - equalityPenalty;
    });
  });

  // 通常日: 均等配分（使用回数が少ない部活を優先）
  shuffle(normalDates).forEach(dateStr => {
    assignClubsToDate(dateStr, club => {
      return -clubCounts[club.id];
    });
  });

  state.schedule = schedule;
  saveState();
  renderScheduleTable();
  renderStats();
}

// ========================================
// スケジュール表形式表示
// ========================================
function renderScheduleTable() {
  const container = document.getElementById('schedule-container');
  if (!state.targetMonth || Object.keys(state.schedule).length === 0) {
    container.innerHTML = '<p style="color:#888;text-align:center;padding:40px;">スケジュールを生成してください。</p>';
    return;
  }

  const [year, month] = state.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  let html = `<table class="schedule-table">`;
  html += `<caption>${month}月体育館割り当て</caption>`;

  // ヘッダー
  html += '<thead><tr>';
  html += '<th class="col-day">日</th>';
  html += '<th class="col-dow">曜</th>';
  html += '<th class="col-event">行事</th>';
  state.clubs.forEach(club => {
    html += `<th class="col-club">${escapeHtml(club.name)}</th>`;
  });
  html += '</tr></thead><tbody>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();

    // 週の切り替え（日曜始まり）
    const isWeekStart = dow === 0 && d > 1;

    // 行のクラス
    let rowClass = '';
    if (isWeekStart) rowClass += ' week-start';
    if (isDateInExamPeriod(dateStr)) {
      rowClass += ' row-exam';
    } else if (isGymClosedByEvent(dateStr)) {
      rowClass += ' row-closed';
    } else if (dow === 0 || isHoliday(dateStr)) {
      rowClass += ' row-sunday';
    } else if (dow === 6) {
      rowClass += ' row-saturday';
    }

    html += `<tr class="${rowClass}">`;

    // 日
    html += `<td>${d}</td>`;

    // 曜日
    const dowClass = dow === 0 ? 'dow-sun' : dow === 6 ? 'dow-sat' : '';
    const holidayClass = isHoliday(dateStr) ? 'dow-sun' : '';
    html += `<td class="${dowClass || holidayClass}">${dayNames[dow]}</td>`;

    // 行事
    const events = getEventsForDate(dateStr);
    let eventText = '';
    let eventClass = 'event-cell';
    if (events.length > 0) {
      const eventNames = events.map(ev => {
        const isMulti = ev.startDate !== ev.endDate;
        let marker = '';
        if (isMulti) {
          if (dateStr === ev.startDate) marker = 'event-multi-start';
          else if (dateStr === ev.endDate) marker = 'event-multi-end';
          else marker = 'event-multi-mid';
        }
        return { name: ev.name, marker };
      });
      eventText = eventNames.map(e => {
        if (e.marker) return `<span class="${e.marker}">${escapeHtml(e.name)}</span>`;
        return escapeHtml(e.name);
      }).join(', ');
    }
    html += `<td class="${eventClass}">${eventText}</td>`;

    // 各部活の列
    const dayAvailable = isDayAvailable(dateStr);
    state.clubs.forEach(club => {
      if (!dayAvailable) {
        html += `<td class="club-cell disabled"></td>`;
      } else if (!isClubAvailable(club.id, dateStr)) {
        html += `<td class="club-cell unavailable">&times;</td>`;
      } else {
        const assigned = state.schedule[dateStr] && state.schedule[dateStr][club.id];
        const symbol = assigned ? '○' : '';
        const cls = assigned ? 'club-cell assigned' : 'club-cell';
        html += `<td class="${cls}" data-date="${dateStr}" data-club="${club.id}">${symbol}</td>`;
      }
    });

    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;

  // 手動切り替えクリックイベント（1日最大2部活）
  container.querySelectorAll('td.club-cell[data-date]').forEach(td => {
    td.addEventListener('click', () => {
      const dateStr = td.dataset.date;
      const clubId = parseInt(td.dataset.club, 10);
      if (!state.schedule[dateStr]) state.schedule[dateStr] = {};
      state.schedule[dateStr][clubId] = !state.schedule[dateStr][clubId];
      saveState();
      renderScheduleTable();
      renderStats();
    });
  });
}

// ========================================
// 統計表示
// ========================================
function renderStats() {
  const container = document.getElementById('stats-container');
  if (Object.keys(state.schedule).length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const counts = {};
  state.clubs.forEach(c => { counts[c.id] = 0; });
  for (const date in state.schedule) {
    state.clubs.forEach(club => {
      if (state.schedule[date] && state.schedule[date][club.id]) {
        counts[club.id]++;
      }
    });
  }

  let html = '<h3>各部活動の使用回数</h3><div class="stats-grid">';
  state.clubs.forEach(club => {
    html += `<div class="stat-item">
      <span class="stat-color" style="background:${club.color}"></span>
      <span>${escapeHtml(club.name)}: <strong>${counts[club.id]}回</strong></span>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ========================================
// Excel出力
// ========================================
function exportExcel() {
  if (Object.keys(state.schedule).length === 0) {
    alert('先にスケジュールを生成してください。');
    return;
  }

  const [year, month] = state.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const totalCols = 3 + state.clubs.length;

  // スタイル定義
  const borderThin = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' }
  };
  const baseStyle = {
    border: borderThin,
    alignment: { horizontal: 'center', vertical: 'center' },
    font: { name: 'Yu Gothic', sz: 11 }
  };
  const titleStyle = {
    font: { name: 'Yu Gothic', sz: 16, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  const headerStyle = {
    ...baseStyle,
    font: { name: 'Yu Gothic', sz: 11, bold: true },
    fill: { fgColor: { rgb: 'D9E1F2' } }
  };
  const sundayStyle = {
    ...baseStyle,
    fill: { fgColor: { rgb: 'FCE4EC' } },
    font: { name: 'Yu Gothic', sz: 11, color: { rgb: 'C62828' } }
  };
  const saturdayStyle = {
    ...baseStyle,
    fill: { fgColor: { rgb: 'E3F2FD' } },
    font: { name: 'Yu Gothic', sz: 11, color: { rgb: '1565C0' } }
  };
  const holidayStyle = {
    ...baseStyle,
    fill: { fgColor: { rgb: 'FCE4EC' } },
    font: { name: 'Yu Gothic', sz: 11, color: { rgb: 'C62828' } }
  };
  const eventCellLeft = { ...baseStyle, alignment: { horizontal: 'left', vertical: 'center' } };
  const sundayEventLeft = { ...sundayStyle, alignment: { horizontal: 'left', vertical: 'center' } };
  const saturdayEventLeft = { ...saturdayStyle, alignment: { horizontal: 'left', vertical: 'center' } };
  const holidayEventLeft = { ...holidayStyle, alignment: { horizontal: 'left', vertical: 'center' } };

  const rows = [];

  // 行0: タイトル
  rows.push([`${month}月体育館割り当て`]);

  // 行1: ヘッダー
  const header = ['日', '曜', '行事'];
  state.clubs.forEach(c => header.push(c.name));
  rows.push(header);

  // 行2以降: データ
  const rowMeta = []; // 各データ行の曜日情報
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();

    const events = getEventsForDate(dateStr);
    const eventNames = events.map(ev => ev.name).join(', ');

    const row = [d, dayNames[dow], eventNames];

    const dayAvailable = isDayAvailable(dateStr);
    state.clubs.forEach(club => {
      if (!dayAvailable) {
        row.push('');
      } else if (!isClubAvailable(club.id, dateStr)) {
        row.push('×');
      } else {
        const assigned = state.schedule[dateStr] && state.schedule[dateStr][club.id];
        row.push(assigned ? '○' : '');
      }
    });

    rows.push(row);
    rowMeta.push({ dow, dateStr, holiday: isHoliday(dateStr) });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // タイトル行スタイル
  ws['A1'].s = titleStyle;

  // ヘッダー行スタイル（行1）
  for (let c = 0; c < totalCols; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 1, c });
    if (ws[cellRef]) ws[cellRef].s = headerStyle;
  }

  // データ行スタイル（行2以降）
  for (let i = 0; i < rowMeta.length; i++) {
    const r = i + 2; // Excelの行番号（0始まり）
    const { dow, holiday } = rowMeta[i];

    let rowStyle, rowEventStyle;
    if (dow === 0 || holiday) {
      rowStyle = sundayStyle;
      rowEventStyle = sundayEventLeft;
    } else if (dow === 6) {
      rowStyle = saturdayStyle;
      rowEventStyle = saturdayEventLeft;
    } else {
      rowStyle = baseStyle;
      rowEventStyle = eventCellLeft;
    }

    for (let c = 0; c < totalCols; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' };
      ws[cellRef].s = (c === 2) ? rowEventStyle : rowStyle;
    }
  }

  // セル結合（タイトル行）
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }
  ];

  // 列幅設定
  const colWidths = [
    { wch: 4 },   // A: 日
    { wch: 4 },   // B: 曜
    { wch: 18 },  // C: 行事
  ];
  state.clubs.forEach(() => colWidths.push({ wch: 14 }));
  ws['!cols'] = colWidths;

  // 全行の高さを22.5に設定
  const rowHeights = [];
  for (let i = 0; i < rows.length; i++) {
    rowHeights.push({ hpt: 22.5 });
  }
  ws['!rows'] = rowHeights;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${month}月`);
  XLSX.writeFile(wb, `体育館使用割_${year}年${month}月.xlsx`);
}

// ========================================
// PDF出力（html2canvas で日本語対応）
// ========================================
function exportPdf() {
  if (Object.keys(state.schedule).length === 0) {
    alert('先にスケジュールを生成してください。');
    return;
  }

  const tableEl = document.querySelector('#schedule-container .schedule-table');
  if (!tableEl) { alert('スケジュール表が見つかりません。'); return; }

  const btn = document.getElementById('export-pdf-btn');
  btn.textContent = 'PDF生成中...';
  btn.disabled = true;

  const [year, month] = state.targetMonth.split('-').map(Number);

  html2canvas(tableEl, { scale: 2, useCORS: true }).then(canvas => {
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/png');

    // A4に収まるようにサイズ計算
    const pageWidth = 297; // A4横
    const pageHeight = 210;
    const margin = 10;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2 - 10; // タイトル分

    const ratio = canvas.width / canvas.height;
    let imgW = maxW;
    let imgH = imgW / ratio;
    if (imgH > maxH) {
      imgH = maxH;
      imgW = imgH * ratio;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(`${month}月 体育館使用割 (${year})`, margin, margin + 5);
    doc.addImage(imgData, 'PNG', margin, margin + 10, imgW, imgH);
    doc.save(`体育館使用割_${year}年${month}月.pdf`);
  }).catch(err => {
    console.error('PDF生成エラー:', err);
    alert('PDF生成に失敗しました。');
  }).finally(() => {
    btn.textContent = 'PDF出力';
    btn.disabled = false;
  });
}

// ========================================
// 全体レンダリング
// ========================================
function renderAll() {
  renderClubsTable();
  populateClubSelects();
  renderEventsTable();

  document.getElementById('target-month').value = state.targetMonth;
  document.getElementById('use-saturday').checked = state.useSaturday;
  document.getElementById('use-sunday').checked = state.useSunday;
  document.getElementById('use-holiday').checked = state.useHoliday;

  renderExamList();
  renderClubOffSummary();
  renderClubOffDateList();
  renderTournamentList();
  renderScheduleTable();
  renderStats();
}

// ========================================
// ユーティリティ
// ========================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
