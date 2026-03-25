// ========================================
// 状態管理
// ========================================
const state = {
  clubs: [],            // { id, name, color }
  gymClosedDates: [],   // { date, reason }
  examPeriods: [],      // { start, end }
  clubOffDays: {},      // { clubId: [weekday numbers] }
  clubOffDates: {},     // { clubId: [{ date, reason }] }
  tournaments: [],      // { clubId, date, name, priorityDays }
  useSaturday: true,
  useSunday: false,
  useHoliday: false,
  targetMonth: '',
  schedule: {},         // { 'YYYY-MM-DD': clubId | null }
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

// ========================================
// 初期化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTabs();
  initClubManagement();
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
}

function loadState() {
  const saved = localStorage.getItem('gymScheduleState');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
  }
  const savedId = localStorage.getItem('gymScheduleNextId');
  if (savedId) {
    nextClubId = parseInt(savedId, 10);
  }
  // 対象月のデフォルト値
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
      if (tab.dataset.tab === 'schedule') {
        renderStats();
      }
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
  if (!confirm('この部活動を削除しますか？関連する条件も削除されます。')) return;
  state.clubs = state.clubs.filter(c => c.id !== id);
  delete state.clubOffDays[id];
  delete state.clubOffDates[id];
  state.tournaments = state.tournaments.filter(t => t.clubId !== id);
  // スケジュールからも削除
  for (const date in state.schedule) {
    if (state.schedule[date] === id) {
      state.schedule[date] = null;
    }
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
// 条件設定
// ========================================
function initConditions() {
  document.getElementById('target-month').addEventListener('change', e => {
    state.targetMonth = e.target.value;
    saveState();
  });

  document.getElementById('add-gym-closed-btn').addEventListener('click', addGymClosedDate);
  document.getElementById('add-exam-btn').addEventListener('click', addExamPeriod);
  document.getElementById('save-weekday-btn').addEventListener('click', saveWeekdayOff);
  document.getElementById('add-club-off-date-btn').addEventListener('click', addClubOffDate);
  document.getElementById('add-tournament-btn').addEventListener('click', addTournament);

  document.getElementById('use-saturday').addEventListener('change', e => {
    state.useSaturday = e.target.checked;
    saveState();
  });
  document.getElementById('use-sunday').addEventListener('change', e => {
    state.useSunday = e.target.checked;
    saveState();
  });
  document.getElementById('use-holiday').addEventListener('change', e => {
    state.useHoliday = e.target.checked;
    saveState();
  });

  document.getElementById('club-off-select').addEventListener('change', loadWeekdayChecks);
}

function addGymClosedDate() {
  const dateInput = document.getElementById('gym-closed-date');
  const reasonInput = document.getElementById('gym-closed-reason');
  const date = dateInput.value;
  if (!date) return;
  state.gymClosedDates.push({ date, reason: reasonInput.value.trim() || '使用不可' });
  dateInput.value = '';
  reasonInput.value = '';
  saveState();
  renderGymClosedList();
}

function renderGymClosedList() {
  const ul = document.getElementById('gym-closed-list');
  ul.innerHTML = '';
  state.gymClosedDates.forEach((item, i) => {
    const li = document.createElement('li');
    li.innerHTML = `${item.date} - ${escapeHtml(item.reason)} <button class="btn btn-danger" data-idx="${i}">削除</button>`;
    ul.appendChild(li);
  });
  ul.querySelectorAll('.btn-danger').forEach(btn => {
    btn.addEventListener('click', () => {
      state.gymClosedDates.splice(parseInt(btn.dataset.idx, 10), 1);
      saveState();
      renderGymClosedList();
    });
  });
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
    clubId: parseInt(clubId, 10),
    date,
    name: name || '大会',
    priorityDays
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
// スケジュール自動生成
// ========================================
function initSchedule() {
  document.getElementById('generate-btn').addEventListener('click', generateSchedule);
  document.getElementById('export-excel-btn').addEventListener('click', exportExcel);
  document.getElementById('export-pdf-btn').addEventListener('click', exportPdf);
}

function getMonthDates(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const dates = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    dates.push(dateStr);
  }
  return dates;
}

function isHoliday(dateStr) {
  return HOLIDAYS.includes(dateStr);
}

function isDateInExamPeriod(dateStr) {
  return state.examPeriods.some(p => dateStr >= p.start && dateStr <= p.end);
}

function isGymClosed(dateStr) {
  return state.gymClosedDates.find(g => g.date === dateStr);
}

function isClubAvailable(clubId, dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay();

  // 曜日指定の活動不可日
  const offDays = state.clubOffDays[clubId] || [];
  if (offDays.includes(dow)) return false;

  // 個別日付の活動不可日
  const offDates = state.clubOffDates[clubId] || [];
  if (offDates.some(d => d.date === dateStr)) return false;

  // 大会当日は活動不可（大会に出ているため体育館は使わない）
  if (state.tournaments.some(t => t.clubId === clubId && t.date === dateStr)) return false;

  return true;
}

function isAvailableDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const dow = date.getDay();

  // 体育館使用不可日
  if (isGymClosed(dateStr)) return false;

  // テスト期間
  if (isDateInExamPeriod(dateStr)) return false;

  // 日曜
  if (dow === 0 && !state.useSunday) return false;

  // 土曜
  if (dow === 6 && !state.useSaturday) return false;

  // 祝日
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
      // 大会が近いほど優先度が高い
      const priority = 1 + (t.priorityDays - diffDays) / t.priorityDays;
      if (priority > maxPriority) maxPriority = priority;
    }
  });
  return maxPriority;
}

