// ── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'gastos_v1';
const CATEGORIES_KEY = 'gastos_categories';

function loadExpenses() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveExpenses(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ── Categories storage ───────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: 'Supermercado',          emoji: '🛒' },
  { name: 'Delivery',              emoji: '🛵' },
  { name: 'Comer afuera',          emoji: '🍽️' },
  { name: 'Bares/alcohol',         emoji: '🍺' },
  { name: 'Compras varias',        emoji: '🛍️' },
  { name: 'Ropa',                  emoji: '👕' },
  { name: 'Salud',                 emoji: '💊' },
  { name: 'Peluquería',            emoji: '✂️' },
  { name: 'Ahorros',               emoji: '💰' },
  { name: 'Tarjeta $',             emoji: '💳' },
  { name: 'Préstamo',              emoji: '🏦' },
  { name: 'Alquiler',              emoji: '🏠' },
  { name: 'Garantía alquiler',     emoji: '🔑' },
  { name: 'Gastos comunes',        emoji: '🏢' },
  { name: 'Seguro auto',           emoji: '🚗' },
  { name: 'Nafta',                 emoji: '⛽' },
  { name: 'UTE',                   emoji: '⚡' },
  { name: 'Internet',              emoji: '🌐' },
  { name: 'Celular',               emoji: '📱' },
  { name: 'Tributos domiciliarios',emoji: '🏛️' },
  { name: 'Entradas evento',       emoji: '🎟️' },
  { name: 'Otros',                 emoji: '📦' },
];

function loadCategories() {
  try { return JSON.parse(localStorage.getItem(CATEGORIES_KEY)) || DEFAULT_CATEGORIES; }
  catch { return DEFAULT_CATEGORIES; }
}

function saveCategories(list) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list));
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function currentMonthStr() { return new Date().toISOString().slice(0, 7); }

function formatMoney(n, currency = 'ARS') {
  const num = n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return currency === 'USD' ? 'U$S ' + num : '$' + num;
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ── State ────────────────────────────────────────────────────────────────────

let expenses        = loadExpenses();
let categories      = loadCategories();
let selectedCategory = categories[0]?.name || 'Otros';
let selectedType    = 'gasto';
let selectedCurrency = 'ARS';
let historialCurrency = 'ARS';
let historialFilter = 'todo';
let pendingDeleteId = null;
let editingId       = null;
let editSelectedCategory = categories[0]?.name || 'Otros';
let chartData       = { catSorted: [], total: 0 };
let activeCategory  = null;
let editingCatIndex = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────

const amountInput  = document.getElementById('amount-input');
const noteInput    = document.getElementById('note-input');
const dateInput    = document.getElementById('date-input');
const saveBtn      = document.getElementById('save-btn');
const todayList    = document.getElementById('today-list');
const todayEmpty   = document.getElementById('today-empty');
const headerDate   = document.getElementById('header-date');
const toastEl      = document.getElementById('toast');
const modalOverlay = document.getElementById('modal-overlay');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel  = document.getElementById('modal-cancel');
const editOverlay  = document.getElementById('edit-overlay');
const editAmount   = document.getElementById('edit-amount');
const editDate     = document.getElementById('edit-date');
const editNote     = document.getElementById('edit-note');

// ── Category helpers ──────────────────────────────────────────────────────────

function categoryEmoji(name) {
  const cat = categories.find(c => c.name === name);
  return cat ? cat.emoji : '📦';
}

function renderCategoryButtons(containerId, activeName, onSelect) {
  const container = document.getElementById(containerId);
  container.innerHTML = categories.map(cat => `
    <button class="cat-btn${cat.name === activeName ? ' active' : ''}" data-cat="${cat.name}">
      ${cat.emoji}<span>${cat.name}</span>
    </button>
  `).join('');
  container.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(btn.dataset.cat);
    });
  });
}

// ── Type toggle ───────────────────────────────────────────────────────────────

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedType = btn.dataset.type;
    saveBtn.textContent = selectedType === 'ingreso' ? 'Guardar ingreso' : 'Guardar gasto';
    document.getElementById('amount-row').dataset.type = selectedType;
  });
});

// ── Currency toggle ───────────────────────────────────────────────────────────

