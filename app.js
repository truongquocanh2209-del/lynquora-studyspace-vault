'use strict';

/* Lynquora StudySpace — original, dependency-free learning workspace v2.3.0.
   Account records are stored in this browser only. Passwords are PBKDF2 hashes,
   but this static app has no server-side identity, recovery or cross-device sync. */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const DB_KEY = 'lynquora.studyspace.v1.accounts';
const DATA_PREFIX = 'lynquora.studyspace.v1.data.';
const PREF_KEY = 'lynquora.studyspace.v1.preferences';
const SESSION_KEY = 'lynquora.studyspace.v1.session';
const SUBJECTS = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý', 'Tin học', 'Khác'];
const ROUTES = {
  home: 'Tổng quan', tasks: 'Bài tập & nhiệm vụ', schedule: 'Lịch học', focus: 'Focus timer',
  notes: 'Sổ ghi chú', sources: 'Kho nguồn dữ liệu', cards: 'Thẻ ghi nhớ', quiz: 'Quiz ôn tập', stats: 'Thống kê', entertainment: 'Giải trí & nghỉ ngơi', settings: 'Tùy chỉnh'
};
let currentUser = null;
let data = null;
let currentRoute = 'home';
let authMode = 'login';
let taskFilter = 'all';
let searchQuery = '';
let scheduleOffset = 0;
let reviewIndex = 0;
let reviewFlipped = false;
let quizState = { questions: [], index: 0, score: 0, answered: false, finished: false, selected: -1 };
let focusState = { duration: 25 * 60, remaining: 25 * 60, running: false, endAt: 0, subject: 'Toán', hasStarted: false };
let focusInterval = null;
let breakState = { preset: 5, duration: 300, remaining: 300, running: false, endAt: 0 };
let breakInterval = null;
let breakIdeaIndex = -1;
let sourceSearchQuery = '';
let sourceTypeFilter = 'all';
let sourceStatusFilter = 'all';
let sourceFavoritesOnly = false;
const BREAK_IDEAS = [
  'Rời mắt khỏi màn hình, nhìn ra xa một lúc.',
  'Duỗi vai và cổ nhẹ nhàng trong phạm vi thoải mái.',
  'Uống một ít nước rồi quay lại khi sẵn sàng.',
  'Dọn gọn một góc bàn để phiên học sau dễ bắt đầu.',
  'Đi lại nhẹ nhàng trong phòng vài phút.',
  'Hít thở chậm vài nhịp và thả lỏng bàn tay.',
  'Nghe một bản nhạc ngắn hoặc ngồi yên không mở thêm tab.'
];
const DAILY_CHALLENGES = [
  { title: '3 thẻ nhớ mới', detail: 'Tạo ba thẻ hỏi–đáp từ bài vừa học để chủ động nhớ lại.', route: 'cards', action: 'card-new', cta: 'Tạo thẻ' },
  { title: 'Một việc quan trọng', detail: 'Chọn một nhiệm vụ ưu tiên và đưa nó tiến thêm một bước.', route: 'tasks', action: 'navigate', cta: 'Mở nhiệm vụ' },
  { title: '15 phút tập trung', detail: 'Hoàn thành một phiên học ngắn và ghi nhận tiến bộ.', route: 'focus', action: 'navigate', cta: 'Bắt đầu Focus' },
  { title: 'Ôn lại điều khó nhớ', detail: 'Chọn một thẻ đang đến hạn và tự trả lời trước khi lật.', route: 'cards', action: 'navigate', cta: 'Ôn thẻ' },
  { title: 'Ghi lại một điều mới', detail: 'Viết tóm tắt ngắn về một khái niệm bạn vừa hiểu.', route: 'notes', action: 'note-new', cta: 'Tạo ghi chú' },
  { title: 'Làm rõ lịch ngày mai', detail: 'Kiểm tra hạn nộp và chọn trước việc cần làm đầu tiên.', route: 'schedule', action: 'navigate', cta: 'Mở lịch học' },
  { title: 'Tổng kết 3 dòng', detail: 'Viết ba ý: đã học gì, còn vướng gì, bước tiếp theo là gì.', route: 'notes', action: 'note-new', cta: 'Ghi tổng kết' }
];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function uid() { return (globalThis.crypto?.randomUUID?.() || `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`); }
function localDate(date = new Date()) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}
function parseLocalDate(value) { if (!value) return new Date(); const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d, 12); }
function dateLabel(value, options = { day: 'numeric', month: 'short' }) {
  if (!value) return 'Chưa đặt hạn';
  return parseLocalDate(value).toLocaleDateString('vi-VN', options);
}
function fullDateLabel(date = new Date()) { return date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
function weekStart(date = new Date()) { const d = new Date(date); d.setHours(12,0,0,0); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d; }
function dayOffset(value, amount) { const d = parseLocalDate(value); d.setDate(d.getDate() + amount); return localDate(d); }
function escapeAttr(value) { return escapeHTML(value).replace(/`/g, '&#96;'); }
function fmtMinutes(minutes) {
  const n = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(n / 60), m = n % 60;
  if (h && m) return `${h} giờ ${m} phút`;
  if (h) return `${h} giờ`;
  return `${m} phút`;
}
function fmtClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function showToast(message, type = 'success') {
  const host = $('#toastRegion');
  if (!host) return;
  const node = document.createElement('div');
  node.className = `toast${type === 'error' ? ' error' : ''}`;
  node.innerHTML = `<span class="toast-icon">${type === 'error' ? '!' : '✓'}</span><span>${escapeHTML(message)}</span>`;
  host.appendChild(node);
  window.setTimeout(() => node.remove(), 3400);
}
function getAccounts() {
  try { const parsed = JSON.parse(localStorage.getItem(DB_KEY) || '{}'); return parsed && typeof parsed === 'object' ? parsed : {}; }
  catch { return {}; }
}
function setAccounts(accounts) { localStorage.setItem(DB_KEY, JSON.stringify(accounts)); }
function defaultData() {
  return {
    schema: 1,
    settings: { theme: readPreferences().theme || 'dark', accent: readPreferences().accent || 'violet', fontSize: 16, dailyGoal: 90, dailyChallengeDoneOn: '' },
    tasks: [], sessions: [], notes: [], cards: [], resources: [], createdAt: new Date().toISOString()
  };
}
function readPreferences() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; }
}
function persistPreferences() {
  const prefs = data?.settings || readPreferences();
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ theme: prefs.theme, accent: prefs.accent })); } catch { /* Storage may be disabled. */ }
}
function dataKey(username) { return DATA_PREFIX + username.toLowerCase(); }
function loadData(username) {
  try {
    const parsed = JSON.parse(localStorage.getItem(dataKey(username)) || 'null');
    if (parsed && parsed.schema === 1 && Array.isArray(parsed.tasks) && Array.isArray(parsed.sessions)) {
      parsed.settings = { ...defaultData().settings, ...(parsed.settings || {}) };
      parsed.notes = Array.isArray(parsed.notes) ? parsed.notes : [];
      parsed.cards = Array.isArray(parsed.cards) ? parsed.cards : [];
      parsed.resources = normalizeStoredResources(Array.isArray(parsed.resources) ? parsed.resources : []);
      return parsed;
    }
  } catch { /* Use a fresh workspace if existing local data is damaged. */ }
  return defaultData();
}
function saveData() {
  if (!currentUser || !data) return;
  try {
    localStorage.setItem(dataKey(currentUser.username), JSON.stringify(data));
    persistPreferences();
  } catch (error) {
    showToast('Không thể lưu thêm dữ liệu. Hãy kiểm tra dung lượng trình duyệt.', 'error');
  }
}
function applyAppearance(settings) {
  const root = document.documentElement;
  root.dataset.theme = settings?.theme === 'light' ? 'light' : 'dark';
  root.dataset.accent = ['violet', 'cyan', 'blue', 'rose', 'green'].includes(settings?.accent) ? settings.accent : 'violet';
  const size = Math.max(14, Math.min(19, Number(settings?.fontSize) || 16));
  root.style.setProperty('--font-size', `${size}px`);
  const themeMeta = $('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = root.dataset.theme === 'light' ? '#f4f4fa' : '#11111b';
}
function saveAndApply() { saveData(); applyAppearance(data.settings); }

async function hashPassword(password, saltHex) {
  if (!globalThis.crypto?.subtle || !globalThis.isSecureContext) {
    throw new Error('Để dùng tài khoản có mật khẩu, hãy mở website qua HTTPS trên GitHub Pages hoặc localhost.');
  }
  const salt = saltHex ? Uint8Array.from(saltHex.match(/.{1,2}/g).map(x => parseInt(x, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const saltOut = Array.from(salt, x => x.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256);
  const hash = Array.from(new Uint8Array(bits), x => x.toString(16).padStart(2, '0')).join('');
  return { salt: saltOut, hash };
}
function normalizeName(name) { return String(name || '').trim().toLowerCase(); }
function setAuthError(message = '') {
  const box = $('#authError');
  box.textContent = message;
  box.classList.toggle('hidden', !message);
}
function setAuthMode(mode) {
  authMode = mode === 'signup' ? 'signup' : 'login';
  const signup = authMode === 'signup';
  $('#authTitle').textContent = signup ? 'Tạo không gian của bạn' : 'Chào mừng trở lại';
  $('#authSubtitle').textContent = signup ? 'Một tài khoản cục bộ để lưu tiến độ học tập trên thiết bị này.' : 'Tiếp tục hành trình học tập của bạn.';
  $('#displayNameField').classList.toggle('hidden', !signup);
  $('#displayNameInput').required = signup;
  $('#passwordInput').autocomplete = signup ? 'new-password' : 'current-password';
  $('#passwordHint').textContent = signup ? 'Dùng mật khẩu riêng, ít nhất 8 ký tự. Không sử dụng lại mật khẩu quan trọng.' : 'Mật khẩu được băm trước khi lưu trên thiết bị.';
  $('#authSubmit').innerHTML = signup ? 'Tạo tài khoản <span>→</span>' : 'Đăng nhập <span>→</span>';
  $$('.auth-tab').forEach(el => el.classList.toggle('active', el.dataset.mode === authMode));
  setAuthError('');
}
function openAuth(mode = 'login') {
  $('#authModal').classList.remove('hidden');
  setAuthMode(mode);
  window.setTimeout(() => $(mode === 'signup' ? '#displayNameInput' : '#usernameInput').focus(), 50);
}
function closeAuth() { $('#authModal').classList.add('hidden'); setAuthError(''); }
async function submitAuth(event) {
  event.preventDefault();
  setAuthError('');
  const username = normalizeName($('#usernameInput').value);
  const password = $('#passwordInput').value;
  const displayName = $('#displayNameInput').value.trim();
  const submit = $('#authSubmit');
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) return setAuthError('Tên tài khoản cần có 3–24 ký tự: chữ cái không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
  if (password.length < 8) return setAuthError('Mật khẩu cần có ít nhất 8 ký tự.');
  submit.disabled = true;
  submit.textContent = authMode === 'signup' ? 'Đang tạo tài khoản…' : 'Đang kiểm tra…';
  try {
    const accounts = getAccounts();
    if (authMode === 'signup') {
      if (accounts[username]) throw new Error('Tên tài khoản này đã được dùng trên trình duyệt này. Hãy chọn tên khác hoặc đăng nhập.');
      if (!displayName || displayName.length > 32) throw new Error('Hãy nhập tên hiển thị dài tối đa 32 ký tự.');
      const { salt, hash } = await hashPassword(password);
      accounts[username] = { username, displayName, salt, hash, createdAt: new Date().toISOString(), version: 1 };
      setAccounts(accounts);
      closeAuth();
      loginUser(accounts[username]);
      showToast('Tài khoản đã được tạo trên thiết bị này.');
    } else {
      const account = accounts[username];
      if (!account) throw new Error('Không tìm thấy tài khoản này trên trình duyệt. Bạn có thể tạo tài khoản mới hoặc thử bản dùng thử.');
      const result = await hashPassword(password, account.salt);
      if (result.hash !== account.hash) throw new Error('Tên tài khoản hoặc mật khẩu chưa chính xác.');
      closeAuth();
      loginUser(account);
      showToast('Đăng nhập thành công. Chúc bạn học tập hiệu quả!');
    }
  } catch (error) {
    setAuthError(error instanceof Error ? error.message : 'Có lỗi khi xử lý tài khoản. Hãy thử lại.');
  } finally {
    submit.disabled = false;
    submit.innerHTML = authMode === 'signup' ? 'Tạo tài khoản <span>→</span>' : 'Đăng nhập <span>→</span>';
  }
}
function writeLoginSession(username, isGuest = false) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ username, isGuest: Boolean(isGuest), savedAt: new Date().toISOString() })); return true; }
  catch { showToast('Không thể lưu phiên đăng nhập trong trình duyệt này.', 'error'); return false; }
}
function clearLoginSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* Browser storage may be disabled. */ }
}
function enterGuest(options = {}) {
  currentUser = { username: 'guest', displayName: 'Người học', isGuest: true };
  writeLoginSession('guest', true);
  data = loadData('guest');
  applyAppearance(data.settings);
  $('#welcomeScreen').classList.add('hidden');
  $('#appScreen').classList.remove('hidden');
  currentRoute = 'home';
  renderApp();
  if (!options.silent) showToast('Đang dùng thử. Dữ liệu sẽ lưu trên trình duyệt này.');
}
function loginUser(account) {
  currentUser = { username: account.username, displayName: account.displayName || account.username, isGuest: false };
  writeLoginSession(account.username, false);
  data = loadData(account.username);
  applyAppearance(data.settings);
  $('#welcomeScreen').classList.add('hidden');
  $('#appScreen').classList.remove('hidden');
  currentRoute = 'home';
  renderApp();
}
function logout() {
  saveData();
  clearLoginSession();
  currentUser = null;
  data = null;
  searchQuery = '';
  $('#globalSearch').value = '';
  $('#appScreen').classList.add('hidden');
  $('#welcomeScreen').classList.remove('hidden');
  closeSidebar();
  $('#mobileScrim').classList.remove('visible');
  closeAuth();
  if (focusInterval) clearInterval(focusInterval);
  focusInterval = null;
  if (breakInterval) clearInterval(breakInterval);
  breakInterval = null;
  breakState = { preset: 5, duration: 300, remaining: 300, running: false, endAt: 0 };
  focusState = { duration: 1500, remaining: 1500, running: false, endAt: 0, subject: 'Toán', hasStarted: false };
}
function renderApp() {
  if (!currentUser || !data) return;
  $('#sidebarName').textContent = currentUser.displayName;
  $('#profileName').textContent = currentUser.displayName;
  $('#sidebarAvatar').textContent = currentUser.displayName.slice(0, 1).toUpperCase();
  $('#profileAvatar').textContent = currentUser.displayName.slice(0, 1).toUpperCase();
  renderView();
  updateActiveTokens();
}
function navigate(route) {
  if (!ROUTES[route]) return;
  currentRoute = route;
  closeSidebar();
  $('#mobileScrim').classList.remove('visible');
  $('#currentSectionLabel').textContent = ROUTES[route];
  renderView();
  updateActiveTokens();
  $('#viewContainer').focus({ preventScroll: true });
}
function updateActiveTokens() {
  $$('.nav-token[data-route]').forEach(button => button.classList.toggle('active', button.dataset.route === currentRoute));
  $('#currentSectionLabel').textContent = ROUTES[currentRoute] || 'Tổng quan';
}
function openSidebar() { $('#sidebar').classList.add('sidebar-open'); $('#mobileScrim').classList.add('visible'); }
function closeSidebar() { $('#sidebar').classList.remove('sidebar-open'); $('#mobileScrim').classList.remove('visible'); }

function addTask(task) {
  data.tasks.unshift({ id: uid(), title: task.title.trim(), subject: task.subject, due: task.due || '', priority: task.priority || 'medium', done: false, createdAt: new Date().toISOString() });
  saveData();
}
function sortedTasks(tasks = data.tasks) {
  return [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99') || (b.createdAt || '').localeCompare(a.createdAt || ''));
}
function tasksDueToday() { const today = localDate(); return data.tasks.filter(t => !t.done && t.due === today); }
function completedToday() { return data.tasks.filter(t => t.done && (t.completedDate === localDate() || (!t.completedDate && (t.createdAt || '').slice(0,10) === localDate()))); }
function getWeekSessions(offset = 0) {
  const start = weekStart(); start.setDate(start.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); const key = localDate(d);
    const minutes = data.sessions.filter(s => s.date === key).reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);
    return { key, date: d, minutes };
  });
}
function totalMinutes(sessions = data.sessions) { return sessions.reduce((sum, s) => sum + Math.max(0, Number(s.minutes) || 0), 0); }
function getStreak() {
  const days = new Set(data.sessions.filter(s => (Number(s.minutes) || 0) > 0).map(s => s.date));
  let cursor = localDate();
  if (!days.has(cursor)) cursor = dayOffset(cursor, -1);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) { streak += 1; cursor = dayOffset(cursor, -1); }
  return streak;
}
function getWeeklyMinutes() { const week = new Set(getWeekSessions().map(d => d.key)); return totalMinutes(data.sessions.filter(s => week.has(s.date))); }
function taskProgress() { const total = data.tasks.length, done = data.tasks.filter(t => t.done).length; return { total, done, percent: total ? Math.round(done / total * 100) : 0 }; }
function subjectsSelect(selected = 'Toán', name = 'subject', extraClass = 'field-control') {
  return `<select id="${escapeAttr(name)}" class="${extraClass}" name="${escapeAttr(name)}">${SUBJECTS.map(s => `<option${s === selected ? ' selected' : ''}>${escapeHTML(s)}</option>`).join('')}</select>`;
}
function priorityMeta(priority) {
  const map = { high: ['Cao', 'priority-high'], medium: ['Vừa', 'priority-medium'], low: ['Thấp', 'priority-low'] };
  return map[priority] || map.medium;
}
function taskRow(task, tools = true) {
  const [priorityText, priorityClass] = priorityMeta(task.priority);
  let safeSourceUrl = '';
  if (task.sourceUrl) { try { safeSourceUrl = normalizeResourceUrl(task.sourceUrl); } catch { safeSourceUrl = ''; } }
  const dueText = task.due ? dateLabel(task.due, { day: 'numeric', month: 'short' }) : 'Chưa đặt hạn';
  const overdue = task.due && task.due < localDate() && !task.done;
  return `<div class="task-row${task.done ? ' is-done' : ''}" data-task-id="${escapeAttr(task.id)}">
    <button class="task-check" data-action="task-toggle" data-id="${escapeAttr(task.id)}" aria-label="${task.done ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}" aria-pressed="${task.done ? 'true' : 'false'}">✓</button>
    <div class="task-main"><span class="task-title">${escapeHTML(task.title)}</span><div class="task-meta"><span class="subject-pill">${escapeHTML(task.subject)}</span><span class="priority-pill ${priorityClass}">${priorityText}</span><span style="color:${overdue ? 'var(--danger)' : 'var(--muted)'}">◷ ${overdue ? 'Quá hạn · ' : ''}${escapeHTML(dueText)}</span>${safeSourceUrl ? `<a class="source-task-link" href="${escapeAttr(safeSourceUrl)}" target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a>` : ''}</div></div>
    ${tools ? `<div class="task-side-actions"><button class="tiny-icon-button" data-action="task-edit" data-id="${escapeAttr(task.id)}" aria-label="Sửa nhiệm vụ" title="Sửa">✎</button><button class="tiny-icon-button delete" data-action="task-delete" data-id="${escapeAttr(task.id)}" aria-label="Xóa nhiệm vụ" title="Xóa">×</button></div>` : ''}
  </div>`;
}
function emptyState(symbol, title, copy, actionLabel = '', action = '') {
  return `<div class="empty-state"><span class="empty-symbol">${symbol}</span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(copy)}</p>${actionLabel ? `<button class="button button-quiet" data-action="${escapeAttr(action)}">${escapeHTML(actionLabel)}</button>` : ''}</div>`;
}
function taskList(tasks, tools = true, empty = true) {
  const rows = sortedTasks(tasks);
  if (!rows.length) return empty ? emptyState('✓', 'Không có nhiệm vụ ở đây', 'Thêm bài tập mới để biến kế hoạch thành hành động.', 'Thêm nhiệm vụ', 'task-new') : '';
  return `<div class="task-list">${rows.map(t => taskRow(t, tools)).join('')}</div>`;
}
function weekChartMarkup(week) {
  const max = Math.max(30, ...week.map(d => d.minutes));
  return `<div class="week-chart" role="img" aria-label="Thời gian tập trung trong 7 ngày gần nhất">${week.map(day => {
    const height = day.minutes ? Math.max(6, day.minutes / max * 100) : 0;
    return `<div class="week-day${day.key === localDate() ? ' today' : ''}"><div class="week-bar-track"><i class="week-bar" style="height:${height}%" title="${day.minutes} phút"></i></div><span>${['T2','T3','T4','T5','T6','T7','CN'][day.date.getDay() === 0 ? 6 : day.date.getDay() - 1]}</span></div>`;
  }).join('')}</div>`;
}
function getDueCards() {
  const today = localDate();
  return data.cards.filter(card => !card.nextReviewAt || card.nextReviewAt <= today);
}
function getDailyChallenge() {
  const today = localDate();
  const dayNumber = Math.floor(new Date(`${today}T12:00:00`).getTime() / 86400000);
  return DAILY_CHALLENGES[((dayNumber % DAILY_CHALLENGES.length) + DAILY_CHALLENGES.length) % DAILY_CHALLENGES.length];
}
function getSmartStudyPlan() {
  const today = localDate();
  const plan = [];
  const add = (item, key) => {
    if (!item || plan.some(existing => existing.key === key)) return;
    plan.push({ ...item, key });
  };
  const overdue = sortedTasks(data.tasks.filter(task => !task.done && task.due && task.due < today));
  if (overdue.length) {
    const task = overdue[0];
    add({ title: task.title, detail: `Ưu tiên xử lý nhiệm vụ quá hạn · ${task.subject}.`, action: 'task-edit', id: task.id, cta: 'Mở nhiệm vụ' }, `task-${task.id}`);
  }
  const dueToday = sortedTasks(data.tasks.filter(task => !task.done && task.due === today));
  if (dueToday.length) {
    const task = dueToday[0];
    add({ title: task.title, detail: `Đến hạn hôm nay · mức ưu tiên ${task.priority === 'high' ? 'cao' : task.priority === 'low' ? 'thấp' : 'vừa'}.`, action: 'task-edit', id: task.id, cta: 'Xem chi tiết' }, `task-${task.id}`);
  }
  const highPriority = sortedTasks(data.tasks.filter(task => !task.done && task.priority === 'high'));
  if (highPriority.length) {
    const task = highPriority[0];
    add({ title: task.title, detail: `Việc ưu tiên cao · ${task.subject}${task.due ? ` · hạn ${dateLabel(task.due)}` : ''}.`, action: 'task-edit', id: task.id, cta: 'Mở nhiệm vụ' }, `task-${task.id}`);
  }
  const dueCards = getDueCards();
  if (dueCards.length) {
    add({ title: `Ôn ${dueCards.length} thẻ đang đến hạn`, detail: 'Ôn chủ động giúp phát hiện kiến thức cần củng cố.', action: 'navigate', route: 'cards', cta: 'Bắt đầu ôn' }, 'review-cards');
  }
  const todayMinutes = totalMinutes(data.sessions.filter(session => session.date === today));
  const goal = Math.max(30, Number(data.settings.dailyGoal) || 90);
  if (todayMinutes < goal) {
    add({ title: 'Một phiên tập trung vừa sức', detail: `Còn ${fmtMinutes(goal - todayMinutes)} để chạm mục tiêu cá nhân hôm nay.`, action: 'navigate', route: 'focus', cta: 'Mở Focus' }, 'focus');
  }
  if (!data.cards.length) {
    add({ title: 'Tạo bộ thẻ ghi nhớ đầu tiên', detail: 'Chuyển một công thức hoặc từ vựng thành câu hỏi–đáp án.', action: 'card-new', cta: 'Tạo thẻ' }, 'create-cards');
  }
  const openTasks = sortedTasks(data.tasks.filter(task => !task.done && !task.due));
  if (openTasks.length) {
    const task = openTasks[0];
    add({ title: task.title, detail: `Nhiệm vụ chưa có hạn · ${task.subject}.`, action: 'task-edit', id: task.id, cta: 'Lập kế hoạch' }, `task-${task.id}`);
  }
  if (!plan.length) {
    add({ title: 'Lập kế hoạch cho bước tiếp theo', detail: 'Bạn đang có nhịp ổn định. Hãy chọn một mục tiêu nhỏ cho phiên học kế tiếp.', action: 'navigate', route: 'tasks', cta: 'Xem nhiệm vụ' }, 'fallback');
  }
  return plan.slice(0, 3);
}
function smartPlanMarkup() {
  return getSmartStudyPlan().map((item, index) => {
    const actionAttrs = item.action === 'navigate'
      ? `data-action="navigate" data-route="${escapeAttr(item.route)}"`
      : `data-action="${escapeAttr(item.action)}"${item.id ? ` data-id="${escapeAttr(item.id)}"` : ''}`;
    return `<div class="smart-plan-row"><span class="smart-plan-number">0${index + 1}</span><div class="smart-plan-copy"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.detail)}</p></div><button class="button button-quiet smart-plan-cta" ${actionAttrs}>${escapeHTML(item.cta)} →</button></div>`;
  }).join('');
}
function renderHome() {
  const minutesToday = totalMinutes(data.sessions.filter(s => s.date === localDate()));
  const weekly = getWeeklyMinutes();
  const progress = taskProgress();
  const goal = Number(data.settings.dailyGoal) || 90;
  const goalPct = Math.min(100, Math.round(minutesToday / goal * 100));
  const due = sortedTasks(tasksDueToday()).slice(0, 4);
  const week = getWeekSessions();
  const streak = getStreak();
  $('#viewContainer').innerHTML = `
    <div class="overview-hero"><div><div class="eyebrow"><span class="pulse-dot"></span> GÓC HỌC TẬP CỦA BẠN</div><h1>${getGreeting()}, ${escapeHTML(currentUser.displayName.split(' ')[0])} <span style="color:var(--accent)">✦</span></h1><p>Hãy chọn một việc quan trọng và bắt đầu từ đó. Bạn không cần làm tất cả cùng lúc.</p></div><div class="hero-date"><span class="date-icon">▦</span><div><strong>${escapeHTML(fullDateLabel().replace(/^./, x => x.toUpperCase()))}</strong><small>${due.length ? `${due.length} nhiệm vụ đến hạn hôm nay` : 'Chọn nhịp học vừa sức của bạn'}</small></div></div></div>
    <div class="metrics-grid">
      <article class="metric-card"><div class="metric-top"><span class="metric-label">Tập trung hôm nay</span><span class="metric-icon">◷</span></div><div class="metric-number">${Math.floor(minutesToday / 60)}<small>h</small> ${minutesToday % 60}<small>m</small></div><div class="metric-foot"><span class="positive">${goalPct}%</span> mục tiêu ngày</div></article>
      <article class="metric-card"><div class="metric-top"><span class="metric-label">Nhiệm vụ hoàn thành</span><span class="metric-icon">✓</span></div><div class="metric-number">${progress.done}<small> / ${progress.total}</small></div><div class="metric-foot">${progress.total ? `${progress.percent}% tổng nhiệm vụ` : 'Thêm bài tập để bắt đầu'}</div></article>
      <article class="metric-card"><div class="metric-top"><span class="metric-label">Thời gian tuần này</span><span class="metric-icon">▥</span></div><div class="metric-number">${Math.floor(weekly / 60)}<small>h</small> ${weekly % 60}<small>m</small></div><div class="metric-foot">Ghi nhận từ các phiên đã hoàn thành</div></article>
      <article class="metric-card"><div class="metric-top"><span class="metric-label">Chuỗi học tập</span><span class="metric-icon">✳</span></div><div class="metric-number">${streak}<small> ${streak === 1 ? 'ngày' : 'ngày'}</small></div><div class="metric-foot">${streak ? 'Bạn đang duy trì nhịp tốt' : 'Một phiên học sẽ mở đầu chuỗi mới'}</div></article>
    </div>
    <div class="dashboard-grid"><div class="dashboard-left">
      <section class="panel"><div class="panel-heading"><div><h2>Nhịp tập trung trong tuần</h2><p>Mỗi phiên học đều được ghi nhận ở đây.</p></div><button class="subtle-link" data-action="navigate" data-route="stats">Xem thống kê ↗</button></div>${weekChartMarkup(week)}</section>
      <section class="panel"><div class="panel-heading"><div><h2>Ưu tiên hôm nay</h2><p>${due.length ? 'Hoàn thành từng việc một, không cần vội.' : 'Chưa có bài tập đến hạn hôm nay.'}</p></div><button class="subtle-link" data-action="navigate" data-route="tasks">Tất cả nhiệm vụ ↗</button></div>${due.length ? `<div class="task-list">${due.map(t => taskRow(t)).join('')}</div>` : emptyState('＋', 'Tạo danh sách đầu tiên', 'Thêm việc cần làm, môn học và ngày đến hạn.', 'Thêm bài tập', 'task-new')}</section>
    </div><div class="dashboard-right">
      <section class="panel"><div class="panel-heading"><div><h2>Mục tiêu hôm nay</h2><p>Tiến bộ theo nhịp của bạn.</p></div><span class="panel-kicker">FOCUS</span></div><div class="goal-progress"><div class="ring-chart" style="--progress:${goalPct}%"><div class="ring-center"><strong>${goalPct}%</strong><small>hoàn thành</small></div></div><div class="goal-copy"><strong>${minutesToday >= goal ? 'Bạn đã đạt mục tiêu!' : `${fmtMinutes(Math.max(0, goal - minutesToday))} nữa là đủ`}</strong><p>Đặt mục tiêu ${fmtMinutes(goal)} mỗi ngày.</p><button class="subtle-link" data-action="navigate" data-route="settings">Điều chỉnh mục tiêu →</button></div></div></section>
      <section class="panel"><div class="panel-heading"><div><h2>Bắt đầu nhanh</h2><p>Chọn công cụ phù hợp với việc cần làm.</p></div></div><div class="quick-actions"><button class="quick-action" data-action="navigate" data-route="focus"><span class="quick-action-icon">◷</span><span><strong>Bắt đầu tập trung</strong><small>Pomodoro và thời gian nghỉ</small></span><b>→</b></button><button class="quick-action" data-action="task-new"><span class="quick-action-icon">＋</span><span><strong>Thêm bài tập</strong><small>Ghi lại việc cần hoàn thành</small></span><b>→</b></button><button class="quick-action" data-action="navigate" data-route="notes"><span class="quick-action-icon">✎</span><span><strong>Ghi chú nhanh</strong><small>Lưu ý tưởng và kiến thức</small></span><b>→</b></button><button class="quick-action" data-action="navigate" data-route="sources"><span class="quick-action-icon">▤</span><span><strong>Lưu nguồn học liệu</strong><small>Tài liệu, video, đề thi và website</small></span><b>→</b></button></div></section>
      <section class="panel smart-plan-panel"><div class="panel-heading"><div><h2>Lộ trình gợi ý hôm nay</h2><p>Tự sắp xếp từ bài đến hạn, thẻ cần ôn và mục tiêu học.</p></div><span class="panel-kicker">SMART PLAN</span></div><div class="smart-plan-list">${smartPlanMarkup()}</div></section>
      <div class="insight-box"><span class="insight-icon">✦</span><div><strong>Gợi ý nhỏ cho hôm nay</strong><p>Chọn một mục tiêu cụ thể cho phiên học tới. Sau đó nghỉ vài phút để nạp lại năng lượng.</p></div></div>
    </div></div>`;
}
function getGreeting() { const h = new Date().getHours(); return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'; }
function renderTasks() {
  let items = sortedTasks(data.tasks);
  if (searchQuery) items = items.filter(t => `${t.title} ${t.subject} ${t.priority}`.toLowerCase().includes(searchQuery.toLowerCase()));
  if (taskFilter === 'todo') items = items.filter(t => !t.done);
  else if (taskFilter === 'done') items = items.filter(t => t.done);
  else if (taskFilter === 'today') items = items.filter(t => t.due === localDate() && !t.done);
  $('#viewContainer').innerHTML = `<div class="page-heading"><div><div class="eyebrow">LẬP KẾ HOẠCH CÓ CHỦ ĐÍCH</div><h1>Bài tập & nhiệm vụ</h1><p>Đưa mọi việc ra khỏi đầu và đặt chúng vào một kế hoạch có thể thực hiện.</p></div><div class="heading-actions"><button class="button button-primary" data-action="task-new">＋ Thêm nhiệm vụ</button></div></div>
    <section class="panel"><div class="panel-heading"><div><h2>Danh sách nhiệm vụ</h2><p>${data.tasks.filter(t => !t.done).length} việc đang chờ · ${data.tasks.filter(t => t.done).length} việc đã xong</p></div><span class="panel-kicker">${data.tasks.length} TỔNG CỘNG</span></div>
    <div class="task-tools"><div class="segmented">${[['all','Tất cả'],['todo','Chưa xong'],['today','Hôm nay'],['done','Đã xong']].map(([value,label]) => `<button data-action="task-filter" data-filter="${value}" class="${taskFilter === value ? 'active' : ''}">${label}</button>`).join('')}</div><span class="task-count">Đang hiển thị ${items.length} nhiệm vụ</span></div>
    <div class="task-page-list">${items.length ? items.map(t => taskRow(t)).join('') : emptyState(searchQuery ? '⌕' : '✓', searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có mục nào ở đây', searchQuery ? 'Thử một từ khóa khác hoặc xóa nội dung tìm kiếm.' : 'Thêm bài tập đầu tiên để quản lý hạn nộp và mức độ ưu tiên.', searchQuery ? 'Xóa tìm kiếm' : 'Thêm nhiệm vụ', searchQuery ? 'search-clear' : 'task-new')}</div></section>`;
}
function renderSchedule() {
  const start = weekStart(); start.setDate(start.getDate() + scheduleOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return { date: d, key: localDate(d) }; });
  const first = days[0].date.toLocaleDateString('vi-VN', { day:'numeric', month:'short' });
  const last = days[6].date.toLocaleDateString('vi-VN', { day:'numeric', month:'short', year:'numeric' });
  const labels = ['T2','T3','T4','T5','T6','T7','CN'];
  $('#viewContainer').innerHTML = `<div class="page-heading"><div><div class="eyebrow">NHÌN TRƯỚC, CHỦ ĐỘNG HƠN</div><h1>Lịch học</h1><p>Lịch tuần giúp bạn thấy hạn nộp và phân bổ công việc hợp lý hơn.</p></div><div class="heading-actions"><button class="button button-primary" data-action="task-new">＋ Thêm vào lịch</button></div></div>
    <section class="panel calendar-panel"><div class="panel-heading"><div><h2>Lịch tuần</h2><p>${first} — ${last}</p></div><div class="calendar-toolbar"><button class="icon-button" data-action="week-prev" aria-label="Tuần trước">‹</button><button class="button button-quiet" data-action="week-today">Tuần này</button><button class="icon-button" data-action="week-next" aria-label="Tuần sau">›</button></div></div>
    <div class="calendar-grid">${days.map((day,i) => {
      const events = sortedTasks(data.tasks.filter(t => t.due === day.key));
      return `<div class="calendar-day${day.key === localDate() ? ' is-today' : ''}"><div class="calendar-day-head"><span>${labels[i]}</span><strong>${day.date.getDate()}</strong></div>${events.length ? events.map(t => `<button class="calendar-event" data-action="task-edit" data-id="${escapeAttr(t.id)}" title="Sửa ${escapeAttr(t.title)}">${t.done ? '✓ ' : ''}${escapeHTML(t.title)}<small>${escapeHTML(t.subject)}${t.done ? ' · Đã xong' : ''}</small></button>`).join('') : '<div class="calendar-empty">— trống —</div>'}</div>`;
    }).join('')}</div>
    <div style="display:flex;gap:15px;flex-wrap:wrap;margin-top:17px;color:var(--muted);font-size:.65rem"><span>▰ Hạn bài tập được đặt trong ngày</span><span>Nhấn vào một mục để chỉnh sửa.</span></div></section>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><div><h2>Việc chưa đặt ngày</h2><p>Thêm hạn hoàn thành để đưa nhiệm vụ vào lịch tuần.</p></div></div>${taskList(data.tasks.filter(t => !t.done && !t.due), true)}</section>`;
}
function renderFocus() {
  const today = data.sessions.filter(s => s.date === localDate());
  const minutesToday = totalMinutes(today);
  const progress = focusState.duration ? Math.max(0, Math.min(100, focusState.remaining / focusState.duration * 100)) : 100;
  $('#viewContainer').innerHTML = `<div class="page-heading"><div><div class="eyebrow">MỘT VIỆC · MỘT KHOẢNG THỜI GIAN</div><h1>Focus timer</h1><p>Dùng Pomodoro để chia buổi học thành những khoảng tập trung vừa sức.</p></div></div>
    <div class="focus-layout"><section class="panel focus-main-panel"><span class="panel-kicker">${focusState.running ? 'ĐANG TẬP TRUNG' : focusState.remaining !== focusState.duration ? 'PHIÊN ĐANG TẠM DỪNG' : 'KHOẢNG TẬP TRUNG'}</span><h2 class="focus-title">Dành thời gian cho điều quan trọng.</h2><p class="focus-subtitle">Đặt điện thoại sang một bên và bắt đầu thật nhẹ nhàng.</p>
      <div class="timer-ring" id="timerRing" style="--timer-progress:${progress}%"><div class="timer-inner"><div id="timerDisplay" class="timer-time">${fmtClock(focusState.remaining)}</div><div id="timerState" class="timer-state">${focusState.running ? 'ĐANG CHẠY' : 'SẴN SÀNG'}</div></div></div>
      <div class="timer-controls"><button class="button button-primary button-large timer-main-button" data-action="focus-toggle" id="focusToggle">${focusState.running ? 'Ⅱ Tạm dừng' : (focusState.hasStarted ? '▶ Tiếp tục' : '▶ Bắt đầu')}</button><button class="button button-quiet" data-action="focus-finish" ${!focusState.hasStarted ? 'disabled' : ''}>Hoàn thành</button><button class="icon-button" data-action="focus-reset" title="Đặt lại" aria-label="Đặt lại timer">↻</button></div>
      <div class="duration-chips">${[[15,'15 phút'],[25,'25 phút'],[45,'45 phút'],[60,'60 phút']].map(([mins,label]) => `<button class="duration-chip${focusState.duration === mins*60 ? ' active' : ''}" data-action="focus-duration" data-minutes="${mins}" ${focusState.running ? 'disabled' : ''}>${label}</button>`).join('')}</div>
    </section><div class="focus-side"><section class="panel"><div class="panel-heading"><div><h2>Phiên học của bạn</h2><p>Chọn môn để ghi lại chính xác hơn.</p></div></div><div class="focus-subject"><label for="focusSubject">Môn học</label>${subjectsSelect(focusState.subject, 'focusSubject')}</div><div class="focus-stat-row" style="margin-top:14px"><div class="focus-stat"><strong>${today.length}</strong><small>Phiên hoàn thành hôm nay</small></div><div class="focus-stat"><strong>${fmtMinutes(minutesToday)}</strong><small>Tổng thời gian hôm nay</small></div></div></section>
      <section class="panel"><div class="panel-heading"><div><h2>Nhịp học hiệu quả</h2><p>Gợi ý để phiên học nhẹ nhàng hơn.</p></div><span class="panel-kicker">TIPS</span></div><div class="focus-tip-list"><div class="focus-tip"><span>01</span><div><strong>Chọn một mục tiêu nhỏ</strong><p>Viết rõ điều bạn muốn hoàn thành trước khi bấm bắt đầu.</p></div></div><div class="focus-tip"><span>02</span><div><strong>Nghỉ khi cần thiết</strong><p>Đứng dậy, uống nước và nhìn ra xa giữa các phiên.</p></div></div><div class="focus-tip"><span>03</span><div><strong>Ghi nhận nỗ lực thật</strong><p>Thời gian sẽ được thống kê khi bạn hoàn thành phiên.</p></div></div></div></section>
    </div></div>`;
}
function renderNotes() {
  const cards = [...data.notes].sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  $('#viewContainer').innerHTML = `<div class="page-heading"><div><div class="eyebrow">GHI LẠI ĐỂ NHỚ LÂU HƠN</div><h1>Sổ ghi chú</h1><p>Lưu ý tưởng, tóm tắt bài học hoặc công thức quan trọng trong một nơi.</p></div><div class="heading-actions"><button class="button button-primary" data-action="note-new">＋ Tạo ghi chú</button></div></div>
  <div class="notes-grid">${cards.map(note => `<article class="note-card"><div class="note-card-top"><span class="subject-pill">${escapeHTML(note.subject || 'Khác')}</span><div class="note-card-actions"><button class="tiny-icon-button" data-action="note-edit" data-id="${escapeAttr(note.id)}" title="Sửa ghi chú" aria-label="Sửa">✎</button><button class="tiny-icon-button delete" data-action="note-delete" data-id="${escapeAttr(note.id)}" title="Xóa ghi chú" aria-label="Xóa">×</button></div></div><h3>${escapeHTML(note.title)}</h3><p>${escapeHTML(note.content)}</p><div class="note-card-bottom"><span>Cập nhật ${escapeHTML(note.updatedAt ? dateLabel(note.updatedAt.slice(0,10), {day:'numeric',month:'short'}) : 'vừa xong')}</span><span>✦ Lynquora</span></div></article>`).join('')}
  <button class="note-create" data-action="note-new"><span>＋</span><strong>Tạo ghi chú mới</strong><small>Lưu một điều bạn muốn nhớ</small></button></div>${cards.length ? '' : `<div style="margin-top:13px">${emptyState('✎','Bắt đầu sổ ghi chú của bạn','Viết lại một công thức, từ vựng hoặc ý tưởng ngay khi bạn nghĩ đến.','Tạo ghi chú đầu tiên','note-new')}</div>`}`;
}
function cardReviewLabel(card) {
  if (!card.nextReviewAt || card.nextReviewAt <= localDate()) return 'Đến hạn ôn';
  return `Ôn lại ${dateLabel(card.nextReviewAt, { day: 'numeric', month: 'short' })}`;
}
function markCardReviewed(rating) {
  const cards = data?.cards || [];
  const current = cards.length ? cards[((reviewIndex % cards.length) + cards.length) % cards.length] : null;
  if (!current) return;
  const now = new Date().toISOString();
  if (rating === 'hard') {
    current.reviewStreak = 0;
    current.intervalDays = 1;
  } else {
    const streak = Math.max(0, Number(current.reviewStreak) || 0) + 1;
    const intervals = [1, 3, 7, 14, 30];
    current.reviewStreak = streak;
    current.intervalDays = intervals[Math.min(streak - 1, intervals.length - 1)];
  }
  current.lastReviewedAt = now;
  current.nextReviewAt = dayOffset(localDate(), Math.max(1, Math.min(30, Number(current.intervalDays) || 1)));
  saveData();
  renderView();
  showToast(rating === 'hard' ? 'Đã lên lịch ôn lại thẻ này vào ngày mai.' : `Tốt lắm! Thẻ này sẽ quay lại sau ${current.intervalDays} ngày.`);
}
function renderCards() {
  const cards = data.cards;
  const current = cards.length ? cards[((reviewIndex % cards.length) + cards.length) % cards.length] : null;
  const dueCount = getDueCards().length;
  $('#viewContainer').innerHTML = `<div class="page-heading"><div><div class="eyebrow">ACTIVE RECALL · ÔN CHỦ ĐỘNG</div><h1>Thẻ ghi nhớ</h1><p>Tự nhớ câu trả lời trước khi lật thẻ; đánh giá độ khó để lên lịch ôn lại thông minh.</p></div><div class="heading-actions"><button class="button button-primary" data-action="card-new">＋ Tạo thẻ</button></div></div>
  <div class="review-schedule-banner"><span class="review-schedule-symbol">↻</span><div><strong>${dueCount ? `${dueCount} thẻ đến hạn ôn` : 'Bạn đã ôn hết các thẻ đến hạn hôm nay'}</strong><p>Chọn “Khó nhớ” để ôn lại ngày mai hoặc “Đã nhớ” để giãn khoảng cách ôn dần đến 30 ngày.</p></div><span class="review-due-count">${dueCount} <small>đến hạn</small></span></div>
  <div class="flashcard-review">${cards.length ? `<div class="review-subject">BỘ THẺ CỦA BẠN · ${cards.length} THẺ · ${escapeHTML(current.subject || 'Khác')} · <span class="review-card-due-label">${escapeHTML(cardReviewLabel(current))}</span></div><div class="flashcard-scene"><div id="reviewCard" class="flashcard" data-action="review-flip" role="button" tabindex="0" aria-label="Lật thẻ ghi nhớ"><span class="card-side-label">${reviewFlipped ? 'MẶT SAU · ĐÁP ÁN' : 'MẶT TRƯỚC · CÂU HỎI'}</span><span class="card-side-text">${escapeHTML(reviewFlipped ? current.back : current.front)}</span><span class="card-flip-tip">${reviewFlipped ? 'Bạn đã xem đáp án · Nhấn để quay lại' : 'Thử trả lời trước khi lật thẻ ↻'}</span></div></div><div class="review-controls"><button class="button button-quiet" data-action="review-prev">← Thẻ trước</button><span class="review-counter">${(reviewIndex % cards.length) + 1} / ${cards.length}</span><button class="button button-primary" data-action="review-next">Thẻ tiếp theo →</button></div>${reviewFlipped ? `<div class="review-rating-actions"><span>Bạn nhớ đáp án đến mức nào?</span><div><button class="button button-quiet" data-action="review-rating" data-rating="hard">↻ Khó nhớ · ôn ngày mai</button><button class="button button-primary" data-action="review-rating" data-rating="good">✓ Đã nhớ</button></div></div>` : ''}<div style="margin-top:18px"><button class="subtle-link" data-action="navigate" data-route="quiz">Tạo quiz từ bộ thẻ này ↗</button></div>` : emptyState('◇','Chưa có thẻ ghi nhớ','Tạo thẻ câu hỏi và đáp án để chủ động ôn lại từng khái niệm.','Tạo thẻ đầu tiên','card-new')}
  ${cards.length ? `<section class="panel" style="margin-top:27px;text-align:left"><div class="panel-heading"><div><h2>Thẻ đã tạo</h2><p>Chỉnh sửa hoặc xóa thẻ; nhãn cho biết lịch ôn tiếp theo.</p></div></div><div class="task-list">${cards.map(card => `<div class="task-row"><span class="metric-icon">◇</span><div class="task-main"><span class="task-title">${escapeHTML(card.front)}</span><div class="task-meta"><span>${escapeHTML(card.subject || 'Khác')}</span><span>→ ${escapeHTML(card.back)}</span><span class="review-list-status">${escapeHTML(cardReviewLabel(card))}</span></div></div><div class="task-side-actions"><button class="tiny-icon-button" data-action="card-edit" data-id="${escapeAttr(card.id)}" aria-label="Sửa thẻ">✎</button><button class="tiny-icon-button delete" data-action="card-delete" data-id="${escapeAttr(card.id)}" aria-label="Xóa thẻ">×</button></div></div>`).join('')}</div></section>` : ''}</div>`;
}
function startQuiz() {
  if (data.cards.length < 2) { showToast('Hãy tạo ít nhất 2 thẻ ghi nhớ để bắt đầu quiz.', 'error'); return; }
  quizState = { questions: [...data.cards].sort(() => Math.random() - .5).map(card => {
    // Keep each option tied to its source card so duplicate answers remain unambiguous.
    const distractors = data.cards.filter(other => other.id !== card.id).sort(() => Math.random() - .5).slice(0, 3);
    const choices = [...distractors.map(other => ({ id: other.id, text: other.back })), { id: card.id, text: card.back }].sort(() => Math.random() - .5);
    return { ...card, choices, correct: choices.findIndex(choice => choice.id === card.id) };
  }), index: 0, score: 0, answered: false, finished: false, selected: -1 };
  currentRoute = 'quiz'; updateActiveTokens(); renderQuiz();
}
function renderQuiz() {
  const q = quizState.questions[quizState.index];
  if (!quizState.questions.length) {
    $('#viewContainer').innerHTML = `<div class="page-heading"><div><div class="eyebrow">ÔN TẬP CÓ TƯƠNG TÁC</div><h1>Quiz ôn tập</h1><p>Tạo câu hỏi trắc nghiệm tự động từ các thẻ ghi nhớ của bạn.</p></div></div><section class="panel">${emptyState('✳','Bắt đầu với bộ thẻ ghi nhớ','Bạn cần ít nhất 2 thẻ ghi nhớ. Mỗi thẻ sẽ trở thành một câu hỏi với lựa chọn từ các thẻ khác.','Tạo thẻ ghi nhớ','navigate-cards')}</section>`;
    return;
  }
  if (quizState.finished) {
    const pct = Math.round(quizState.score / quizState.questions.length * 100);
    $('#viewContainer').innerHTML = `<div class="page-heading"><div><div class="eyebrow">HOÀN THÀNH LƯỢT ÔN TẬP</div><h1>Kết quả của bạn</h1><p>Điều quan trọng nhất là biết phần nào cần ôn lại tiếp.</p></div></div><section class="panel quiz-shell"><div class="quiz-result"><div class="result-symbol">${pct >= 80 ? '✦' : pct >= 50 ? '◇' : '↻'}</div><div class="panel-kicker">QUIZ ĐÃ KẾT THÚC</div><h2>${quizState.score}/${quizState.questions.length} câu đúng</h2><p>${pct >= 80 ? 'Rất tốt! Hãy thử lại sau để củng cố kiến thức.' : pct >= 50 ? 'Bạn đã có nền tảng. Ôn thêm những thẻ chưa nhớ nhé.' : 'Không sao cả — mỗi lượt ôn đều giúp bạn nhớ thêm một chút.'}</p><div class="goal-progress" style="justify-content:center"><div class="ring-chart" style="--progress:${pct}%"><div class="ring-center"><strong>${pct}%</strong><small>chính xác</small></div></div></div><div class="review-controls" style="margin-top:20px"><button class="button button-quiet" data-action="navigate" data-route="cards">Xem lại thẻ</button><button class="button button-primary" data-action="quiz-start">Làm lượt mới ↻</button></div></div></section>`;
    return;
  }
  const progress = Math.round(quizState.index / quizState.questions.length * 100);
  $('#viewContainer').innerHTML = `<div class="page-heading"><div><div class="eyebrow">ÔN TẬP CÓ TƯƠNG TÁC</div><h1>Quiz ôn tập</h1><p>Chọn một đáp án phù hợp nhất, sau đó xem kết quả ngay.</p></div><div class="heading-actions"><button class="button button-quiet" data-action="navigate" data-route="cards">← Quay lại thẻ</button></div></div><div class="quiz-shell"><div class="panel-heading"><span class="panel-kicker">CÂU ${quizState.index + 1} / ${quizState.questions.length}</span><span class="task-count">Đúng ${quizState.score} câu</span></div><div class="quiz-progress"><span style="width:${progress}%"></span></div><section class="quiz-question-card"><div class="panel-kicker">${escapeHTML(q.subject || 'ÔN TẬP')}</div><h2>${escapeHTML(q.front)}</h2><div class="quiz-option-list">${q.choices.map((choice,i) => {
    let cls = '';
    if (quizState.answered && i === q.correct) cls = ' style="border-color:var(--green);background:color-mix(in srgb,var(--green) 10%,var(--surface));"';
    else if (quizState.answered && i === quizState.selected) cls = ' style="border-color:var(--danger);background:color-mix(in srgb,var(--danger) 9%,var(--surface));"';
    return `<button class="quiz-option" data-action="quiz-answer" data-index="${i}" ${quizState.answered ? 'disabled' : ''}${cls}><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${escapeHTML(typeof choice === 'string' ? choice : choice.text)}</span></button>`;
  }).join('')}</div>${quizState.answered ? `<div class="quiz-feedback">${quizState.selected === q.correct ? '✓ Chính xác! Hãy tiếp tục giữ nhịp.' : `↻ Chưa chính xác. Đáp án là: ${escapeHTML(q.back)}`}</div><div class="modal-form-actions"><button class="button button-primary" data-action="quiz-next">${quizState.index + 1 === quizState.questions.length ? 'Xem kết quả →' : 'Câu tiếp theo →'}</button></div>` : ''}</section></div>`;
}
function renderStats() {
  const week = getWeekSessions();
  const minutesWeek = totalMinutes(week.length ? data.sessions.filter(s => week.some(d => d.key === s.date)) : []);
  const minutesToday = totalMinutes(data.sessions.filter(s => s.date === localDate()));
  const progress = taskProgress();
  const bySubject = SUBJECTS.map(subject => ({ subject, minutes: totalMinutes(data.sessions.filter(s => s.subject === subject)) })).filter(x => x.minutes > 0).sort((a,b) => b.minutes - a.minutes);
  const maxSubject = Math.max(1, ...bySubject.map(s => s.minutes));
  const goal = Number(data.settings.dailyGoal) || 90;
  $('#viewContainer').innerHTML = `<div class="page-heading"><div><div class="eyebrow">NHÌN LẠI ĐỂ TIẾN BỘ</div><h1>Thống kê học tập</h1><p>Thống kê được tính từ các phiên timer đã hoàn thành và nhiệm vụ bạn đánh dấu.</p></div><div class="heading-actions"><button class="button button-quiet" data-action="navigate" data-route="settings">Mục tiêu & dữ liệu ⚙</button></div></div>
  <div class="stats-summary"><article class="stats-tile"><div class="tile-label">Tổng thời gian tuần này</div><strong>${fmtMinutes(minutesWeek)}</strong><small>${Math.floor(minutesWeek / 60)} giờ ${minutesWeek % 60} phút tập trung</small></article><article class="stats-tile"><div class="tile-label">Hôm nay</div><strong>${fmtMinutes(minutesToday)}</strong><small>${goal ? Math.min(100, Math.round(minutesToday / goal * 100)) : 0}% mục tiêu ngày</small></article><article class="stats-tile"><div class="tile-label">Nhiệm vụ đã hoàn thành</div><strong>${progress.done}<small> / ${progress.total}</small></strong><small>${progress.percent}% nhiệm vụ hiện có</small></article></div>
  <div class="stats-columns"><div class="dashboard-left"><section class="panel"><div class="panel-heading"><div><h2>Thời gian theo ngày</h2><p>Biểu đồ 7 ngày, tính theo số phút đã ghi nhận.</p></div><span class="panel-kicker">MIN / NGÀY</span></div>${weekChartMarkup(week)}<div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--muted);padding-top:8px"><span>Trung bình: ${fmtMinutes(Math.round(minutesWeek / 7))}/ngày</span><span>Cao nhất: ${fmtMinutes(Math.max(0, ...week.map(d => d.minutes)))}</span></div></section>
  <section class="panel"><div class="panel-heading"><div><h2>Thời gian theo môn học</h2><p>Tổng thời gian từ những phiên học đã hoàn thành.</p></div></div>${bySubject.length ? `<div class="subject-stat-list">${bySubject.map(s => `<div><div class="subject-stat-top"><span>${escapeHTML(s.subject)}</span><span>${fmtMinutes(s.minutes)}</span></div><div class="subject-track"><i style="width:${Math.max(3,s.minutes / maxSubject * 100)}%"></i></div></div>`).join('')}</div>` : emptyState('▥','Chưa có dữ liệu theo môn','Hoàn thành một phiên Focus timer có chọn môn học để bắt đầu thống kê.')}</section></div>
  <div class="dashboard-right"><section class="panel"><div class="panel-heading"><div><h2>Tình hình nhiệm vụ</h2><p>Tính trên danh sách hiện tại.</p></div></div><div class="goal-progress"><div class="ring-chart" style="--progress:${progress.percent}%"><div class="ring-center"><strong>${progress.percent}%</strong><small>đã xong</small></div></div><div class="goal-copy"><strong>${progress.done} / ${progress.total} việc</strong><p>${progress.total - progress.done} nhiệm vụ còn lại.</p><button class="subtle-link" data-action="navigate" data-route="tasks">Mở danh sách →</button></div></div></section>
  <section class="panel"><div class="panel-heading"><div><h2>Mục tiêu ngày</h2><p>Không cần so sánh với người khác.</p></div></div><div class="goal-progress"><div class="ring-chart" style="--progress:${Math.min(100, minutesToday / goal * 100)}%"><div class="ring-center"><strong>${Math.min(100, Math.round(minutesToday / goal * 100))}%</strong><small>hoàn thành</small></div></div><div class="goal-copy"><strong>${fmtMinutes(minutesToday)} / ${fmtMinutes(goal)}</strong><p>${minutesToday >= goal ? 'Bạn đã chạm mục tiêu hôm nay.' : `Còn ${fmtMinutes(goal - minutesToday)} để đạt mục tiêu.`}</p><button class="subtle-link" data-action="navigate" data-route="settings">Sửa mục tiêu →</button></div></div></section>
  <div class="privacy-note"><span>ⓘ</span><div><strong>Hiểu đúng số liệu</strong><p>Timer được ghi nhận khi bạn hoàn thành phiên. Nếu bạn học ngoài website, hãy tự ghi lại thời gian bằng một phiên mới để thống kê không bị thiếu.</p></div></div></div></div>`;
}
function renderEntertainment() {
  const challenge = getDailyChallenge();
  const challengeDone = data.settings.dailyChallengeDoneOn === localDate();
  const dueCards = getDueCards().length;
  const todayMinutes = totalMinutes(data.sessions.filter(session => session.date === localDate()));
  const goal = Math.max(30, Number(data.settings.dailyGoal) || 90);
  const remaining = breakState.running ? Math.max(0, Math.ceil((breakState.endAt - Date.now()) / 1000)) : breakState.remaining;
  const idea = BREAK_IDEAS[(breakIdeaIndex < 0 ? 0 : breakIdeaIndex) % BREAK_IDEAS.length];
  $('#viewContainer').innerHTML = `
    <div class="page-heading"><div><div class="eyebrow">CHƠI CÓ CHỦ ĐÍCH · NGHỈ CÓ KẾ HOẠCH</div><h1>Giải trí & nghỉ ngơi</h1><p>Một khoảng nghỉ đúng lúc giúp bạn quay lại học tập dễ dàng hơn. Chọn trò chơi, đặt giới hạn thời gian và trở lại khi sẵn sàng.</p></div></div>
    <div class="entertainment-grid">
      <section class="game-hero-card">
        <div class="game-card-art" aria-hidden="true"><div class="game-art-orbit orbit-a"></div><div class="game-art-orbit orbit-b"></div><div class="game-art-core"><span>EC</span></div><span class="game-art-label label-top">ECHO / 01</span><span class="game-art-label label-bottom">SIGNAL DETECTED</span><i class="game-art-scan"></i></div>
        <div class="game-card-content"><div class="game-card-kicker"><span class="pulse-dot"></span> GAME CỦA BẠN · HTML5</div><h2>Echo Collapse</h2><p class="game-card-description">Bước vào mê cung sinh tồn bí ẩn, giải đố và khám phá các tầng sâu. Đây là đường dẫn trực tiếp đến trang game của bạn trên itch.io.</p><div class="game-tags"><span>Survival</span><span>Puzzle</span><span>Dark atmosphere</span></div><a class="button button-primary game-launch" href="https://blackdragon-xd.itch.io/echo-collapse" target="_blank" rel="noopener noreferrer">Chơi Echo Collapse <span>↗</span></a><p class="game-card-footnote">Mở ở tab mới · Hãy đặt thời lượng giải trí trước khi chơi.</p></div>
      </section>
      <section class="panel break-panel"><div class="panel-heading"><div><h2>Hẹn giờ nghỉ ngắn</h2><p>Chọn một khoảng nghỉ, không cần canh đồng hồ.</p></div><span class="panel-kicker">RESET</span></div><div class="break-timer-face"><div class="break-timer-ring" style="--break-progress:${breakState.duration ? remaining / breakState.duration * 100 : 100}%"><div><strong id="breakTimerDisplay">${fmtClock(remaining)}</strong><small id="breakTimerStatus">${breakState.running ? 'ĐANG ĐẾM NGƯỢC' : remaining === 0 ? 'ĐÃ HẾT GIỜ' : 'SẴN SÀNG NGHỈ'}</small></div></div></div><div class="break-presets">${[3,5,10,15].map(n => `<button class="break-preset${breakState.preset === n ? ' active' : ''}" data-action="break-preset" data-minutes="${n}" ${breakState.running ? 'disabled' : ''}>${n} phút</button>`).join('')}</div><div class="break-timer-actions"><button id="breakToggle" class="button button-primary" data-action="break-toggle">${breakState.running ? 'Ⅱ Tạm dừng' : remaining !== breakState.duration && remaining > 0 ? '▶ Tiếp tục' : '▶ Bắt đầu nghỉ'}</button><button class="button button-quiet" data-action="break-reset">Đặt lại</button></div><p class="break-timer-note">Khi hết giờ, website sẽ nhắc bạn quay lại kế hoạch — không có âm thanh gây giật mình.</p></section>
      <section class="panel break-idea-panel"><div class="panel-heading"><div><h2>Gợi ý nghỉ không màn hình</h2><p>Ý tưởng nhỏ để ngắt nhịp một chút.</p></div><span class="panel-kicker">RESET IDEAS</span></div><div class="break-idea-card"><div class="break-idea-icon">☼</div><p id="breakIdeaText">${escapeHTML(idea)}</p><button class="button button-quiet" data-action="break-idea">Đổi gợi ý ↻</button></div></section>
      <section class="panel daily-challenge-panel"><div class="panel-heading"><div><h2>Thử thách nhỏ hôm nay</h2><p>Không cần hoàn hảo — hoàn thành một bước là đủ.</p></div><span class="panel-kicker">DAILY QUEST</span></div><div class="daily-challenge-body"><div class="daily-challenge-orb">✦</div><div class="daily-challenge-copy"><span class="challenge-day-label">${escapeHTML(fullDateLabel().replace(/^./, x => x.toUpperCase()))}</span><h3>${escapeHTML(challenge.title)}</h3><p>${escapeHTML(challenge.detail)}</p><div class="daily-challenge-actions"><button class="button ${challengeDone ? 'button-quiet' : 'button-primary'}" data-action="daily-challenge-toggle" ${challengeDone ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${challengeDone ? '✓ Đã hoàn thành hôm nay' : 'Đánh dấu hoàn thành'}</button><button class="subtle-link" data-action="${escapeAttr(challenge.action)}"${challenge.action === 'navigate' ? ` data-route="${escapeAttr(challenge.route)}"` : ''}>${escapeHTML(challenge.cta)} ↗</button></div></div></div></section>
      <section class="panel balance-panel"><div class="panel-heading"><div><h2>Cân bằng trong ngày</h2><p>Theo dõi tiến độ, không phải để gây áp lực.</p></div></div><div class="balance-stats"><div><span>Học tập hôm nay</span><strong>${fmtMinutes(todayMinutes)}</strong><div class="balance-track"><i style="width:${Math.min(100, Math.round(todayMinutes / goal * 100))}%"></i></div><small>${Math.min(100, Math.round(todayMinutes / goal * 100))}% mục tiêu ${fmtMinutes(goal)}</small></div><div><span>Thẻ ôn đến hạn</span><strong>${dueCards}</strong><small>${dueCards ? 'Có thể ôn ngay trong 5 phút.' : 'Đã xử lý các thẻ đang đến hạn.'}</small><button class="subtle-link" data-action="navigate" data-route="cards">Mở thẻ ghi nhớ →</button></div></div></section>
    </div>`;
  updateBreakTimerDisplay();
}
function updateBreakTimerDisplay() {
  const remaining = breakState.running ? Math.max(0, Math.ceil((breakState.endAt - Date.now()) / 1000)) : breakState.remaining;
  const display = $('#breakTimerDisplay');
  if (display) display.textContent = fmtClock(remaining);
  const status = $('#breakTimerStatus');
  if (status) status.textContent = breakState.running ? 'ĐANG ĐẾM NGƯỢC' : remaining === 0 ? 'ĐÃ HẾT GIỜ' : remaining !== breakState.duration ? 'ĐANG TẠM DỪNG' : 'SẴN SÀNG NGHỈ';
  const ring = $('.break-timer-ring');
  if (ring) ring.style.setProperty('--break-progress', `${breakState.duration ? remaining / breakState.duration * 100 : 100}%`);
  const toggle = $('#breakToggle');
  if (toggle) toggle.textContent = breakState.running ? 'Ⅱ Tạm dừng' : remaining !== breakState.duration && remaining > 0 ? '▶ Tiếp tục' : '▶ Bắt đầu nghỉ';
}
function setBreakPreset(minutes) {
  const preset = Number(minutes);
  if (![3, 5, 10, 15].includes(preset) || breakState.running) return;
  breakState = { preset, duration: preset * 60, remaining: preset * 60, running: false, endAt: 0 };
  renderEntertainment();
}
function toggleBreakTimer() {
  if (breakState.running) {
    breakState.remaining = Math.max(0, Math.ceil((breakState.endAt - Date.now()) / 1000));
    breakState.running = false; breakState.endAt = 0;
    if (breakInterval) clearInterval(breakInterval); breakInterval = null;
    updateBreakTimerDisplay();
    showToast('Đã tạm dừng giờ nghỉ.');
    return;
  }
  if (breakState.remaining <= 0) breakState.remaining = breakState.duration;
  breakState.running = true;
  breakState.endAt = Date.now() + breakState.remaining * 1000;
  if (breakInterval) clearInterval(breakInterval);
  breakInterval = window.setInterval(tickBreakTimer, 250);
  updateBreakTimerDisplay();
}
function tickBreakTimer() {
  if (!breakState.running) return;
  breakState.remaining = Math.max(0, Math.ceil((breakState.endAt - Date.now()) / 1000));
  updateBreakTimerDisplay();
  if (breakState.remaining <= 0) {
    breakState.running = false; breakState.endAt = 0;
    if (breakInterval) clearInterval(breakInterval); breakInterval = null;
    showToast('Hết giờ nghỉ — bạn có thể quay lại khi sẵn sàng.');
    if (currentRoute === 'entertainment') renderEntertainment();
  }
}
function resetBreakTimer() {
  if (breakInterval) clearInterval(breakInterval); breakInterval = null;
  breakState = { preset: breakState.preset, duration: breakState.preset * 60, remaining: breakState.preset * 60, running: false, endAt: 0 };
  updateBreakTimerDisplay();
  if (currentRoute === 'entertainment') renderEntertainment();
}
function cycleBreakIdea() {
  const next = Math.floor(Math.random() * BREAK_IDEAS.length);
  breakIdeaIndex = next === breakIdeaIndex ? (next + 1) % BREAK_IDEAS.length : next;
  const target = $('#breakIdeaText');
  if (target) target.textContent = BREAK_IDEAS[breakIdeaIndex];
}
function toggleDailyChallenge() {
  const today = localDate();
  data.settings.dailyChallengeDoneOn = data.settings.dailyChallengeDoneOn === today ? '' : today;
  saveData();
  renderEntertainment();
  showToast(data.settings.dailyChallengeDoneOn === today ? 'Đã ghi nhận thử thách hôm nay.' : 'Đã bỏ đánh dấu thử thách hôm nay.');
}
const SOURCE_TYPES = {
  website: { label: 'Website', icon: '↗' },
  video: { label: 'Video / bài giảng', icon: '▶' },
  document: { label: 'Tài liệu / PDF', icon: '▤' },
  exam: { label: 'Đề thi / bài tập', icon: '✎' },
  course: { label: 'Khóa học', icon: '◎' },
  other: { label: 'Khác', icon: '◇' }
};
const SOURCE_STATUSES = {
  unread: { label: 'Chưa đọc', tone: 'unread' },
  reading: { label: 'Đang đọc', tone: 'reading' },
  read: { label: 'Đã đọc', tone: 'read' }
};
function normalizeResourceUrl(raw) {
  let value = String(raw ?? '').trim();
  if (!value) throw new Error('Hãy nhập đường dẫn nguồn dữ liệu.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Đường dẫn không hợp lệ. Hãy kiểm tra địa chỉ website.'); }
  if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Chỉ chấp nhận liên kết HTTP/HTTPS hợp lệ, không chứa thông tin đăng nhập.');
  }
  return parsed.href;
}
function normalizeStoredResources(items) {
  const result = [], seenIds = new Set(), seenUrls = new Set();
  for (const item of items.slice(0, 20000)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const title = String(item.title || '').trim().slice(0, 180);
    if (!title) continue;
    let url; try { url = normalizeResourceUrl(item.url); } catch { continue; }
    const canonical = url.replace(/\/$/, '');
    if (seenUrls.has(canonical)) continue;
    seenUrls.add(canonical);
    let id = typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 100) : uid();
    while (seenIds.has(id)) id = uid();
    seenIds.add(id);
    const tags = Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? item.tags.split(',') : []);
    const safeTags = [...new Set(tags.map(tag => String(tag || '').trim().replace(/^#+/, '').slice(0, 28)).filter(Boolean))].slice(0, 12);
    result.push({
      id, title, url,
      type: ['website','video','document','exam','course','other'].includes(item.type) ? item.type : 'website',
      subject: SUBJECTS.includes(item.subject) ? item.subject : 'Khác',
      description: String(item.description || '').trim().slice(0, 1200), tags: safeTags,
      status: ['unread','reading','read'].includes(item.status) ? item.status : 'unread', favorite: item.favorite === true,
      quality: Math.max(1, Math.min(5, Number(item.quality) || 3)),
      createdAt: typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)) ? item.createdAt : new Date().toISOString(),
      updatedAt: typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) ? item.updatedAt : new Date().toISOString(),
      lastOpenedAt: typeof item.lastOpenedAt === 'string' && Number.isFinite(Date.parse(item.lastOpenedAt)) ? item.lastOpenedAt : ''
    });
  }
  return result;
}
function getFilteredSources() {
  const q = sourceSearchQuery.toLocaleLowerCase('vi');
  return [...(data?.resources || [])].filter(item => {
    const searchText = [item.title, item.url, item.description, item.subject, ...(item.tags || [])].join(' ').toLocaleLowerCase('vi');
    return (!q || searchText.includes(q)) &&
      (sourceTypeFilter === 'all' || item.type === sourceTypeFilter) &&
      (sourceStatusFilter === 'all' || item.status === sourceStatusFilter) &&
      (!sourceFavoritesOnly || item.favorite);
  }).sort((a, b) => Number(b.favorite) - Number(a.favorite) || (b.updatedAt || '').localeCompare(a.updatedAt || '') || a.title.localeCompare(b.title, 'vi'));
}
function sourceCardMarkup(source) {
  const type = SOURCE_TYPES[source.type] || SOURCE_TYPES.other;
  const status = SOURCE_STATUSES[source.status] || SOURCE_STATUSES.unread;
  const host = (() => { try { return new URL(source.url).hostname.replace(/^www\./, ''); } catch { return source.url; } })();
  const tags = (Array.isArray(source.tags) ? source.tags : []).map(tag => `<span class="source-tag">#${escapeHTML(tag)}</span>`).join('');
  const stars = '★'.repeat(Math.max(1, Math.min(5, Number(source.quality) || 3))) + '☆'.repeat(5 - Math.max(1, Math.min(5, Number(source.quality) || 3)));
  return `<article class="source-card" data-source-id="${escapeAttr(source.id)}">
    <div class="source-card-top"><span class="source-type-icon">${escapeHTML(type.icon)}</span><div class="source-card-top-meta"><span class="source-type-label">${escapeHTML(type.label)}</span><span class="source-domain">${escapeHTML(host)}</span></div><button class="source-favorite${source.favorite ? ' active' : ''}" data-action="source-favorite" data-id="${escapeAttr(source.id)}" aria-label="${source.favorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}" aria-pressed="${source.favorite ? 'true' : 'false'}" title="${source.favorite ? 'Đang yêu thích' : 'Đánh dấu yêu thích'}">${source.favorite ? '★' : '☆'}</button></div>
    <h3 class="source-title">${escapeHTML(source.title)}</h3>
    <div class="source-subject-line"><span class="subject-pill">${escapeHTML(source.subject || 'Khác')}</span><span class="source-rating" title="Đánh giá cá nhân ${Number(source.quality) || 3}/5">${stars}</span></div>
    ${source.description ? `<p class="source-description">${escapeHTML(source.description)}</p>` : '<p class="source-description source-description-empty">Chưa có mô tả. Thêm ghi chú để nhớ nguồn này hữu ích ở điểm nào.</p>'}
    ${tags ? `<div class="source-tags">${tags}</div>` : ''}
    <div class="source-card-status"><label for="status-${escapeAttr(source.id)}">Trạng thái</label><select id="status-${escapeAttr(source.id)}" data-source-status="${escapeAttr(source.id)}" aria-label="Trạng thái đọc của ${escapeAttr(source.title)}">${Object.entries(SOURCE_STATUSES).map(([key, value]) => `<option value="${key}"${source.status === key ? ' selected' : ''}>${value.label}</option>`).join('')}</select></div>
    <div class="source-card-actions"><a class="button button-primary source-open-link" href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">Mở nguồn ↗</a><button class="tiny-icon-button" data-action="source-copy" data-id="${escapeAttr(source.id)}" aria-label="Sao chép trích dẫn" title="Sao chép trích dẫn">⧉</button><button class="tiny-icon-button" data-action="source-create-task" data-id="${escapeAttr(source.id)}" aria-label="Tạo nhiệm vụ đọc nguồn" title="Tạo nhiệm vụ đọc nguồn">✓</button><button class="tiny-icon-button" data-action="source-create-note" data-id="${escapeAttr(source.id)}" aria-label="Tạo ghi chú từ nguồn" title="Tạo ghi chú từ nguồn">▧</button><button class="tiny-icon-button" data-action="source-edit" data-id="${escapeAttr(source.id)}" aria-label="Sửa nguồn" title="Sửa nguồn">✎</button><button class="tiny-icon-button delete" data-action="source-delete" data-id="${escapeAttr(source.id)}" aria-label="Xóa nguồn" title="Xóa nguồn">×</button></div>
  </article>`;
}
function renderSourceResults() {
  const host = $('#sourceResults');
  if (!host || !data) return;
  const list = getFilteredSources();
  const summary = $('#sourceResultSummary');
  if (summary) summary.textContent = `Hiển thị ${list.length}/${data.resources.length} nguồn`;
  const total = $('#sourceTotalCount'); if (total) total.textContent = String(data.resources.length);
  const fav = $('#sourceFavoriteCount'); if (fav) fav.textContent = String(data.resources.filter(item => item.favorite).length);
  const unread = $('#sourceUnreadCount'); if (unread) unread.textContent = String(data.resources.filter(item => item.status !== 'read').length);
  const favButton = $('#sourceFavoritesButton');
  if (favButton) { favButton.classList.toggle('active', sourceFavoritesOnly); favButton.setAttribute('aria-pressed', String(sourceFavoritesOnly)); }
  host.innerHTML = list.length ? `<div class="source-grid">${list.map(sourceCardMarkup).join('')}</div>` : `<div class="source-empty"><div class="source-empty-icon">▤</div><h3>${data.resources.length ? 'Chưa tìm thấy nguồn phù hợp' : 'Kho nguồn của bạn đang trống'}</h3><p>${data.resources.length ? 'Thử đổi từ khóa, bộ lọc hoặc bỏ bộ lọc yêu thích.' : 'Lưu liên kết bài giảng, tài liệu, đề thi và nguồn tham khảo đáng tin cậy vào một nơi.'}</p>${data.resources.length ? '<button class="button button-quiet" data-action="source-clear-filters">Xóa bộ lọc</button>' : '<button class="button button-primary" data-action="source-new">＋ Lưu nguồn đầu tiên</button>'}</div>`;
}
function renderSources() {
  const total = data.resources.length;
  const favCount = data.resources.filter(item => item.favorite).length;
  const unreadCount = data.resources.filter(item => item.status !== 'read').length;
  $('#viewContainer').innerHTML = `<div class="page-heading source-page-heading"><div><div class="eyebrow">PERSONAL KNOWLEDGE VAULT</div><h1>Kho nguồn dữ liệu</h1><p>Gom tài liệu, website, video bài giảng và đề thi vào một thư viện có thể tìm kiếm. Mỗi nguồn có ghi chú, môn học, tag và trạng thái đọc.</p></div><div class="heading-actions"><button class="button button-primary" data-action="source-new">＋ Lưu nguồn mới</button><button class="button button-quiet" data-action="source-export-csv">↓ Xuất CSV</button></div></div>
  <section class="source-stats-grid"><article class="source-stat"><span class="source-stat-icon">▤</span><div><small>Tổng nguồn</small><strong id="sourceTotalCount">${total}</strong></div></article><article class="source-stat"><span class="source-stat-icon">☆</span><div><small>Yêu thích</small><strong id="sourceFavoriteCount">${favCount}</strong></div></article><article class="source-stat"><span class="source-stat-icon">◷</span><div><small>Chưa đọc / đang đọc</small><strong id="sourceUnreadCount">${unreadCount}</strong></div></article></section>
  <section class="panel source-toolbar-panel"><div class="source-toolbar"><label class="source-search"><span>⌕</span><input id="sourceSearchInput" type="search" placeholder="Tìm theo tên, môn, mô tả, tag hoặc website…" value="${escapeAttr(sourceSearchQuery)}" aria-label="Tìm trong kho nguồn"></label><select id="sourceTypeFilter" class="field-control" aria-label="Lọc loại nguồn"><option value="all">Tất cả loại nguồn</option>${Object.entries(SOURCE_TYPES).map(([key, item]) => `<option value="${key}"${sourceTypeFilter === key ? ' selected' : ''}>${item.label}</option>`).join('')}</select><select id="sourceStatusFilter" class="field-control" aria-label="Lọc trạng thái đọc"><option value="all">Mọi trạng thái</option>${Object.entries(SOURCE_STATUSES).map(([key, item]) => `<option value="${key}"${sourceStatusFilter === key ? ' selected' : ''}>${item.label}</option>`).join('')}</select><button id="sourceFavoritesButton" class="button button-quiet source-fav-filter${sourceFavoritesOnly ? ' active' : ''}" data-action="source-filter-favorites" aria-pressed="${sourceFavoritesOnly ? 'true' : 'false'}">★ Yêu thích</button><button class="button button-quiet" data-action="source-clear-filters">Đặt lại</button></div><div class="source-toolbar-foot"><span id="sourceResultSummary">Hiển thị ${total}/${total} nguồn</span><span>Dữ liệu lưu riêng trong không gian này</span></div></section>
  <section id="sourceResults" aria-live="polite"></section>
  <section class="panel source-method-panel"><div class="panel-heading"><div><h2>Checklist đánh giá nguồn</h2><p>Trước khi dùng thông tin cho bài tập hoặc bài thuyết trình, kiểm tra nhanh:</p></div><span class="panel-kicker">SOURCE CHECK</span></div><div class="source-checklist"><div><span>01</span><p><strong>Tác giả và đơn vị</strong><small>Ai tạo nội dung? Đơn vị đó có chuyên môn phù hợp không?</small></p></div><div><span>02</span><p><strong>Ngày cập nhật</strong><small>Nội dung có còn phù hợp với bài học hoặc dữ liệu hiện tại không?</small></p></div><div><span>03</span><p><strong>Bằng chứng gốc</strong><small>Tìm số liệu, tài liệu gốc hoặc trích dẫn có thể kiểm chứng.</small></p></div><div><span>04</span><p><strong>Đối chiếu chéo</strong><small>So sánh với một nguồn độc lập trước khi kết luận.</small></p></div></div></section>`;
  renderSourceResults();
}
function openSourceDialog(source = null) {
  const editing = Boolean(source);
  const item = source || { id: '', title: '', url: '', type: 'website', subject: 'Khác', description: '', tags: [], status: 'unread', favorite: false, quality: 3 };
  $('#dialogHost').innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sourceDialogTitle"><div class="modal-panel source-dialog-panel"><button class="modal-close" data-action="dialog-close" aria-label="Đóng">×</button><div class="eyebrow">PERSONAL KNOWLEDGE VAULT</div><h2 class="modal-title" id="sourceDialogTitle">${editing ? 'Chỉnh sửa nguồn' : 'Lưu nguồn dữ liệu mới'}</h2><p class="modal-subtitle">Lưu đường dẫn và vài dòng mô tả để sau này tìm lại nhanh, không phải lục lịch sử trình duyệt.</p><form id="sourceDialogForm" class="stack-form"><input type="hidden" name="recordId" value="${escapeAttr(item.id)}"><div class="form-field"><label for="sourceTitleInput">Tên nguồn *</label><input id="sourceTitleInput" name="title" required maxlength="180" value="${escapeAttr(item.title)}" placeholder="Ví dụ: Chuyên đề phương trình bậc hai"></div><div class="form-field"><label for="sourceUrlInput">Đường dẫn website *</label><input id="sourceUrlInput" name="url" type="text" required maxlength="2048" value="${escapeAttr(item.url)}" placeholder="https://..." inputmode="url"><small>Chỉ hỗ trợ liên kết HTTP/HTTPS. Có thể nhập tên miền và hệ thống sẽ thêm https://.</small></div><div class="source-form-grid"><div class="form-field"><label for="sourceTypeInput">Loại nguồn</label><select id="sourceTypeInput" name="type">${Object.entries(SOURCE_TYPES).map(([key, value]) => `<option value="${key}"${item.type === key ? ' selected' : ''}>${value.label}</option>`).join('')}</select></div><div class="form-field"><label for="subject">Môn học</label>${subjectsSelect(item.subject || 'Khác', 'subject', 'field-control')}</div></div><div class="form-field"><label for="sourceDescriptionInput">Mô tả / ghi chú của bạn</label><textarea id="sourceDescriptionInput" name="description" rows="3" maxlength="1200" placeholder="Nguồn này nói về gì? Chương nào hữu ích?">${escapeHTML(item.description || '')}</textarea></div><div class="form-field"><label for="sourceTagsInput">Tags (ngăn cách bằng dấu phẩy)</label><input id="sourceTagsInput" name="tags" maxlength="360" value="${escapeAttr((item.tags || []).join(', '))}" placeholder="lớp 9, ôn thi, công thức"><small>Tối đa 12 tags, mỗi tag 28 ký tự.</small></div><div class="source-form-grid"><div class="form-field"><label for="sourceStatusInput">Trạng thái đọc</label><select id="sourceStatusInput" name="status">${Object.entries(SOURCE_STATUSES).map(([key, value]) => `<option value="${key}"${item.status === key ? ' selected' : ''}>${value.label}</option>`).join('')}</select></div><div class="form-field"><label for="sourceQualityInput">Đánh giá cá nhân</label><select id="sourceQualityInput" name="quality">${[1,2,3,4,5].map(n => `<option value="${n}"${Number(item.quality) === n ? ' selected' : ''}>${'★'.repeat(n)}${'☆'.repeat(5-n)} · ${n}/5</option>`).join('')}</select></div></div><label class="source-fav-checkbox"><input type="checkbox" name="favorite"${item.favorite ? ' checked' : ''}> <span>Đánh dấu nguồn này là yêu thích</span></label><div id="sourceFormError" class="form-error hidden" role="alert"></div><div class="modal-form-actions"><button class="button button-quiet" type="button" data-action="dialog-close">Hủy</button><button class="button button-primary" type="submit">${editing ? 'Lưu thay đổi' : 'Lưu vào kho'} →</button></div></form></div></div>`;
  $('#sourceTitleInput')?.focus();
}
function submitSourceDialog(event) {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.getAttribute('id') !== 'sourceDialogForm' || !data) return;
  const inlineError = $('#sourceFormError');
  if (inlineError) { inlineError.textContent = ''; inlineError.classList.add('hidden'); }
  const fd = new FormData(form);
  const id = String(fd.get('recordId') || '').trim();
  const title = String(fd.get('title') || '').trim();
  const description = String(fd.get('description') || '').trim();
  let url;
  try { url = normalizeResourceUrl(fd.get('url')); }
  catch (error) { const box = $('#sourceFormError'); if (box) { box.textContent = error.message; box.classList.remove('hidden'); } else showToast(error.message, 'error'); return; }
  if (!title) { showToast('Tên nguồn không được để trống.', 'error'); $('#sourceTitleInput')?.focus(); return; }
  if (title.length > 180 || description.length > 1200) { showToast('Tên nguồn hoặc mô tả vượt quá giới hạn cho phép.', 'error'); return; }
  const duplicate = data.resources.find(item => item.url.replace(/\/$/, '') === url.replace(/\/$/, '') && item.id !== id);
  if (duplicate) { const box = $('#sourceFormError'); if (box) { box.textContent = `Đường dẫn này đã có trong kho: “${duplicate.title}”. Hãy mở hoặc chỉnh sửa nguồn hiện có.`; box.classList.remove('hidden'); } return; }
  const now = new Date().toISOString();
  const rawTags = String(fd.get('tags') || '').split(',').map(tag => tag.trim().replace(/^#+/, '').slice(0, 28)).filter(Boolean);
  const entry = { title, url, description, type: Object.hasOwn(SOURCE_TYPES, String(fd.get('type'))) ? String(fd.get('type')) : 'website', subject: SUBJECTS.includes(String(fd.get('subject'))) ? String(fd.get('subject')) : 'Khác', tags: [...new Set(rawTags)].slice(0,12), status: Object.hasOwn(SOURCE_STATUSES, String(fd.get('status'))) ? String(fd.get('status')) : 'unread', favorite: fd.get('favorite') === 'on', quality: Math.max(1, Math.min(5, Number(fd.get('quality')) || 3)), updatedAt: now };
  if (id) {
    const existing = data.resources.find(item => item.id === id);
    if (!existing) { showToast('Không tìm thấy nguồn cần chỉnh sửa; dữ liệu chưa bị thay đổi.', 'error'); return; }
    Object.assign(existing, entry);
  } else data.resources.unshift({ id: uid(), ...entry, createdAt: now, lastOpenedAt: '' });
  saveData(); $('#dialogHost').innerHTML = ''; sourceSearchQuery = ''; sourceTypeFilter = 'all'; sourceStatusFilter = 'all'; sourceFavoritesOnly = false; renderSources(); showToast(id ? 'Đã cập nhật nguồn dữ liệu.' : 'Đã lưu nguồn vào kho.');
}
function deleteSource(id) {
  const source = data.resources.find(item => item.id === id); if (!source) return;
  if (!window.confirm(`Xóa nguồn “${source.title}” khỏi kho?`)) return;
  data.resources = data.resources.filter(item => item.id !== id); saveData(); renderSources(); showToast('Đã xóa nguồn khỏi kho.');
}
function toggleSourceFavorite(id) {
  const source = data.resources.find(item => item.id === id); if (!source) return;
  source.favorite = !source.favorite; source.updatedAt = new Date().toISOString(); saveData(); renderSourceResults();
  showToast(source.favorite ? 'Đã thêm vào yêu thích.' : 'Đã bỏ khỏi yêu thích.');
}
async function copySourceCitation(id) {
  const source = data.resources.find(item => item.id === id); if (!source) return;
  const citation = `${source.title}. ${source.url}. Truy cập ngày ${localDate()}.`;
  try {
    if (navigator.clipboard?.writeText && globalThis.isSecureContext) { await navigator.clipboard.writeText(citation); showToast('Đã sao chép trích dẫn nguồn.'); }
    else { window.prompt('Sao chép trích dẫn này:', citation); }
  } catch { window.prompt('Sao chép trích dẫn này:', citation); }
}
function createTaskFromSource(id) {
  const source = data.resources.find(item => item.id === id); if (!source) return;
  data.tasks.unshift({ id: uid(), title: `Đọc và ghi chú: ${source.title}`.slice(0,160), subject: source.subject || 'Khác', due: '', priority: 'medium', done: false, createdAt: new Date().toISOString(), sourceUrl: source.url });
  saveData(); navigate('tasks'); showToast('Đã tạo nhiệm vụ đọc nguồn.');
}
function createNoteFromSource(id) {
  const source = data.resources.find(item => item.id === id); if (!source) return;
  const content = `${source.description ? `${source.description}\n\n` : ''}Liên kết nguồn: ${source.url}\n\nÝ chính cần ghi lại:\n- \n\nCâu hỏi còn lại:\n- `;
  const now = new Date().toISOString();
  data.notes.unshift({ id: uid(), title: `Ghi chú: ${source.title}`.slice(0,120), content: content.slice(0,12000), subject: source.subject || 'Khác', createdAt: now, updatedAt: now });
  saveData(); navigate('notes'); showToast('Đã tạo ghi chú mẫu có liên kết đến nguồn.');
}
function exportSourcesCsv() {
  const rows = [['Tên nguồn','URL','Loại','Môn học','Mô tả','Tags','Trạng thái','Yêu thích','Đánh giá','Ngày thêm']];
  for (const item of data.resources) rows.push([item.title, item.url, SOURCE_TYPES[item.type]?.label || 'Khác', item.subject || 'Khác', item.description || '', (item.tags || []).join(', '), SOURCE_STATUSES[item.status]?.label || 'Chưa đọc', item.favorite ? 'Có' : 'Không', `${item.quality || 3}/5`, (item.createdAt || '').slice(0,10)]);
  const csvCell = value => {
    let s = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `lynquora-kho-nguon-${localDate()}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  showToast(`Đã xuất ${data.resources.length} nguồn ra CSV.`);
}

function renderSettings() {
  const s = data.settings;
  $('#viewContainer').innerHTML = `<div class="page-heading"><div><div class="eyebrow">LÀM CHO NÓ HỢP VỚI BẠN</div><h1>Tùy chỉnh không gian</h1><p>Điều chỉnh giao diện, mục tiêu hằng ngày và quản lý bản sao dữ liệu của bạn.</p></div></div>
  <div class="settings-layout"><div class="settings-stack"><section class="panel"><div class="panel-heading"><div><h2>Giao diện & khả năng đọc</h2><p>Thay đổi sẽ áp dụng ngay lập tức.</p></div><span class="panel-kicker">DISPLAY</span></div>
  <div class="settings-row"><div class="settings-label"><strong>Chế độ hiển thị</strong><p>Chọn nền tối hoặc nền sáng theo sở thích.</p></div><div class="setting-control"><select id="settingTheme" class="field-control"><option value="dark"${s.theme === 'dark' ? ' selected' : ''}>Tối · dịu mắt</option><option value="light"${s.theme === 'light' ? ' selected' : ''}>Sáng · rõ ràng</option></select></div></div>
  <div class="settings-row"><div class="settings-label"><strong>Màu nhấn</strong><p>Chọn màu cho token, nút và biểu đồ.</p></div><div class="setting-control"><div class="accent-picker">${[['violet','Tím'],['cyan','Xanh ngọc'],['blue','Xanh dương'],['rose','Hồng'],['green','Xanh lá']].map(([key,title]) => `<button class="accent-choice accent-${key}" data-action="setting-accent" data-accent="${key}" aria-label="${title}" title="${title}" aria-pressed="${s.accent === key}"></button>`).join('')}</div></div></div>
  <div class="settings-row"><div class="settings-label"><strong>Cỡ chữ</strong><p>Điều chỉnh từ 14 đến 19 px để dễ đọc hơn.</p></div><div class="setting-control"><label for="settingFontSize" class="task-count">Cỡ chữ: <strong id="fontSizeOutput">${s.fontSize}px</strong></label><input id="settingFontSize" type="range" min="14" max="19" step="1" value="${s.fontSize}"></div></div></section>
  <section class="panel"><div class="panel-heading"><div><h2>Mục tiêu học tập</h2><p>Mục tiêu vừa sức giúp bạn duy trì thói quen đều đặn.</p></div><span class="panel-kicker">GOALS</span></div><div class="settings-row"><div class="settings-label"><strong>Thời gian tập trung mỗi ngày</strong><p>Chọn số phút bạn muốn dành cho việc học có chủ đích.</p></div><div class="setting-control"><select id="settingGoal" class="field-control">${[[30,'30 phút'],[45,'45 phút'],[60,'1 giờ'],[90,'1 giờ 30 phút'],[120,'2 giờ'],[150,'2 giờ 30 phút'],[180,'3 giờ'],[240,'4 giờ']].map(([n,label]) => `<option value="${n}"${Number(s.dailyGoal) === n ? ' selected' : ''}>${label}</option>`).join('')}</select></div></div><div class="insight-box" style="margin-top:14px"><span class="insight-icon">✦</span><div><strong>Nhắc nhẹ</strong><p>Mục tiêu là một hướng dẫn linh hoạt, không phải áp lực. Hãy ưu tiên giấc ngủ, ăn uống và nghỉ ngơi đầy đủ.</p></div></div></section>
  <section class="panel"><div class="panel-heading"><div><h2>Dữ liệu của bạn</h2><p>Sao lưu dữ liệu trước khi đổi trình duyệt hoặc thiết bị.</p></div><span class="panel-kicker">BACKUP</span></div><div class="settings-actions"><button class="button button-primary" data-action="export-data">↓ Tải bản sao dữ liệu</button><button class="button button-quiet" data-action="import-data">↑ Khôi phục dữ liệu</button><input id="importFile" type="file" accept="application/json,.json" class="hidden"></div><p style="font-size:.66rem;color:var(--muted);margin:13px 0 0">Bản sao chứa nhiệm vụ, thời gian, ghi chú, thẻ ghi nhớ và tùy chỉnh; tệp sao lưu không chứa mật khẩu tài khoản.</p></section></div>
  <div class="settings-stack"><section class="panel"><div class="panel-heading"><div><h2>Hồ sơ cục bộ</h2><p>Thông tin của không gian đang mở.</p></div></div><div style="display:flex;align-items:center;gap:12px;padding:10px 0 17px"><div class="avatar" style="width:48px;height:48px;border-radius:16px;font-size:1.2rem">${escapeHTML(currentUser.displayName.slice(0,1).toUpperCase())}</div><div><strong style="font-size:.86rem;display:block">${escapeHTML(currentUser.displayName)}</strong><span style="font-size:.68rem;color:var(--muted)">${currentUser.isGuest ? 'Chế độ dùng thử' : `@${escapeHTML(currentUser.username)}`}</span></div></div><div class="privacy-note"><span>⌑</span><div><strong>${currentUser.isGuest ? 'Bạn đang dùng thử' : 'Tài khoản trên thiết bị này'}</strong><p>${currentUser.isGuest ? 'Dữ liệu demo được lưu tại trình duyệt hiện tại. Tạo tài khoản nếu bạn muốn tách không gian riêng.' : 'Tên đăng nhập và bản băm mật khẩu nằm trong bộ nhớ trình duyệt hiện tại. Không có đồng bộ máy chủ hoặc khôi phục mật khẩu tự động.'}</p></div></div><div class="settings-actions"><button class="button button-quiet" data-action="logout">${currentUser.isGuest ? 'Kết thúc dùng thử' : 'Đăng xuất'}</button>${currentUser.isGuest ? '<button class="button button-primary" data-action="open-auth" data-mode="signup">Tạo tài khoản</button>' : ''}</div></section>
  <section class="panel"><div class="panel-heading"><div><h2>Phím tắt & mẹo</h2><p>Di chuyển nhanh trong không gian học.</p></div></div><div class="shortcut-list"><div class="shortcut-row"><span>Tìm nhiệm vụ</span><kbd>Ctrl / ⌘ + K</kbd></div><div class="shortcut-row"><span>Đóng hộp thoại</span><kbd>Esc</kbd></div><div class="shortcut-row"><span>Menu cuộn</span><span style="color:var(--muted)">Cuộn trong thanh trái</span></div><div class="shortcut-row"><span>Sao lưu định kỳ</span><span style="color:var(--muted)">JSON · trên thiết bị</span></div></div></section>
  <div class="privacy-note"><span>ⓘ</span><div><strong>Giới hạn bảo mật cần biết</strong><p>Đây là website tĩnh chạy trong trình duyệt. Dữ liệu không được mã hóa toàn bộ và không đồng bộ liên thiết bị. Không lưu thông tin nhạy cảm; trên máy dùng chung, hãy đăng xuất và xóa dữ liệu trình duyệt khi cần.</p></div></div></div></div>`;
}
function renderView() {
  if (!data || !currentUser) return;
  if (currentRoute === 'home') renderHome();
  else if (currentRoute === 'tasks') renderTasks();
  else if (currentRoute === 'schedule') renderSchedule();
  else if (currentRoute === 'focus') renderFocus();
  else if (currentRoute === 'notes') renderNotes();
  else if (currentRoute === 'sources') renderSources();
  else if (currentRoute === 'cards') renderCards();
  else if (currentRoute === 'quiz') renderQuiz();
  else if (currentRoute === 'stats') renderStats();
  else if (currentRoute === 'entertainment') renderEntertainment();
  else if (currentRoute === 'settings') renderSettings();
}

function openTaskDialog(task = null) {
  const editing = Boolean(task);
  $('#dialogHost').innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="taskDialogTitle"><div class="modal-panel"><button class="modal-close" data-action="dialog-close" aria-label="Đóng">×</button><div class="eyebrow">${editing ? 'CHỈNH SỬA KẾ HOẠCH' : 'THÊM VÀO DANH SÁCH'}</div><h2 id="taskDialogTitle" class="modal-title">${editing ? 'Cập nhật nhiệm vụ' : 'Nhiệm vụ mới'}</h2><p class="modal-subtitle">Ghi rõ việc cần làm, sau đó đặt thời hạn hợp lý.</p><form id="taskDialogForm" class="stack-form"><input type="hidden" name="recordId" value="${editing ? escapeAttr(task.id) : ''}"><div class="form-field"><label for="taskTitleInput">Tên nhiệm vụ *</label><input id="taskTitleInput" name="title" required maxlength="160" value="${editing ? escapeAttr(task.title) : ''}" placeholder="Ví dụ: Làm bài tập trang 42"></div><div class="form-field"><label>Môn học</label>${subjectsSelect(task?.subject || 'Toán', 'subject', '')}</div><div class="form-field"><label for="taskDueInput">Hạn hoàn thành (không bắt buộc)</label><input id="taskDueInput" name="due" type="date" value="${editing ? escapeAttr(task.due || '') : ''}"></div><div class="form-field"><label for="taskPriorityInput">Mức độ ưu tiên</label><select id="taskPriorityInput" name="priority"><option value="high"${task?.priority === 'high' ? ' selected' : ''}>Cao · cần chú ý sớm</option><option value="medium"${!task || task.priority === 'medium' ? ' selected' : ''}>Vừa · quan trọng</option><option value="low"${task?.priority === 'low' ? ' selected' : ''}>Thấp · có thể linh hoạt</option></select></div><div class="modal-form-actions"><button class="button button-quiet" type="button" data-action="dialog-close">Hủy</button><button class="button button-primary" type="submit">${editing ? 'Lưu thay đổi' : 'Thêm nhiệm vụ'} →</button></div></form></div></div>`;
  $('#taskTitleInput').focus();
}
function submitTaskDialog(event) {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.getAttribute('id') !== 'taskDialogForm') return;
  const fd = new FormData(form);
  const id = String(fd.get('recordId') || '');
  const title = String(fd.get('title') || '').trim();
  if (!title) return showToast('Hãy nhập tên nhiệm vụ.', 'error');
  if (id) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return showToast('Không tìm thấy nhiệm vụ để sửa.', 'error');
    Object.assign(task, { title, subject: String(fd.get('subject')), due: String(fd.get('due') || ''), priority: String(fd.get('priority') || 'medium') });
  } else addTask({ title, subject: String(fd.get('subject')), due: String(fd.get('due') || ''), priority: String(fd.get('priority') || 'medium') });
  saveData(); $('#dialogHost').innerHTML = ''; renderView(); showToast(id ? 'Đã cập nhật nhiệm vụ.' : 'Đã thêm nhiệm vụ mới.');
}
function toggleTask(id) {
  const task = data.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  task.completedDate = task.done ? localDate() : '';
  saveData(); renderView();
  showToast(task.done ? 'Đã ghi nhận nhiệm vụ hoàn thành.' : 'Đã chuyển nhiệm vụ về trạng thái chưa xong.');
}
function deleteTask(id) {
  const task = data.tasks.find(t => t.id === id);
  if (!task) return;
  if (!window.confirm(`Xóa nhiệm vụ “${task.title}”?`)) return;
  data.tasks = data.tasks.filter(t => t.id !== id); saveData(); renderView(); showToast('Đã xóa nhiệm vụ.');
}
function openNoteDialog(note = null) {
  const editing = Boolean(note);
  $('#dialogHost').innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="noteDialogTitle"><div class="modal-panel"><button class="modal-close" data-action="dialog-close" aria-label="Đóng">×</button><div class="eyebrow">SỔ GHI CHÚ CÁ NHÂN</div><h2 class="modal-title" id="noteDialogTitle">${editing ? 'Chỉnh sửa ghi chú' : 'Ghi chú mới'}</h2><form id="noteDialogForm" class="stack-form"><input type="hidden" name="recordId" value="${editing ? escapeAttr(note.id) : ''}"><div class="form-field"><label for="noteTitleInput">Tiêu đề *</label><input id="noteTitleInput" name="title" maxlength="120" required value="${editing ? escapeAttr(note.title) : ''}" placeholder="Ví dụ: Công thức cần nhớ"></div><div class="form-field"><label>Môn học</label>${subjectsSelect(note?.subject || 'Khác', 'subject', '')}</div><div class="form-field"><label for="noteContentInput">Nội dung *</label><textarea id="noteContentInput" name="content" rows="6" maxlength="12000" required placeholder="Viết công thức, ý tưởng hoặc tóm tắt của bạn…">${editing ? escapeHTML(note.content) : ''}</textarea></div><div class="modal-form-actions"><button class="button button-quiet" type="button" data-action="dialog-close">Hủy</button><button class="button button-primary" type="submit">${editing ? 'Lưu ghi chú' : 'Tạo ghi chú'} →</button></div></form></div></div>`;
  $('#noteTitleInput').focus();
}
function submitNoteDialog(event) {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.getAttribute('id') !== 'noteDialogForm' || !data) return;
  const fd = new FormData(form), id = String(fd.get('recordId') || ''), title = String(fd.get('title') || '').trim(), content = String(fd.get('content') || '').trim();
  if (!title || !content) return showToast('Tiêu đề và nội dung không được để trống.', 'error');
  if (id) { const note = data.notes.find(n => n.id === id); if (!note) return showToast('Không tìm thấy ghi chú.', 'error'); Object.assign(note, { title, content, subject: String(fd.get('subject')), updatedAt: new Date().toISOString() }); }
  else data.notes.unshift({ id: uid(), title, content, subject: String(fd.get('subject')), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  saveData(); $('#dialogHost').innerHTML = ''; renderView(); showToast(id ? 'Đã cập nhật ghi chú.' : 'Đã lưu ghi chú.');
}
function deleteNote(id) {
  const note = data.notes.find(n => n.id === id); if (!note) return;
  if (!window.confirm(`Xóa ghi chú “${note.title}”?`)) return;
  data.notes = data.notes.filter(n => n.id !== id); saveData(); renderView(); showToast('Đã xóa ghi chú.');
}
function openCardDialog(card = null) {
  const editing = Boolean(card);
  $('#dialogHost').innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cardDialogTitle"><div class="modal-panel"><button class="modal-close" data-action="dialog-close" aria-label="Đóng">×</button><div class="eyebrow">ACTIVE RECALL</div><h2 class="modal-title" id="cardDialogTitle">${editing ? 'Chỉnh sửa thẻ' : 'Tạo thẻ ghi nhớ'}</h2><p class="modal-subtitle">Viết câu hỏi ở mặt trước và đáp án ngắn gọn ở mặt sau.</p><form id="cardDialogForm" class="stack-form"><input type="hidden" name="recordId" value="${editing ? escapeAttr(card.id) : ''}"><div class="form-field"><label for="cardFrontInput">Mặt trước · câu hỏi *</label><textarea id="cardFrontInput" name="front" rows="3" maxlength="1000" required placeholder="Ví dụ: Thì hiện tại hoàn thành dùng khi nào?">${editing ? escapeHTML(card.front) : ''}</textarea></div><div class="form-field"><label for="cardBackInput">Mặt sau · đáp án *</label><textarea id="cardBackInput" name="back" rows="3" maxlength="1600" required placeholder="Ghi câu trả lời hoặc định nghĩa…">${editing ? escapeHTML(card.back) : ''}</textarea></div><div class="form-field"><label>Môn học</label>${subjectsSelect(card?.subject || 'Tiếng Anh', 'subject', '')}</div><div class="modal-form-actions"><button class="button button-quiet" type="button" data-action="dialog-close">Hủy</button><button class="button button-primary" type="submit">${editing ? 'Lưu thẻ' : 'Tạo thẻ'} →</button></div></form></div></div>`;
  $('#cardFrontInput').focus();
}
function submitCardDialog(event) {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.getAttribute('id') !== 'cardDialogForm' || !data) return;
  const fd = new FormData(form), id = String(fd.get('recordId') || ''), front = String(fd.get('front') || '').trim(), back = String(fd.get('back') || '').trim();
  if (!front || !back) return showToast('Cả câu hỏi và đáp án đều cần nội dung.', 'error');
  if (id) { const card = data.cards.find(c => c.id === id); if (!card) return showToast('Không tìm thấy thẻ.', 'error'); Object.assign(card, { front, back, subject: String(fd.get('subject')) }); }
  else data.cards.push({ id: uid(), front, back, subject: String(fd.get('subject')), createdAt: new Date().toISOString(), nextReviewAt: localDate(), intervalDays: 0, reviewStreak: 0, lastReviewedAt: '' });
  saveData(); $('#dialogHost').innerHTML = ''; reviewIndex = id ? Math.max(0, data.cards.findIndex(card => card.id === id)) : Math.max(0, data.cards.length - 1); reviewFlipped = false; renderView(); showToast(id ? 'Đã cập nhật thẻ.' : 'Đã thêm thẻ ghi nhớ.');
}
function deleteCard(id) {
  const card = data.cards.find(c => c.id === id); if (!card) return;
  if (!window.confirm('Xóa thẻ ghi nhớ này?')) return;
  data.cards = data.cards.filter(c => c.id !== id); reviewIndex = Math.max(0, Math.min(reviewIndex, data.cards.length - 1)); reviewFlipped = false; saveData(); renderView(); showToast('Đã xóa thẻ ghi nhớ.');
}