function generateSchedule() {
  if (state.clubs.length === 0) {
    alert('部活動を登録してください。');
    return;
  }
  if (!state.targetMonth) {
    alert('対象月を選択してください。');
    return;
  }

  const dates = getMonthDates(state.targetMonth);
  const schedule = {};
  const clubCounts = {};
  state.clubs.forEach(c => { clubCounts[c.id] = 0; });

  // 利用可能な日を抽出
  const availableDates = dates.filter(d => isAvailableDay(d));

  // 各日について、利用可能な部活動リストを作成
  const dateOptions = {};
  availableDates.forEach(dateStr => {
    dateOptions[dateStr] = state.clubs.filter(c => isClubAvailable(c.id, dateStr));
  });

  // 大会前優先度を計算
  const datePriorities = {};
  availableDates.forEach(dateStr => {
    datePriorities[dateStr] = {};
    state.clubs.forEach(club => {
      datePriorities[dateStr][club.id] = getTournamentPriority(club.id, dateStr);
    });
  });

  // スケジュール割り当て
  // 1. まず大会前の優先日を処理
  const priorityDates = availableDates.filter(d =>
    state.clubs.some(c => datePriorities[d][c.id] > 0)
  );
  const normalDates = availableDates.filter(d =>
    !state.clubs.some(c => datePriorities[d][c.id] > 0)
  );

  // 優先日: 大会前の部活を割り当て（ただし均等配分も考慮）
  priorityDates.forEach(dateStr => {
    const options = dateOptions[dateStr];
    if (options.length === 0) {
      schedule[dateStr] = null;
      return;
    }

    // 優先度が高い部活を選択
    let bestClub = null;
    let bestScore = -Infinity;
    options.forEach(club => {
      const priority = datePriorities[dateStr][club.id];
      // 優先度がある場合はそれを重視、均等配分も少し考慮
      const equalityPenalty = clubCounts[club.id] * 0.3;
      const score = priority * 2 - equalityPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestClub = club;
      }
    });

    schedule[dateStr] = bestClub ? bestClub.id : null;
    if (bestClub) clubCounts[bestClub.id]++;
  });

  // 通常日: 均等配分を重視
  normalDates.forEach(dateStr => {
    const options = dateOptions[dateStr];
    if (options.length === 0) {
      schedule[dateStr] = null;
      return;
    }

    // 最も使用回数が少ない部活を選択
    let bestClub = null;
    let minCount = Infinity;
    options.forEach(club => {
      if (clubCounts[club.id] < minCount) {
        minCount = clubCounts[club.id];
        bestClub = club;
      }
    });

    schedule[dateStr] = bestClub ? bestClub.id : null;
    if (bestClub) clubCounts[bestClub.id]++;
  });

  // 使用不可日もスケジュールに記録（表示用）
  dates.forEach(d => {
    if (!availableDates.includes(d)) {
      schedule[d] = null;
    }
  });

  state.schedule = schedule;
  saveState();
  renderCalendar();
  renderStats();
}