document.querySelectorAll('.currency-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCurrency = btn.dataset.currency;
    document.getElementById('currency-symbol').textContent = selectedCurrency === 'USD' ? 'U$S' : '$';
  });
});

document.querySelectorAll('.hist-currency-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.hist-currency-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    historialCurrency = btn.dataset.currency;
    activeCategory = null;
    chartInited = false;
    renderHistorial();
  });
});

document.querySelectorAll('.hist-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.hist-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    historialFilter = btn.dataset.filter;
    activeCategory = null;
    chartInited = false;
    renderHistorial();
  });
});

// ── Tab navigation ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('view-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'historial') renderHistorial();
    if (tab.dataset.tab === 'ajustes') renderSettings();
  });
});

// ── Save expense ──────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', saveExpense);
amountInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveExpense(); });

function saveExpense() {
  const raw = amountInput.value.trim().replace(',', '.');
  const amount = parseFloat(raw);
  if (!raw || isNaN(amount) || amount <= 0) { shake(amountInput); return; }

  const expense = {
    id: Date.now().toString(),
    type: selectedType,
    currency: selectedCurrency,
    amount,
    category: selectedCategory,
    note: noteInput.value.trim(),
    date: dateInput.value || todayStr(),
    createdAt: new Date().toISOString(),
  };

  expenses.unshift(expense);
  saveExpenses(expenses);
  amountInput.value = '';
  noteInput.value = '';
  amountInput.focus();
  renderToday();
  showToast(selectedType === 'ingreso' ? 'Ingreso guardado ✓' : 'Gasto guardado ✓');
}

// ── Render: today ─────────────────────────────────────────────────────────────

function renderToday() {
  const today = todayStr();

  ['ARS', 'USD'].forEach(cur => {
    const all = expenses.filter(e => (e.currency || 'ARS') === cur);
    const todayItems = all.filter(e => e.date === today);
    const todayGastos   = todayItems.filter(e => e.type !== 'ingreso').reduce((s, e) => s + e.amount, 0);
    const todayIngresos = todayItems.filter(e => e.type === 'ingreso').reduce((s, e) => s + e.amount, 0);
    const totalIngresos = all.filter(e => e.type === 'ingreso').reduce((s, e) => s + e.amount, 0);
    const totalGastos   = all.filter(e => e.type !== 'ingreso').reduce((s, e) => s + e.amount, 0);
    const balance = totalIngresos - totalGastos;
    const prefix = cur.toLowerCase();
    const amountEl = document.getElementById(`balance-${prefix}-amount`);
    amountEl.textContent = formatMoney(Math.abs(balance), cur);
    amountEl.className = 'balance-card-amount ' + (balance >= 0 ? 'balance-positive' : 'balance-negative');
    document.getElementById(`${prefix}-gastos-hoy`).textContent   = formatMoney(todayGastos, cur);
    document.getElementById(`${prefix}-ingresos-hoy`).textContent = formatMoney(todayIngresos, cur);
  });

  headerDate.textContent = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const todayExpenses = expenses.filter(e => e.date === todayStr());
  if (todayExpenses.length === 0) {
    todayList.innerHTML = '';
    todayEmpty.style.display = 'block';
    return;
  }
  todayEmpty.style.display = 'none';
  todayList.innerHTML = todayExpenses.map(e => expenseItemHTML(e)).join('');
  attachDeleteListeners(todayList);
}

function expenseItemHTML(e) {
  const isIngreso = e.type === 'ingreso';
  const cur = e.currency || 'ARS';
  const emoji = isIngreso ? '💵' : categoryEmoji(e.category);
  const label = `${e.category}${e.note ? ' · ' + e.note : ''}`;
  const badge = cur === 'USD' ? '<span class="currency-badge">U$S</span>' : '';
  return `
    <li class="expense-item${isIngreso ? ' ingreso' : ''}" data-id="${e.id}">
      <div class="expense-emoji">${emoji}</div>
      <div class="expense-info">
        <div class="expense-cat">${label}${badge}</div>
        <div class="expense-time">${formatTime(e.createdAt)}</div>
      </div>
      <div class="expense-amount${isIngreso ? ' ingreso-amount' : ''}">
        ${isIngreso ? '+' : ''}${formatMoney(e.amount, cur)}
      </div>
      <button class="edit-btn" data-id="${e.id}" title="Editar">✏️</button>
      <button class="delete-btn" data-id="${e.id}" title="Eliminar">×</button>
    </li>
  `;
}

