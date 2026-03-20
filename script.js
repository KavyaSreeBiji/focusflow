'use strict';

const TODAY = new Date().toISOString().split('T')[0];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const WEEK = Array.from({length:7}, (_,i) => {
  const d = new Date();
  d.setDate(d.getDate() - 6 + i);
  return d.toISOString().split('T')[0];
});

/* ---------- INIT SUPABASE ---------- */
const supabaseUrl = 'https://xilbfdoeurpaomcwxvos.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbGJmZG9ldXJwYW9tY3d4dm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMDA4NjQsImV4cCI6MjA4OTU3Njg2NH0.TEzkdVDFrK0rLMvnKtctZrBrujGgCT3ZIEPnbRwMYrY';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

/* ---------- STATE ---------- */
let currentUser = null;
let tasks = [];
let habits = [];
let curView = 'tasks';
let activeHCat = '';
let dragSrc = null;

// Auth Listeners & Setup
async function handleSession(session) {
  if (session && session.user) {
    currentUser = session.user;
    document.getElementById('view-auth').style.display = 'none';
    document.getElementById('site-header').style.display = 'flex';
    document.getElementById('view-tasks').style.display = curView === 'tasks' ? '' : 'none';
    document.getElementById('view-habits').style.display = curView === 'habits' ? '' : 'none';
    await fetchData();
  } else {
    currentUser = null;
    document.getElementById('view-auth').style.display = 'flex';
    document.getElementById('site-header').style.display = 'none';
    document.getElementById('view-tasks').style.display = 'none';
    document.getElementById('view-habits').style.display = 'none';
  }
}

// Initial Check
db.auth.getSession().then(({ data: { session } }) => {
  handleSession(session);
});

// Event Listener for Login/Logout
db.auth.onAuthStateChange((event, session) => {
  handleSession(session);
});

async function fetchData() {
  const { data: tData } = await db.from('tasks').select('*').order('created_at', { ascending: false });
  const { data: hData } = await db.from('habits').select('*').order('created_at', { ascending: true });
  tasks = tData || [];
  habits = hData || [];
  renderTasks();
  renderHabits();
}

/* ---------- AUTH LOGIC ---------- */
const authForm = document.getElementById('auth-form');
const btnLogout = document.getElementById('btn-logout');
const errP = document.getElementById('auth-error');
let authMode = 'login';

// Tab switching — use closest() to fix text-node click bug
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    authMode = this.dataset.mode;
    const submitBtn = document.getElementById('btn-auth-submit');
    if (submitBtn) submitBtn.textContent = authMode === 'login' ? 'Log In' : 'Create Account';
    if (errP) errP.textContent = '';
  });
});

if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('btn-auth-submit');
    
    // Show loading state
    const origText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) { submitBtn.textContent = 'Please wait...'; submitBtn.disabled = true; }
    if (errP) errP.textContent = '';
    
    if (authMode === 'signup') {
      const { error } = await db.auth.signUp({ email, password });
      if (error) {
        if (errP) errP.textContent = error.message;
        if (submitBtn) { submitBtn.textContent = origText; submitBtn.disabled = false; }
      } else {
        if (errP) { errP.style.color = 'var(--green)'; errP.textContent = '✅ Account created! Check your email to confirm, then log in.'; }
        if (submitBtn) { submitBtn.textContent = origText; submitBtn.disabled = false; }
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) {
        if (errP) { errP.style.color = 'var(--red)'; errP.textContent = error.message; }
        if (submitBtn) { submitBtn.textContent = origText; submitBtn.disabled = false; }
      } else {
        if (errP) errP.textContent = '';
      }
    }
  });
}

const btnForgot = document.getElementById('btn-forgot-pw');
if (btnForgot) {
  btnForgot.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    if (!email) {
      errP.textContent = 'Please enter your email address to reset password.';
      return;
    }
    const { error } = await db.auth.resetPasswordForEmail(email);
    if (error) errP.textContent = error.message;
    else errP.textContent = 'Password reset link sent to your email!';
  });
}

if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    await db.auth.signOut();
  });
}

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

async function addTask() {
  const title = document.getElementById('tf-title').value.trim();
  if (!title || !currentUser) return;
  
  const newTask = {
    user_id: currentUser.id,
    title,
    cat:  document.getElementById('tf-cat').value,
    prio: document.getElementById('tf-prio').value,
    due:  document.getElementById('tf-due').value || null,
    done: false
  };
  
  const { data, error } = await supabase.from('tasks').insert(newTask).select();
  if (!error && data) {
    tasks.unshift(data[0]);
    document.getElementById('tf-title').value = '';
    document.getElementById('tf-due').value   = '';
    document.getElementById('task-form').classList.remove('open');
    renderTasks();
    showToast('Task added', '📌');
  }
}

async function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  
  const { error } = await supabase.from('tasks').update({ done: t.done }).eq('id', id);
  if (!error) {
    renderTasks();
    if (t.done) showToast('Task completed!', '✅');
  } else {
    t.done = !t.done; // Revert locally if network fails
  }
}

async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (!error) {
    tasks = tasks.filter(x => x.id !== id);
    renderTasks();
    showToast('Task deleted', '🗑');
  }
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

async function addHabit() {
  const name = document.getElementById('hf-name').value.trim();
  if (!name || !currentUser) return;
  
  const newHabit = {
    user_id: currentUser.id,
    name,
    icon:    document.getElementById('hf-icon').value,
    cat:     document.getElementById('hf-cat').value,
    freq:    document.getElementById('hf-freq').value,
    checked: {}
  };
  
  const { data, error } = await supabase.from('habits').insert(newHabit).select();
  if (!error && data) {
    habits.push(data[0]);
    document.getElementById('hf-name').value = '';
    document.getElementById('habit-form').classList.remove('open');
    renderHabits();
    showToast('Habit added', '🎯');
  }
}

async function deleteHabit(id) {
  const { error } = await supabase.from('habits').delete().eq('id', id);
  if (!error) {
    habits = habits.filter(h => h.id !== id);
    renderHabits();
    showToast('Habit deleted', '🗑');
  }
}

async function toggleDay(hid, day) {
  const h = habits.find(x => x.id === hid);
  if (!h) return;
  h.checked[day] = !h.checked[day];
  
  const { error } = await supabase.from('habits').update({ checked: h.checked }).eq('id', hid);
  if (!error) {
    renderHabits();
    if (h.checked[day]) showToast('Keep it up! 🔥', '✓');
  } else {
    h.checked[day] = !h.checked[day]; // Revert locally on fail
  }
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

/* ---------- 3D BACKGROUND EFFECT ---------- */
const shell = document.querySelector('.shell');
if (shell) {
  window.addEventListener('mousemove', (e) => {
    // Disable on touch devices
    if (window.matchMedia("(hover: none)").matches) return;
    
    // Calculate position relative to the center of viewport
    const x = (e.clientX / window.innerWidth) - 0.5;
    const y = (e.clientY / window.innerHeight) - 0.5;
    
    // Calculate rotation: max 6 degrees of tilt. Negative Y so it rotates towards cursor.
    const rotateX = y * -6; 
    const rotateY = x * 6;
    
    shell.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });
  
  // Reset the tilt when the mouse leaves the window
  window.addEventListener('mouseout', (e) => {
    if (e.relatedTarget === null) {
      shell.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }
  });
}