// ========================================
// カレンダー表示
// ========================================
function renderCalendar() {
  const container = document.getElementById('calendar-container');
  if (!state.targetMonth || Object.keys(state.schedule).length === 0) {
    container.innerHTML = '<p style="color:#888;text-align:center;padding:40px;">スケジュールを生成してください。</p>';
    return;
  }

  const [year, month] = state.targetMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  let html = `<h3 style="margin-bottom:8px;">${year}年${month}月</h3>`;
  html += '<table class="calendar-table"><thead><tr>';
  dayNames.forEach((name, i) => {
    const cls = i === 0 ? 'sunday' : i === 6 ? 'saturday' : '';
    html += `<th class="${cls}">${name}</th>`;
  });
  html += '</tr></thead><tbody><tr>';

  // 空セル
  for (let i = 0; i < firstDay; i++) {
    html += '<td class="empty"></td>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const dayOfWeek = (firstDay + d - 1) % 7;

    if (dayOfWeek === 0 && d > 1) {
      html += '</tr><tr>';
    }

    const dayClass = dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : '';
    const holidayClass = isHoliday(dateStr) ? 'holiday' : '';

    const gymClosed = isGymClosed(dateStr);
    const inExam = isDateInExamPeriod(dateStr);

    if (gymClosed || inExam) {
      const reason = gymClosed ? gymClosed.reason : 'テスト期間';
      html += `<td class="closed" data-reason="${escapeHtml(reason)}">
        <div class="day-number ${dayClass} ${holidayClass}">${d}</div>
      </td>`;
    } else if (!isAvailableDay(dateStr)) {
      html += `<td class="closed" data-reason="休み">
        <div class="day-number ${dayClass} ${holidayClass}">${d}</div>
      </td>`;
    } else {
      const clubId = state.schedule[dateStr];
      const club = clubId ? state.clubs.find(c => c.id === clubId) : null;
      const clubHtml = club
        ? `<div class="day-club" style="background:${club.color}">${escapeHtml(club.name)}</div>`
        : '<div class="day-club" style="background:#ddd;color:#999">未割当</div>';

      // 大会マーカー
      const tournaments = state.tournaments.filter(t => t.date === dateStr);
      const tournamentHtml = tournaments.map(t => {
        const c = state.clubs.find(cl => cl.id === t.clubId);
        return `<div class="tournament-marker">大会:${escapeHtml(c ? c.name : '?')}</div>`;
      }).join('');

      html += `<td data-date="${dateStr}">
        <div class="day-number ${dayClass} ${holidayClass}">${d}</div>
        ${tournamentHtml}
        ${clubHtml}
      </td>`;
    }
  }

  // 残りの空セル
  const remaining = (7 - ((firstDay + daysInMonth) % 7)) % 7;
  for (let i = 0; i < remaining; i++) {
    html += '<td class="empty"></td>';
  }

  html += '</tr></tbody></table>';
  container.innerHTML = html;

  // 手動変更クリックイベント
  container.querySelectorAll('td[data-date]').forEach(td => {
    td.addEventListener('click', (e) => {
      e.stopPropagation();
      openCellDropdown(td, td.dataset.date);
    });
  });
}

function openCellDropdown(td, dateStr) {
  // 既存のドロップダウンを閉じる
  closeAllDropdowns();

  const dropdown = document.createElement('div');
  dropdown.className = 'cell-dropdown';

  // 「未割当」オプション
  const noneBtn = document.createElement('button');
  noneBtn.textContent = '-- 未割当 --';
  noneBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.schedule[dateStr] = null;
    saveState();
    renderCalendar();
    renderStats();
  });
  dropdown.appendChild(noneBtn);

  // 各部活動オプション
  state.clubs.forEach(club => {
    const btn = document.createElement('button');
    btn.innerHTML = `<span style="display:inline-block;width:12px;height:12px;background:${club.color};border-radius:2px;margin-right:6px;vertical-align:middle;"></span>${escapeHtml(club.name)}`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.schedule[dateStr] = club.id;
      saveState();
      renderCalendar();
      renderStats();
    });
    dropdown.appendChild(btn);
  });

  td.appendChild(dropdown);

  // 外側クリックで閉じる
  setTimeout(() => {
    document.addEventListener('click', closeAllDropdowns, { once: true });
  }, 0);
}