function attachDeleteListeners(container) {
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      pendingDeleteId = btn.dataset.id;
      modalOverlay.classList.remove('hidden');
    });
  });
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openEditModal(btn.dataset.id);
    });
  });
}

// ── Render: historial ─────────────────────────────────────────────────────────

function renderHistorial() {
  const month = currentMonthStr();
  const monthAll = expenses.filter(e => e.date.startsWith(month) && (e.currency || 'ARS') === historialCurrency);

  const filtered = historialFilter === 'gastos'
    ? monthAll.filter(e => e.type !== 'ingreso')
    : historialFilter === 'ingresos'
      ? monthAll.filter(e => e.type === 'ingreso')
      : monthAll;

  const monthTotal = filtered.reduce((s, e) => s + e.amount, 0);
  const avgDaily = monthTotal > 0 ? monthTotal / new Date().getDate() : 0;

  document.querySelector('#historial-summary .summary-card .summary-label').textContent =
    historialFilter === 'ingresos' ? 'Ingresos mes' : 'Gastos mes';
  document.getElementById('month-total').textContent = formatMoney(monthTotal);
  document.getElementById('avg-daily').textContent   = formatMoney(avgDaily);

  const forChart = historialFilter === 'todo'
    ? monthAll.filter(e => e.type !== 'ingreso')
    : filtered;

  const byCat = {};
  forChart.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const catSorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const chartTotal = forChart.reduce((s, e) => s + e.amount, 0);

  const monthName = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  document.getElementById('chart-title').textContent =
    (historialFilter === 'ingresos' ? 'Ingresos por categoría' : 'Gastos por categoría') + ' — ' + monthName;
  document.getElementById('donut-total').textContent = formatMoney(chartTotal);
  document.getElementById('chart-section').style.display = catSorted.length === 0 ? 'none' : 'block';

  if (catSorted.length > 0) {
    chartData = { catSorted, total: chartTotal };
    drawDonut(catSorted, chartTotal);
    renderCatTable(catSorted, chartTotal);
    initChartInteraction();
  }

  renderHistDays();
}

// ── Render: historial days ────────────────────────────────────────────────────

function renderHistDays() {
  let filtered = expenses.filter(e => (e.currency || 'ARS') === historialCurrency);
  filtered = historialFilter === 'gastos'
    ? filtered.filter(e => e.type !== 'ingreso')
    : historialFilter === 'ingresos'
      ? filtered.filter(e => e.type === 'ingreso')
      : filtered;

  if (activeCategory) filtered = filtered.filter(e => e.category === activeCategory);

  const activeFilterEl = document.getElementById('active-filter');
  if (activeCategory) {
    activeFilterEl.classList.remove('hidden');
    document.getElementById('active-filter-label').textContent = `${categoryEmoji(activeCategory)} ${activeCategory}`;
  } else {
    activeFilterEl.classList.add('hidden');
  }

  const byDay = {};
  filtered.forEach(e => {
    if (!byDay[e.date]) byDay[e.date] = [];
    byDay[e.date].push(e);
  });
  const daysSorted = Object.keys(byDay).sort((a, b) => b.localeCompare(a));

  const daysHTML = daysSorted.length === 0
    ? '<p class="hist-empty">No hay registros</p>'
    : daysSorted.map(date => {
        const items = byDay[date];
        const dayTotal = items.reduce((s, e) => s + e.amount, 0);
        return `
          <div class="day-group">
            <div class="day-header">
              <span class="day-label">${date === todayStr() ? 'Hoy' : formatDate(date)}</span>
              <span class="day-total">${formatMoney(dayTotal, historialCurrency)}</span>
            </div>
            <ul class="day-list">${items.map(e => expenseItemHTML(e)).join('')}</ul>
          </div>`;
      }).join('');

  const histDays = document.getElementById('historial-days');
  histDays.innerHTML = daysHTML;
  histDays.querySelectorAll('.day-list').forEach(ul => attachDeleteListeners(ul));
}

