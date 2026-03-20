'use strict';

const TODAY = new Date().toISOString().split('T')[0];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const WEEK = Array.from({length:7}, (_,i) => {
  const d = new Date();
  d.setDate(d.getDate() - 6 + i);
  return d.toISOString().split('T')[0];
});

/* ---------- STORAGE (localStorage) ---------- */
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function load(key, def) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : def;
  } catch(e) { return def; }
}

/* ---------- STATE ---------- */
let tasks  = load('ff2-tasks', [
  {id:1, title:'Review Q1 report',         cat:'work',     prio:'high',   due:'2026-03-22', done:false},
  {id:2, title:'Book dentist appointment', cat:'health',   prio:'medium', due:'2026-03-28', done:false},
  {id:3, title:'Pay electricity bill',     cat:'finance',  prio:'high',   due:'2026-03-21', done:false},
  {id:4, title:'Read design patterns',     cat:'learning', prio:'low',    due:'2026-03-30', done:true},
]);
let habits = load('ff2-habits', [
  {id:1, name:'Morning meditation', icon:'🧘', cat:'mindset',  freq:'daily', checked:{}},
  {id:2, name:'30 min run',         icon:'🏃', cat:'fitness',  freq:'daily', checked:{}},
  {id:3, name:'Drink 8 glasses',    icon:'💧', cat:'wellness', freq:'daily', checked:{}},
  {id:4, name:'Read 20 pages',      icon:'📖', cat:'learning', freq:'daily', checked:{}},
]);
let nextTId   = load('ff2-ntid', 100);
let nextHId   = load('ff2-nhid', 100);
let curView   = 'tasks';
let activeHCat = '';
let dragSrc   = null;

function saveTasks()  { save('ff2-tasks', tasks);  save('ff2-ntid', nextTId); }
function saveHabits() { save('ff2-habits', habits); save('ff2-nhid', nextHId); }

/* ---------- TOAST ---------- */
let toastTimer;
function showToast(msg, icon='✓') {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${icon}</span> ${msg}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- VIEW SWITCH ---------- */
function switchView(v) {
  curView = v;
  document.getElementById('view-tasks').style.display  = v === 'tasks'  ? '' : 'none';
  document.getElementById('view-habits').style.display = v === 'habits' ? '' : 'none';
  document.getElementById('btn-tasks').className  = 'tab-btn t-tasks'  + (v === 'tasks'  ? ' active' : '');
  document.getElementById('btn-habits').className = 'tab-btn t-habits' + (v === 'habits' ? ' active' : '');
  document.getElementById('view-sub').textContent = v === 'tasks'
    ? 'Tasks & Habits — all in one place'
    : 'Build lasting habits, one day at a time';
  v === 'habits' ? renderHabits() : renderTasks();
}

/* ============================================================
   TASKS
============================================================ */
function toggleTaskForm() {
  const f = document.getElementById('task-form');
  f.classList.toggle('open');
  if (f.classList.contains('open')) document.getElementById('tf-title').focus();
}

function addTask() {
  const title = document.getElementById('tf-title').value.trim();
  if (!title) return;
  tasks.unshift({
    id: nextTId++,
    title,
    cat:  document.getElementById('tf-cat').value,
    prio: document.getElementById('tf-prio').value,
    due:  document.getElementById('tf-due').value,
    done: false
  });
  saveTasks();
  document.getElementById('tf-title').value = '';
  document.getElementById('tf-due').value   = '';
  document.getElementById('task-form').classList.remove('open');
  renderTasks();
  showToast('Task added', '📌');
}

function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  saveTasks();
  renderTasks();
  if (t.done) showToast('Task completed!', '✅');
}

function deleteTask(id) {
  tasks = tasks.filter(x => x.id !== id);
  saveTasks();
  renderTasks();
  showToast('Task deleted', '🗑');
}

function dueInfo(due) {
  if (!due) return { label: '', cls: '' };
  if (due < TODAY) return { label: 'Overdue',   cls: 'due-overdue' };
  if (due === TODAY) return { label: 'Due today', cls: 'due-today' };
  const diff = Math.round((new Date(due) - new Date(TODAY)) / 86400000);
  return { label: `Due in ${diff}d`, cls: 'due-chip' };
}