function closeAllDropdowns() {
  document.querySelectorAll('.cell-dropdown').forEach(d => d.remove());
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
    const cid = state.schedule[date];
    if (cid && counts[cid] !== undefined) {
      counts[cid]++;
    }
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

  // データ作成
  const rows = [];
  rows.push([`${year}年${month}月 体育館使用割`]);
  rows.push([]);
  rows.push(['日付', '曜日', '使用部活動', '備考']);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const dowStr = dayNames[dow];

    let clubName = '';
    let note = '';

    const gymClosed = isGymClosed(dateStr);
    if (gymClosed) {
      note = gymClosed.reason;
    } else if (isDateInExamPeriod(dateStr)) {
      note = 'テスト期間';
    } else if (!isAvailableDay(dateStr)) {
      note = '休み';
    } else {
      const clubId = state.schedule[dateStr];
      const club = clubId ? state.clubs.find(c => c.id === clubId) : null;
      clubName = club ? club.name : '';
    }

    // 大会情報
    const tournaments = state.tournaments.filter(t => t.date === dateStr);
    if (tournaments.length > 0) {
      const tNames = tournaments.map(t => {
        const c = state.clubs.find(cl => cl.id === t.clubId);
        return `大会:${c ? c.name : '?'} ${t.name}`;
      });
      note = note ? `${note} / ${tNames.join(', ')}` : tNames.join(', ');
    }

    rows.push([`${month}/${d}`, dowStr, clubName, note]);
  }

  // 統計
  rows.push([]);
  rows.push(['--- 使用回数 ---']);
  state.clubs.forEach(club => {
    let count = 0;
    for (const date in state.schedule) {
      if (state.schedule[date] === club.id) count++;
    }
    rows.push([club.name, `${count}回`]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 10 }, { wch: 6 }, { wch: 20 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${year}年${month}月`);
  XLSX.writeFile(wb, `体育館使用割_${year}年${month}月.xlsx`);
}

// ========================================
// PDF出力
// ========================================
function exportPdf() {
  if (Object.keys(state.schedule).length === 0) {
    alert('先にスケジュールを生成してください。');
    return;
  }

  const [year, month] = state.targetMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // フォント設定（日本語対応のため基本フォントを使用）
  doc.setFont('helvetica');

  // タイトル
  doc.setFontSize(16);
  doc.text(`${year}/${month} Gym Schedule`, 14, 15);

  // テーブルデータ
  const tableData = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();

    let clubName = '';
    let note = '';

    const gymClosed = isGymClosed(dateStr);
    if (gymClosed) {
      note = gymClosed.reason;
    } else if (isDateInExamPeriod(dateStr)) {
      note = 'Exam';
    } else if (!isAvailableDay(dateStr)) {
      note = 'Off';
    } else {
      const clubId = state.schedule[dateStr];
      const club = clubId ? state.clubs.find(c => c.id === clubId) : null;
      clubName = club ? club.name : '';
    }

    tableData.push([`${month}/${d}`, dayNames[dow], clubName, note]);
  }

  doc.autoTable({
    head: [['Date', 'Day', 'Club', 'Note']],
    body: tableData,
    startY: 22,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [44, 62, 80] },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 1) {
        const day = data.cell.text[0];
        if (day === '日') {
          data.cell.styles.textColor = [231, 76, 60];
        } else if (day === '土') {
          data.cell.styles.textColor = [52, 152, 219];
        }
      }
    }
  });

  doc.save(`gym_schedule_${year}_${month}.pdf`);
}

// ========================================
// 全体レンダリング
// ========================================
function renderAll() {
  renderClubsTable();
  populateClubSelects();

  // 条件タブの値を復元
  document.getElementById('target-month').value = state.targetMonth;
  document.getElementById('use-saturday').checked = state.useSaturday;
  document.getElementById('use-sunday').checked = state.useSunday;
  document.getElementById('use-holiday').checked = state.useHoliday;

  renderGymClosedList();
  renderExamList();
  renderClubOffSummary();
  renderClubOffDateList();
  renderTournamentList();
  renderCalendar();
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