document.getElementById('clear-filter').addEventListener('click', () => {
  activeCategory = null;
  drawDonut(chartData.catSorted, chartData.total);
  renderHistDays();
});

// ── Chart interaction ─────────────────────────────────────────────────────────

const tooltip = document.getElementById('chart-tooltip');
let chartInited = false;

function getSliceAt(offsetX, offsetY) {
  const cx = 110, cy = 110, outerR = 95, innerR = 58;
  const dx = offsetX - cx, dy = offsetY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < innerR || dist > outerR) return -1;
  let angle = Math.atan2(dy, dx) - (-Math.PI / 2);
  if (angle < 0) angle += Math.PI * 2;
  let start = 0;
  const { catSorted, total } = chartData;
  for (let i = 0; i < catSorted.length; i++) {
    const slice = (catSorted[i][1] / total) * Math.PI * 2;
    if (angle >= start && angle < start + slice) return i;
    start += slice;
  }
  return -1;
}

function drawDonutHighlight(highlightIdx) {
  const { catSorted, total } = chartData;
  const canvas = document.getElementById('donut-chart');
  const ctx = canvas.getContext('2d');
  const size = 220, cx = 110, cy = 110, outerR = 95, innerR = 58, gap = 0.03;
  ctx.clearRect(0, 0, size, size);
  let start = -Math.PI / 2;
  catSorted.forEach(([, amount], i) => {
    const slice = (amount / total) * Math.PI * 2;
    const r  = i === highlightIdx ? outerR + 6 : outerR;
    const ri = i === highlightIdx ? innerR - 4 : innerR;
    ctx.beginPath();
    ctx.arc(cx, cy, r,  start + gap / 2, start + slice - gap / 2);
    ctx.arc(cx, cy, ri, start + slice - gap / 2, start + gap / 2, true);
    ctx.closePath();
    ctx.fillStyle = i === highlightIdx ? colorForIndex(i) : colorForIndex(i) + 'bb';
    ctx.fill();
    start += slice;
  });
}

function initChartInteraction() {
  if (chartInited) return;
  chartInited = true;
  const canvas = document.getElementById('donut-chart');

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const idx = getSliceAt(x, y);
    if (idx === -1) {
      tooltip.classList.add('hidden');
      drawDonut(chartData.catSorted, chartData.total);
      canvas.style.cursor = 'default';
      return;
    }
    canvas.style.cursor = 'pointer';
    drawDonutHighlight(idx);
    const [cat, amount] = chartData.catSorted[idx];
    const pct = (amount / chartData.total * 100).toFixed(1);
    tooltip.innerHTML = `
      <div class="tt-cat">${categoryEmoji(cat)} ${cat}</div>
      <div class="tt-amount">${formatMoney(amount)}</div>
      <div class="tt-pct">${pct}% del total</div>`;
    tooltip.classList.remove('hidden');
    const ttW = 180, ttH = 70;
    let left = e.clientX + 12, top = e.clientY - ttH / 2;
    if (left + ttW > window.innerWidth - 8) left = e.clientX - ttW - 12;
    if (top < 8) top = 8;
    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
  });

  canvas.addEventListener('mouseleave', () => {
    tooltip.classList.add('hidden');
    drawDonut(chartData.catSorted, chartData.total);
    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const idx = getSliceAt(x, y);
    if (idx === -1) return;
    const [cat] = chartData.catSorted[idx];
    activeCategory = activeCategory === cat ? null : cat;
    renderHistDays();
    if (activeCategory)
      document.getElementById('historial-days').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ── Delete modal ──────────────────────────────────────────────────────────────

modalCancel.addEventListener('click', () => { modalOverlay.classList.add('hidden'); pendingDeleteId = null; });
modalConfirm.addEventListener('click', () => {
  if (!pendingDeleteId) return;
  expenses = expenses.filter(e => e.id !== pendingDeleteId);
  saveExpenses(expenses);
  pendingDeleteId = null;
  modalOverlay.classList.add('hidden');
  renderToday();
  if (document.querySelector('.tab.active')?.dataset.tab === 'historial') renderHistorial();
  showToast('Eliminado');
});
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) { modalOverlay.classList.add('hidden'); pendingDeleteId = null; }
});

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