function setFocusDuration(minutes) {
  if (focusState.running) return;
  focusState.duration = Number(minutes) * 60;
  focusState.remaining = focusState.duration;
  focusState.hasStarted = false;
  renderFocus();
}
function startFocus() {
  if (focusState.running) {
    focusState.remaining = Math.max(0, Math.ceil((focusState.endAt - Date.now()) / 1000));
    focusState.running = false; focusState.endAt = 0;
    if (focusInterval) clearInterval(focusInterval); focusInterval = null;
    updateTimerDisplay(); saveData(); renderFocus(); return;
  }
  if (focusState.remaining <= 0) focusState.remaining = focusState.duration;
  focusState.running = true; focusState.hasStarted = true; focusState.endAt = Date.now() + focusState.remaining * 1000;
  if (focusInterval) clearInterval(focusInterval);
  focusInterval = window.setInterval(tickFocus, 250);
  renderFocus();
}
function tickFocus() {
  if (!focusState.running) return;
  focusState.remaining = Math.max(0, Math.ceil((focusState.endAt - Date.now()) / 1000));
  updateTimerDisplay();
  if (focusState.remaining <= 0) {
    focusState.running = false; focusState.endAt = 0;
    if (focusInterval) clearInterval(focusInterval); focusInterval = null;
    recordFocusSession(Math.round(focusState.duration / 60), true);
    focusState.hasStarted = false; focusState.remaining = focusState.duration;
    showToast('Bạn đã hoàn thành phiên tập trung. Hãy nghỉ một chút nhé!');
    renderView();
  }
}
function updateTimerDisplay() {
  if ($('#timerDisplay')) $('#timerDisplay').textContent = fmtClock(focusState.remaining);
  if ($('#timerState')) $('#timerState').textContent = focusState.running ? 'ĐANG CHẠY' : focusState.hasStarted ? 'ĐANG TẠM DỪNG' : 'SẴN SÀNG';
  if ($('#timerRing')) $('#timerRing').style.setProperty('--timer-progress', `${focusState.duration ? focusState.remaining / focusState.duration * 100 : 100}%`);
  if ($('#focusToggle')) $('#focusToggle').innerHTML = focusState.running ? 'Ⅱ Tạm dừng' : (focusState.hasStarted ? '▶ Tiếp tục' : '▶ Bắt đầu');
  if ($('[data-action="focus-finish"]')) $('[data-action="focus-finish"]').disabled = !focusState.hasStarted;
}
function recordFocusSession(minutes, completed) {
  const mins = Math.max(0, Number(minutes) || 0);
  if (!mins) return;
  data.sessions.push({ id: uid(), date: localDate(), minutes: mins, subject: focusState.subject || 'Khác', completedAt: new Date().toISOString(), completed: Boolean(completed) });
  saveData();
}
function finishFocus() {
  if (!focusState.hasStarted) return;
  const remaining = focusState.running ? Math.max(0, Math.ceil((focusState.endAt - Date.now()) / 1000)) : focusState.remaining;
  const elapsed = Math.floor((focusState.duration - remaining) / 60);
  focusState.running = false; focusState.endAt = 0;
  if (focusInterval) clearInterval(focusInterval); focusInterval = null;
  if (elapsed >= 1) { recordFocusSession(elapsed, false); showToast(`Đã ghi nhận ${fmtMinutes(elapsed)} tập trung.`); }
  else showToast('Phiên quá ngắn để ghi vào thống kê. Bạn có thể bắt đầu lại khi sẵn sàng.', 'error');
  focusState.remaining = focusState.duration; focusState.hasStarted = false;
  renderView();
}
function resetFocus() {
  if (focusInterval) clearInterval(focusInterval); focusInterval = null;
  focusState.running = false; focusState.endAt = 0; focusState.remaining = focusState.duration; focusState.hasStarted = false;
  renderFocus();
}