function renderTasks() {
  const search = document.getElementById('t-search').value.toLowerCase();
  const cat    = document.getElementById('t-cat').value;
  const prio   = document.getElementById('t-prio').value;
  const status = document.getElementById('t-status').value;

  let filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search)) return false;
    if (cat    && t.cat  !== cat)    return false;
    if (prio   && t.prio !== prio)   return false;
    if (status === 'active' &&  t.done) return false;
    if (status === 'done'   && !t.done) return false;
    return true;
  });

  /* stats */
  const total   = tasks.length;
  const done    = tasks.filter(t =>  t.done).length;
  const pending = tasks.filter(t => !t.done).length;
  const overdue = tasks.filter(t => !t.done && t.due && t.due < TODAY).length;
  const pct     = total ? Math.round(done / total * 100) : 0;

  document.getElementById('t-total').textContent   = total;
  document.getElementById('t-done').textContent    = done;
  document.getElementById('t-pending').textContent = pending;
  document.getElementById('t-overdue').textContent = overdue;
  document.getElementById('t-bar-done').style.width = pct + '%';
  document.getElementById('t-bar-pend').style.width = (total ? Math.round(pending/total*100) : 0) + '%';
  document.getElementById('t-bar-ov').style.width   = (total ? Math.min(100, Math.round(overdue/total*200)) : 0) + '%';

  /* sort */
  const prioRank = { high: 0, medium: 1, low: 2 };
  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pd = (prioRank[a.prio] ?? 1) - (prioRank[b.prio] ?? 1);
    if (pd !== 0) return pd;
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return 0;
  });

  const el = document.getElementById('task-list');
  if (!filtered.length) {
    el.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
        <p>No tasks found</p>
      </div>`;
    return;
  }

  el.innerHTML = filtered.map(t => {
    const { label, cls } = dueInfo(t.due);
    return `
      <div class="task-card${t.done ? ' is-done' : ''}" draggable="true" data-id="${t.id}"
        ondragstart="onDragStart(event,${t.id})"
        ondragover="onDragOver(event)"
        ondragleave="onDragLeave(event)"
        ondrop="onDrop(event,${t.id})">
        <span class="drag-grip">⠿</span>
        <div class="prio-dot dot-${t.prio || 'medium'}"></div>
        <div class="check-ring${t.done ? ' done' : ''}" onclick="toggleTask(${t.id})"></div>
        <div class="task-body">
          <div class="task-title">${escHtml(t.title)}</div>
          <div class="task-chips">
            <span class="chip chip-${t.cat}">${t.cat}</span>
            <span class="pchip pchip-${t.prio || 'medium'}">${t.prio || 'medium'}</span>
            ${label ? `<span class="${cls}">${label}</span>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="icon-btn danger" onclick="deleteTask(${t.id})" title="Delete">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

/* drag */
function onDragStart(e, id) {
  dragSrc = id;
  setTimeout(() => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('dragging');
  }, 0);
}
function onDragOver(e)  { e.preventDefault(); const c = e.currentTarget; if (c.dataset.id) c.classList.add('drag-over'); }
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onDrop(e, tid) {
  e.preventDefault();
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('dragging','drag-over'));
  if (dragSrc === tid) return;
  const si = tasks.findIndex(t => t.id === dragSrc);
  const ti = tasks.findIndex(t => t.id === tid);
  if (si < 0 || ti < 0) return;
  const [item] = tasks.splice(si, 1);
  tasks.splice(ti, 0, item);
  dragSrc = null;
  saveTasks();
  renderTasks();
}

/* ============================================================
   HABITS
============================================================ */
function toggleHabitForm() {
  const f = document.getElementById('habit-form');
  f.classList.toggle('open');
  if (f.classList.contains('open')) document.getElementById('hf-name').focus();
}

function addHabit() {
  const name = document.getElementById('hf-name').value.trim();
  if (!name) return;
  habits.push({
    id:      nextHId++,
    name,
    icon:    document.getElementById('hf-icon').value,
    cat:     document.getElementById('hf-cat').value,
    freq:    document.getElementById('hf-freq').value,
    checked: {}
  });
  saveHabits();
  document.getElementById('hf-name').value = '';
  document.getElementById('habit-form').classList.remove('open');
  renderHabits();
  showToast('Habit added', '🎯');
}

function deleteHabit(id) {
  habits = habits.filter(h => h.id !== id);
  saveHabits();
  renderHabits();
  showToast('Habit deleted', '🗑');
}

function toggleDay(hid, day) {
  const h = habits.find(x => x.id === hid);
  if (!h) return;
  h.checked[day] = !h.checked[day];
  saveHabits();
  renderHabits();
  if (h.checked[day]) showToast('Keep it up! 🔥', '✓');
}

function filterHcat(el, cat) {
  document.querySelectorAll('.hcat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  activeHCat = cat;
  renderHabits();
}

function getStreak(h) {
  let s = 0;
  for (let i = 6; i >= 0; i--) { if (h.checked[WEEK[i]]) s++; else break; }
  return s;
}

function getWeekHits(h) { return WEEK.filter(d => h.checked[d]).length; }

const CAT_ICON_BG = {
  wellness: 'rgba(16,185,129,.15)',
  fitness:  'rgba(99,102,241,.15)',
  mindset:  'rgba(139,92,246,.15)',
  learning: 'rgba(6,182,212,.15)',
  social:   'rgba(236,72,153,.15)',
  other:    'rgba(255,255,255,.06)',
};

function renderHabits() {
  const search = document.getElementById('h-search').value.toLowerCase();
  const filtered = habits.filter(h => {
    if (search && !h.name.toLowerCase().includes(search)) return false;
    if (activeHCat && h.cat !== activeHCat) return false;
    return true;
  });

  /* stats */
  const total     = habits.length;
  const todayDone = habits.filter(h => h.checked[TODAY]).length;
  const bestStreak = habits.reduce((m, h) => Math.max(m, getStreak(h)), 0);
  const totalHits  = habits.reduce((s, h) => s + getWeekHits(h), 0);
  const maxHits    = total * 7;
  const weekRate   = maxHits ? Math.round(totalHits / maxHits * 100) : 0;
  const todayPct   = total   ? Math.round(todayDone / total * 100) : 0;

  document.getElementById('h-total').textContent   = total;
  document.getElementById('h-today').textContent   = todayDone;
  document.getElementById('h-streak').textContent  = bestStreak;
  document.getElementById('h-rate').textContent    = weekRate + '%';
  document.getElementById('h-bar-today').style.width = todayPct + '%';
  document.getElementById('h-bar-rate').style.width  = weekRate + '%';

  const el = document.getElementById('habit-list');
  if (!filtered.length) {
    el.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
        </svg>
        <p>${habits.length ? 'No habits in this category' : 'Add your first habit above!'}</p>
      </div>`;
    return;
  }

  el.innerHTML = filtered.map(h => {
    const streak = getStreak(h);
    const hits   = getWeekHits(h);
    const pct    = Math.round(hits / 7 * 100);
    const iconBg = CAT_ICON_BG[h.cat] || CAT_ICON_BG.other;

    const dots = WEEK.map((d, i) => {
      const dow    = new Date(d).getDay();
      const lbl    = DAY_LABELS[dow];
      const isToday = d === TODAY;
      const hit     = !!h.checked[d];
      return `
        <div class="day-col">
          <span class="day-lbl${isToday ? ' is-today' : ''}">${lbl}</span>
          <div class="day-dot${hit ? ' hit' : ''}${isToday ? ' is-today' : ''}" onclick="toggleDay(${h.id},'${d}')">
            <svg viewBox="0 0 14 14" fill="none" stroke="white" stroke-width="2">
              <path d="M2.5 7l3 3 6-6"/>
            </svg>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="habit-card">
        <div class="habit-head">
          <div class="habit-icon" style="background:${iconBg}">${h.icon}</div>
          <div class="habit-info">
            <div class="habit-name">${escHtml(h.name)}</div>
            <div class="habit-meta">
              <span class="hbadge hbadge-${h.cat}">${h.cat}</span>
              <span class="habit-freq-lbl">${h.freq}</span>
            </div>
          </div>
          ${streak > 0 ? `<div class="streak-badge">🔥 ${streak} day${streak > 1 ? 's' : ''}</div>` : ''}
          <div class="habit-actions-wrap">
            <button class="icon-btn danger" onclick="deleteHabit(${h.id})" title="Delete">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5L11 4"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="week-grid">${dots}</div>
        <div class="habit-footer">
          <div class="hprog-wrap">
            <div class="hprog-bar">
              <div class="hprog-fill" style="width:${pct}%"></div>
            </div>
            <div class="hprog-lbl">${hits} of 7 days completed this week</div>
          </div>
          <div class="hprog-pct">${pct}%</div>
        </div>
      </div>`;
  }).join('');
}

/* ---------- UTILS ---------- */
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---------- DAILY QUOTE ---------- */
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Atomic Habits" },
  { text: "Success is the sum of small efforts, repeated day-in and day-out.", author: "Robert Collier" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" }
];

function renderDailyQuote() {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  const quoteIndex = daysSinceEpoch % QUOTES.length;
  const quote = QUOTES[quoteIndex];
  
  const textEl = document.getElementById('daily-quote-text');
  const authorEl = document.getElementById('daily-quote-author');
  
  if (textEl && authorEl) {
    textEl.textContent = `"${quote.text}"`;
    authorEl.textContent = `- ${quote.author}`;
  }
}

/* ---------- INIT ---------- */
renderTasks();
renderDailyQuote();