// ── Shake animation ───────────────────────────────────────────────────────────

function shake(el) {
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 400);
}

// ── Chart colors ──────────────────────────────────────────────────────────────

const CAT_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899',
  '#8b5cf6','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7',
  '#e11d48','#0ea5e9','#d97706','#059669','#7c3aed','#dc2626',
  '#0284c7','#65a30d','#c026d3','#b45309',
];
function colorForIndex(i) { return CAT_COLORS[i % CAT_COLORS.length]; }

// ── Donut chart ───────────────────────────────────────────────────────────────

function drawDonut(catSorted, total) {
  const canvas = document.getElementById('donut-chart');
  const ctx = canvas.getContext('2d');
  const size = 220, cx = size / 2, cy = size / 2, outerR = 95, innerR = 58, gap = 0.03;
  ctx.clearRect(0, 0, size, size);
  if (total === 0) return;
  let start = -Math.PI / 2;
  catSorted.forEach(([, amount], i) => {
    const slice = (amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, start + gap / 2, start + slice - gap / 2);
    ctx.arc(cx, cy, innerR, start + slice - gap / 2, start + gap / 2, true);
    ctx.closePath();
    ctx.fillStyle = colorForIndex(i);
    ctx.fill();
    start += slice;
  });
}

// ── Category table ────────────────────────────────────────────────────────────

function renderCatTable(catSorted, total) {
  document.getElementById('cat-table').innerHTML = catSorted.map(([cat, amount], i) => {
    const pct = total > 0 ? (amount / total * 100) : 0;
    return `
      <div class="cat-table-row">
        <div class="cat-table-dot" style="background:${colorForIndex(i)}"></div>
        <div class="cat-table-emoji">${categoryEmoji(cat)}</div>
        <div class="cat-table-name">${cat}</div>
        <div class="cat-table-pct">${pct < 1 ? '<1%' : pct.toFixed(1) + '%'}</div>
        <div class="cat-table-amount">${formatMoney(amount)}</div>
      </div>`;
  }).join('');
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function openEditModal(id) {
  const expense = expenses.find(e => e.id === id);
  if (!expense) return;
  editingId = id;
  editAmount.value = expense.amount;
  editDate.value   = expense.date;
  editNote.value   = expense.note || '';
  editSelectedCategory = expense.category;
  renderCategoryButtons('edit-categories', editSelectedCategory, cat => { editSelectedCategory = cat; });
  editOverlay.classList.remove('hidden');
  editAmount.focus();
  editAmount.select();
}

function closeEditModal() { editOverlay.classList.add('hidden'); editingId = null; }

document.getElementById('edit-close').addEventListener('click', closeEditModal);
document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
editOverlay.addEventListener('click', e => { if (e.target === editOverlay) closeEditModal(); });

document.getElementById('edit-save').addEventListener('click', () => {
  const raw = editAmount.value.trim().replace(',', '.');
  const amount = parseFloat(raw);
  if (!raw || isNaN(amount) || amount <= 0) { shake(editAmount); return; }
  expenses = expenses.map(e => e.id !== editingId ? e :
    { ...e, amount, category: editSelectedCategory, date: editDate.value || e.date, note: editNote.value.trim() });
  saveExpenses(expenses);
  closeEditModal();
  renderToday();
  if (document.querySelector('.tab.active')?.dataset.tab === 'historial') renderHistorial();
  showToast('Gasto actualizado ✓');
});

// ── Settings: category management ────────────────────────────────────────────

function renderSettings() {
  const list = document.getElementById('cat-settings-list');
  list.innerHTML = categories.map((cat, i) => `
    <div class="cat-settings-row">
      <span class="cat-settings-emoji">${cat.emoji}</span>
      <span class="cat-settings-name">${cat.name}</span>
      <button class="cat-settings-edit" data-index="${i}">✏️</button>
      <button class="cat-settings-delete" data-index="${i}">🗑️</button>
    </div>
  `).join('');

  list.querySelectorAll('.cat-settings-edit').forEach(btn => {
    btn.addEventListener('click', () => openCatModal(parseInt(btn.dataset.index)));
  });
  list.querySelectorAll('.cat-settings-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index);
      if (categories.length <= 1) { showToast('Debe haber al menos una categoría'); return; }
      categories.splice(i, 1);
      saveCategories(categories);
      if (selectedCategory === categories[i]?.name) selectedCategory = categories[0].name;
      renderSettings();
      renderCategoryButtons('categories', selectedCategory, cat => { selectedCategory = cat; });
      showToast('Categoría eliminada');
    });
  });
}