function exportData() {
  const backup = { app: 'Lynquora StudySpace', schema: 1, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `lynquora-backup-${localDate()}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); showToast('Đã tạo bản sao lưu JSON.');
}
function normalizeImportedData(incoming) {
  if (!incoming || typeof incoming !== 'object' || incoming.schema !== 1 ||
      !Array.isArray(incoming.tasks) || !Array.isArray(incoming.sessions) ||
      !Array.isArray(incoming.notes) || !Array.isArray(incoming.cards)) {
    throw new Error('Tệp không có cấu trúc dữ liệu Lynquora hợp lệ.');
  }
  if (incoming.tasks.length > 10000 || incoming.sessions.length > 50000 || incoming.notes.length > 10000 || incoming.cards.length > 10000 || (Array.isArray(incoming.resources) && incoming.resources.length > 20000)) {
    throw new Error('Tệp có quá nhiều mục để nhập an toàn.');
  }
  const now = new Date().toISOString();
  const seenIds = new Set();
  const safeId = value => {
    const candidate = typeof value === 'string' ? value.trim().slice(0, 100) : '';
    if (candidate && !seenIds.has(candidate)) { seenIds.add(candidate); return candidate; }
    let replacement = uid();
    while (seenIds.has(replacement)) replacement = uid();
    seenIds.add(replacement);
    return replacement;
  };
  const isRecord = item => Boolean(item && typeof item === 'object' && !Array.isArray(item));
  const textValue = (value, max, label) => {
    const result = String(value ?? '').trim();
    if (!result) throw new Error(`${label} trong tệp sao lưu không được để trống.`);
    return result.slice(0, max);
  };
  const normalizeDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? value : '';
  };
  const subjectValue = value => SUBJECTS.includes(value) ? value : 'Khác';
  const timestampValue = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : now;
  const base = defaultData();
  const sourceSettings = isRecord(incoming.settings) ? incoming.settings : {};
  const settings = {
    theme: sourceSettings.theme === 'light' ? 'light' : 'dark',
    accent: ['violet', 'cyan', 'blue', 'rose', 'green'].includes(sourceSettings.accent) ? sourceSettings.accent : 'violet',
    fontSize: Math.max(14, Math.min(19, Number(sourceSettings.fontSize) || base.settings.fontSize)),
    dailyGoal: Math.max(30, Math.min(240, Number(sourceSettings.dailyGoal) || base.settings.dailyGoal)),
    dailyChallengeDoneOn: normalizeDate(sourceSettings.dailyChallengeDoneOn)
  };
  const tasks = incoming.tasks.map((item, i) => {
    if (!isRecord(item)) throw new Error(`Nhiệm vụ thứ ${i + 1} trong tệp không hợp lệ.`);
    let sourceUrl = ''; if (item.sourceUrl) { try { sourceUrl = normalizeResourceUrl(item.sourceUrl); } catch { sourceUrl = ''; } }
    return { id: safeId(item.id), title: textValue(item.title, 160, `Tên nhiệm vụ thứ ${i + 1}`), subject: subjectValue(item.subject), due: normalizeDate(item.due), priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium', done: item.done === true, completedDate: normalizeDate(item.completedDate), createdAt: timestampValue(item.createdAt), ...(sourceUrl ? { sourceUrl } : {}) };
  });
  const sessions = incoming.sessions.map((item, i) => {
    if (!isRecord(item)) throw new Error(`Phiên tập trung thứ ${i + 1} trong tệp không hợp lệ.`);
    const date = normalizeDate(item.date), minutes = Number(item.minutes);
    if (!date || !Number.isFinite(minutes) || minutes < 0 || minutes > 1440) throw new Error(`Thời gian của phiên thứ ${i + 1} không hợp lệ.`);
    return { id: safeId(item.id), date, minutes, subject: subjectValue(item.subject), completedAt: timestampValue(item.completedAt), completed: item.completed === true };
  });
  const notes = incoming.notes.map((item, i) => {
    if (!isRecord(item)) throw new Error(`Ghi chú thứ ${i + 1} trong tệp không hợp lệ.`);
    return { id: safeId(item.id), title: textValue(item.title, 120, `Tiêu đề ghi chú thứ ${i + 1}`), content: textValue(item.content, 12000, `Nội dung ghi chú thứ ${i + 1}`), subject: subjectValue(item.subject), createdAt: timestampValue(item.createdAt), updatedAt: timestampValue(item.updatedAt) };
  });
  const cards = incoming.cards.map((item, i) => {
    if (!isRecord(item)) throw new Error(`Thẻ ghi nhớ thứ ${i + 1} trong tệp không hợp lệ.`);
    return { id: safeId(item.id), front: textValue(item.front, 1000, `Câu hỏi của thẻ thứ ${i + 1}`), back: textValue(item.back, 1600, `Đáp án của thẻ thứ ${i + 1}`), subject: subjectValue(item.subject), createdAt: timestampValue(item.createdAt), nextReviewAt: normalizeDate(item.nextReviewAt) || localDate(), intervalDays: Math.max(0, Math.min(30, Number(item.intervalDays) || 0)), reviewStreak: Math.max(0, Math.min(1000, Number(item.reviewStreak) || 0)), lastReviewedAt: typeof item.lastReviewedAt === 'string' && Number.isFinite(Date.parse(item.lastReviewedAt)) ? item.lastReviewedAt : '' };
  });
  const seenResourceUrls = new Set();
  const resources = (Array.isArray(incoming.resources) ? incoming.resources : []).map((item, i) => {
    if (!isRecord(item)) throw new Error(`Nguồn dữ liệu thứ ${i + 1} trong tệp không hợp lệ.`);
    const title = textValue(item.title, 180, `Tên nguồn thứ ${i + 1}`);
    let url = '';
    try { url = normalizeResourceUrl(item.url); } catch { throw new Error(`Đường dẫn của nguồn thứ ${i + 1} không hợp lệ.`); }
    const canonicalUrl = url.replace(/\/$/, '');
    if (seenResourceUrls.has(canonicalUrl)) throw new Error(`Đường dẫn của nguồn thứ ${i + 1} bị trùng với nguồn khác trong tệp.`);
    seenResourceUrls.add(canonicalUrl);
    const allowedTypes = ['website', 'video', 'document', 'exam', 'course', 'other'];
    const allowedStatuses = ['unread', 'reading', 'read'];
    const tags = Array.isArray(item.tags) ? item.tags : (typeof item.tags === 'string' ? item.tags.split(',') : []);
    return { id: safeId(item.id), title, url, type: allowedTypes.includes(item.type) ? item.type : 'website', subject: subjectValue(item.subject), description: String(item.description || '').trim().slice(0, 1200), tags: [...new Set(tags.map(tag => String(tag || '').trim().slice(0, 28)).filter(Boolean))].slice(0, 12), status: allowedStatuses.includes(item.status) ? item.status : 'unread', favorite: item.favorite === true, quality: Math.max(1, Math.min(5, Number(item.quality) || 3)), createdAt: timestampValue(item.createdAt), updatedAt: timestampValue(item.updatedAt), lastOpenedAt: typeof item.lastOpenedAt === 'string' && Number.isFinite(Date.parse(item.lastOpenedAt)) ? item.lastOpenedAt : '' };
  });
  return { schema: 1, settings, tasks, sessions, notes, cards, resources, createdAt: timestampValue(incoming.createdAt) };
}
function importDataFile(file) {
  if (!file || !currentUser || !data) return;
  if (file.size > 10 * 1024 * 1024) { showToast('Tệp sao lưu lớn hơn giới hạn 10 MB.', 'error'); $('#importFile').value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result)); const incoming = parsed?.data || parsed;
      const normalized = normalizeImportedData(incoming);
      if (!window.confirm('Khôi phục sẽ thay thế dữ liệu hiện tại của tài khoản này. Bạn đã có bản sao lưu nếu cần chưa?')) return;
      data = normalized;
      saveAndApply(); renderView(); showToast('Đã khôi phục dữ liệu.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể đọc tệp sao lưu.', 'error'); }
    finally { $('#importFile').value = ''; }
  };
  reader.onerror = () => { showToast('Không thể đọc tệp này.', 'error'); $('#importFile').value = ''; };
  reader.readAsText(file);
}
function toggleTheme() {
  const currentTheme = (data?.settings?.theme || document.documentElement.dataset.theme) === 'dark' ? 'light' : 'dark';
  if (data) { data.settings.theme = currentTheme; saveAndApply(); }
  else { const prefs = readPreferences(); prefs.theme = currentTheme; try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { showToast('Không thể lưu tùy chỉnh trong trình duyệt này.', 'error'); } applyAppearance(prefs); }
  if (currentRoute === 'settings' && data) renderSettings();
}

function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  switch (action) {
    case 'open-auth': openAuth(button.dataset.mode || 'login'); break;
    case 'close-auth': closeAuth(); break;
    case 'auth-mode': setAuthMode(button.dataset.mode); break;
    case 'enter-guest': closeAuth(); enterGuest(); break;
    case 'logout': if (window.confirm('Đăng xuất khỏi không gian hiện tại?')) logout(); break;
    case 'welcome-theme': case 'top-theme': toggleTheme(); break;
    case 'navigate':
      if (button.dataset.route === 'quiz') {
        if (data?.cards?.length >= 2) startQuiz();
        else { quizState = { questions: [], index: 0, score: 0, answered: false, finished: false, selected: -1 }; navigate('quiz'); }
      } else navigate(button.dataset.route);
      break;
    case 'open-sidebar': openSidebar(); break;
    case 'close-sidebar': closeSidebar(); break;
    case 'task-new': openTaskDialog(); break;
    case 'task-edit': { const task = data.tasks.find(t => t.id === id); if (task) openTaskDialog(task); break; }
    case 'task-toggle': toggleTask(id); break;
    case 'task-delete': deleteTask(id); break;
    case 'task-filter': taskFilter = button.dataset.filter || 'all'; renderTasks(); break;
    case 'search-clear': searchQuery = ''; $('#globalSearch').value = ''; renderTasks(); break;
    case 'dialog-close': $('#dialogHost').innerHTML = ''; break;
    case 'note-new': openNoteDialog(); break;
    case 'note-edit': { const note = data.notes.find(n => n.id === id); if (note) openNoteDialog(note); break; }
    case 'note-delete': deleteNote(id); break;
    case 'source-new': openSourceDialog(); break;
    case 'source-edit': { const source = data.resources.find(item => item.id === id); if (source) openSourceDialog(source); break; }
    case 'source-delete': deleteSource(id); break;
    case 'source-favorite': toggleSourceFavorite(id); break;
    case 'source-copy': copySourceCitation(id); break;
    case 'source-create-task': createTaskFromSource(id); break;
    case 'source-create-note': createNoteFromSource(id); break;
    case 'source-filter-favorites': sourceFavoritesOnly = !sourceFavoritesOnly; renderSources(); break;
    case 'source-clear-filters': sourceSearchQuery = ''; sourceTypeFilter = 'all'; sourceStatusFilter = 'all'; sourceFavoritesOnly = false; renderSources(); break;
    case 'source-export-csv': exportSourcesCsv(); break;
    case 'card-new': openCardDialog(); break;
    case 'card-edit': { const card = data.cards.find(c => c.id === id); if (card) openCardDialog(card); break; }
    case 'card-delete': deleteCard(id); break;
    case 'review-flip': reviewFlipped = !reviewFlipped; renderCards(); break;
    case 'review-next': reviewIndex = (reviewIndex + 1) % Math.max(1, data.cards.length); reviewFlipped = false; renderCards(); break;
    case 'review-prev': reviewIndex = (reviewIndex - 1 + Math.max(1, data.cards.length)) % Math.max(1, data.cards.length); reviewFlipped = false; renderCards(); break;
    case 'review-rating': if (button.dataset.rating === 'hard' || button.dataset.rating === 'good') markCardReviewed(button.dataset.rating); break;
    case 'quiz-start': startQuiz(); break;
    case 'quiz-answer': if (!quizState.answered) { quizState.selected = Number(button.dataset.index); quizState.answered = true; if (quizState.selected === quizState.questions[quizState.index].correct) quizState.score += 1; renderQuiz(); } break;
    case 'quiz-next': if (quizState.index + 1 >= quizState.questions.length) quizState.finished = true; else { quizState.index += 1; quizState.answered = false; quizState.selected = -1; } renderQuiz(); break;
    case 'navigate-cards': navigate('cards'); break;
    case 'week-prev': scheduleOffset -= 1; renderSchedule(); break;
    case 'week-next': scheduleOffset += 1; renderSchedule(); break;
    case 'week-today': scheduleOffset = 0; renderSchedule(); break;
    case 'focus-toggle': startFocus(); break;
    case 'focus-duration': setFocusDuration(button.dataset.minutes); break;
    case 'focus-reset': resetFocus(); break;
    case 'focus-finish': finishFocus(); break;
    case 'break-preset': setBreakPreset(button.dataset.minutes); break;
    case 'break-toggle': toggleBreakTimer(); break;
    case 'break-reset': resetBreakTimer(); break;
    case 'break-idea': cycleBreakIdea(); break;
    case 'daily-challenge-toggle': toggleDailyChallenge(); break;
    case 'setting-accent': if (data) { data.settings.accent = button.dataset.accent; saveAndApply(); renderSettings(); } break;
    case 'export-data': exportData(); break;
    case 'import-data': $('#importFile').click(); break;
    default: break;
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button) handleAction(button);
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  try {
    const formId = form.getAttribute('id');
    if (formId === 'authForm') submitAuth(event);
    else if (formId === 'taskDialogForm') submitTaskDialog(event);
    else if (formId === 'noteDialogForm') submitNoteDialog(event);
    else if (formId === 'cardDialogForm') submitCardDialog(event);
    else if (formId === 'sourceDialogForm') submitSourceDialog(event);
  } catch (error) {
    console.error('Lynquora form submission failed:', error);
    showToast('Chưa thể lưu nội dung. Dữ liệu vẫn ở trong biểu mẫu; hãy thử lại.', 'error');
  }
});
document.addEventListener('change', event => {
  if (!data) return;
  if (event.target.id === 'focusSubject') { focusState.subject = event.target.value; return; }
  if (event.target.id === 'settingTheme') { data.settings.theme = event.target.value; saveAndApply(); showToast('Đã đổi chế độ hiển thị.'); }
  if (event.target.id === 'settingGoal') { data.settings.dailyGoal = Number(event.target.value); saveData(); renderSettings(); showToast('Đã cập nhật mục tiêu hằng ngày.'); }
  if (event.target.id === 'sourceTypeFilter') { sourceTypeFilter = event.target.value || 'all'; renderSourceResults(); }
  if (event.target.id === 'sourceStatusFilter') { sourceStatusFilter = event.target.value || 'all'; renderSourceResults(); }
  if (event.target.matches('[data-source-status]')) {
    const source = data.resources.find(item => item.id === event.target.dataset.sourceStatus);
    if (source) { source.status = ['unread', 'reading', 'read'].includes(event.target.value) ? event.target.value : 'unread'; source.updatedAt = new Date().toISOString(); saveData(); renderSourceResults(); showToast('Đã cập nhật trạng thái đọc nguồn.'); }
  }
  if (event.target.id === 'importFile' && event.target.files?.[0]) importDataFile(event.target.files[0]);
});
document.addEventListener('input', event => {
  if (event.target.id === 'globalSearch') {
    searchQuery = event.target.value.trim();
    if (searchQuery && currentRoute !== 'tasks') { currentRoute = 'tasks'; updateActiveTokens(); }
    if (currentRoute === 'tasks') renderTasks();
  }
  if (event.target.id === 'sourceSearchInput' && currentRoute === 'sources') {
    sourceSearchQuery = event.target.value.trim();
    renderSourceResults();
  }
  if (event.target.id === 'settingFontSize' && data) {
    data.settings.fontSize = Number(event.target.value); applyAppearance(data.settings); saveData();
    const output = $('#fontSizeOutput'); if (output) output.textContent = `${data.settings.fontSize}px`;
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!$('#authModal').classList.contains('hidden')) closeAuth();
    if ($('#dialogHost').innerHTML) $('#dialogHost').innerHTML = '';
    closeSidebar();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#globalSearch').focus(); }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.id === 'reviewCard') { event.preventDefault(); reviewFlipped = !reviewFlipped; renderCards(); }
});
window.addEventListener('beforeunload', saveData);

// Use saved visual preferences even on the welcome screen.
applyAppearance(readPreferences());

// Keep the web app usable if a browser refuses local storage (for example, in restricted mode).
try { localStorage.setItem('lynquora.studyspace.v1.check', '1'); localStorage.removeItem('lynquora.studyspace.v1.check'); }
catch { showToast('Trình duyệt đang chặn bộ nhớ cục bộ; dữ liệu có thể không được lưu.', 'error'); }

// Restore the last active space on this browser. The session marker stores only
// the username/type, never the password; the marker is removed only on logout.
function restoreLoginSession() {
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { clearLoginSession(); return; }
  if (!session || typeof session !== 'object') return;
  if (session.isGuest === true) { enterGuest({ silent: true }); return; }
  const username = normalizeName(session.username);
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) { clearLoginSession(); return; }
  const account = getAccounts()[username];
  if (!account || account.username !== username) { clearLoginSession(); return; }
  loginUser(account);
}
restoreLoginSession();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { /* Hosting may disable service workers. */ }));
}