document.getElementById('add-cat-btn').addEventListener('click', () => openCatModal(null));

// ── Cat modal ─────────────────────────────────────────────────────────────────

function openCatModal(index) {
  editingCatIndex = index;
  const overlay = document.getElementById('cat-modal-overlay');
  const titleEl = document.getElementById('cat-modal-title');
  const emojiInput = document.getElementById('cat-modal-emoji');
  const nameInput  = document.getElementById('cat-modal-name');

  if (index !== null) {
    titleEl.textContent  = 'Editar categoría';
    emojiInput.value     = categories[index].emoji;
    nameInput.value      = categories[index].name;
  } else {
    titleEl.textContent  = 'Nueva categoría';
    emojiInput.value     = '';
    nameInput.value      = '';
  }
  overlay.classList.remove('hidden');
  nameInput.focus();
}

function closeCatModal() {
  document.getElementById('cat-modal-overlay').classList.add('hidden');
  editingCatIndex = null;
}

document.getElementById('cat-modal-close').addEventListener('click', closeCatModal);
document.getElementById('cat-modal-cancel').addEventListener('click', closeCatModal);
document.getElementById('cat-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('cat-modal-overlay')) closeCatModal();
});

document.getElementById('cat-modal-save').addEventListener('click', () => {
  const emoji = document.getElementById('cat-modal-emoji').value.trim() || '📦';
  const name  = document.getElementById('cat-modal-name').value.trim();
  if (!name) { shake(document.getElementById('cat-modal-name')); return; }

  if (editingCatIndex !== null) {
    categories[editingCatIndex] = { name, emoji };
  } else {
    categories.push({ name, emoji });
  }
  saveCategories(categories);
  closeCatModal();
  renderSettings();
  renderCategoryButtons('categories', selectedCategory, cat => { selectedCategory = cat; });
  showToast(editingCatIndex !== null ? 'Categoría actualizada ✓' : 'Categoría agregada ✓');
});

// ── Quick save (URL params from Shortcut) ─────────────────────────────────────

function checkQuickSave() {
  const p = new URLSearchParams(window.location.search);
  if (!p.get('quick')) return;
  const amount = parseFloat(p.get('amount'));
  if (!amount || isNaN(amount) || amount <= 0) return;
  const cat  = p.get('cat')  || categories[0]?.name || 'Otros';
  const type = p.get('type') || 'gasto';
  const cur  = p.get('cur')  || 'ARS';
  const note = p.get('note') || '';
  expenses.unshift({
    id: Date.now().toString(), type, currency: cur, amount,
    category: cat, note, date: todayStr(), createdAt: new Date().toISOString(),
  });
  saveExpenses(expenses);
  window.history.replaceState({}, '', '/');
  const overlay = document.getElementById('qs-overlay');
  document.getElementById('qs-emoji').textContent  = categoryEmoji(cat);
  document.getElementById('qs-cat').textContent    = cat;
  document.getElementById('qs-amount').textContent = (type === 'ingreso' ? '+' : '') + formatMoney(amount, cur);
  document.getElementById('qs-type').textContent   = type === 'ingreso' ? 'Ingreso guardado' : 'Gasto guardado';
  overlay.classList.remove('hidden');
}

document.getElementById('qs-close').addEventListener('click', () => {
  document.getElementById('qs-overlay').classList.add('hidden');
});

// ── Init ──────────────────────────────────────────────────────────────────────

dateInput.value = todayStr();
renderCategoryButtons('categories', selectedCategory, cat => { selectedCategory = cat; });
checkQuickSave();
renderToday();
amountInput.focus();

// ── Service Worker ────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
