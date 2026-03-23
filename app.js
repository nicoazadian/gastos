// ── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'gastos_v1';

function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveExpenses(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function currentMonthStr() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function formatMoney(n, currency = 'ARS') {
  const num = n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return currency === 'USD' ? 'U$S ' + num : '$' + num;
}

function formatTime(isoStr) {
  const date = new Date(isoStr);
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ── State ────────────────────────────────────────────────────────────────────

let expenses = loadExpenses();
let selectedCategory = 'Supermercado';
let selectedType = 'gasto';
let pendingDeleteId = null;
let editingId = null;
let editSelectedCategory = 'Supermercado';
let chartData = { catSorted: [], total: 0 };
let activeCategory = null;
let historialFilter = 'todo';
let selectedCurrency = 'ARS';
let historialCurrency = 'ARS';

// ── DOM refs ─────────────────────────────────────────────────────────────────

const amountInput    = document.getElementById('amount-input');
const noteInput      = document.getElementById('note-input');
const dateInput      = document.getElementById('date-input');
const saveBtn        = document.getElementById('save-btn');
const todayList      = document.getElementById('today-list');
const todayEmpty     = document.getElementById('today-empty');
const headerDate     = document.getElementById('header-date');
const toastEl        = document.getElementById('toast');
const modalOverlay   = document.getElementById('modal-overlay');
const modalConfirm   = document.getElementById('modal-confirm');
const modalCancel    = document.getElementById('modal-cancel');
const editOverlay    = document.getElementById('edit-overlay');
const editAmount     = document.getElementById('edit-amount');
const editDate       = document.getElementById('edit-date');
const editNote       = document.getElementById('edit-note');

// ── Type toggle (gasto / ingreso) ─────────────────────────────────────────────

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedType = btn.dataset.type;
    const isIngreso = selectedType === 'ingreso';
    document.getElementById('save-btn').textContent = isIngreso ? 'Guardar ingreso' : 'Guardar gasto';
    document.getElementById('amount-row').dataset.type = selectedType;
  });
});

// ── Category selection ────────────────────────────────────────────────────────

document.querySelectorAll('#categories .cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#categories .cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCategory = btn.dataset.cat;
  });
});

// ── Tab navigation ───────────────────────────────────────────────────────────

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

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('view-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'historial') renderHistorial();
  });
});

// ── Save expense ─────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', saveExpense);
amountInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveExpense(); });

function saveExpense() {
  const raw = amountInput.value.trim().replace(',', '.');
  const amount = parseFloat(raw);

  if (!raw || isNaN(amount) || amount <= 0) {
    shake(amountInput);
    return;
  }

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
    const todayGastos = todayItems.filter(e => e.type !== 'ingreso').reduce((s, e) => s + e.amount, 0);
    const todayIngresos = todayItems.filter(e => e.type === 'ingreso').reduce((s, e) => s + e.amount, 0);
    const totalIngresos = all.filter(e => e.type === 'ingreso').reduce((s, e) => s + e.amount, 0);
    const totalGastos = all.filter(e => e.type !== 'ingreso').reduce((s, e) => s + e.amount, 0);
    const balance = totalIngresos - totalGastos;

    const prefix = cur.toLowerCase();
    const amountEl = document.getElementById(`balance-${prefix}-amount`);
    amountEl.textContent = formatMoney(Math.abs(balance), cur);
    amountEl.className = 'balance-card-amount ' + (balance >= 0 ? 'balance-positive' : 'balance-negative');
    document.getElementById(`${prefix}-gastos-hoy`).textContent = formatMoney(todayGastos, cur);
    document.getElementById(`${prefix}-ingresos-hoy`).textContent = formatMoney(todayIngresos, cur);
  });

  const date = new Date();
  headerDate.textContent = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

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
  const today = new Date().getDate();
  const avgDaily = monthTotal > 0 ? monthTotal / today : 0;

  const summaryLabel = historialFilter === 'ingresos' ? 'Ingresos mes' : 'Gastos mes';
  document.querySelector('#historial-summary .summary-card .summary-label').textContent = summaryLabel;
  document.getElementById('month-total').textContent = formatMoney(monthTotal);
  document.getElementById('avg-daily').textContent = formatMoney(avgDaily);

  // Chart — only when filtering gastos or ingresos or todo (exclude mixed for avg)
  const forChart = historialFilter === 'todo'
    ? monthAll.filter(e => e.type !== 'ingreso')  // chart always shows gastos breakdown
    : filtered;

  const byCat = {};
  forChart.forEach(e => {
    byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  });
  const catSorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const chartTotal = forChart.reduce((s, e) => s + e.amount, 0);

  const monthName = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const chartLabel = historialFilter === 'ingresos' ? 'Ingresos por categoría' : 'Gastos por categoría';
  document.getElementById('chart-title').textContent = `${chartLabel} — ${monthName}`;
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

// ── Render: historial days (filterable) ───────────────────────────────────────

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
    document.getElementById('active-filter-label').textContent =
      `${categoryEmoji(activeCategory)} ${activeCategory}`;
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
    ? '<p class="hist-empty">No hay gastos registrados</p>'
    : daysSorted.map(date => {
        const items = byDay[date];
        const dayTotal = items.reduce((s, e) => s + e.amount, 0);
        const isToday = date === todayStr();
        return `
          <div class="day-group">
            <div class="day-header">
              <span class="day-label">${isToday ? 'Hoy' : formatDate(date)}</span>
              <span class="day-total">${formatMoney(dayTotal, historialCurrency)}</span>
            </div>
            <ul class="day-list">
              ${items.map(e => expenseItemHTML(e)).join('')}
            </ul>
          </div>
        `;
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
  const size = 220, cx = 110, cy = 110;
  const outerR = 95, innerR = 58, gap = 0.03;

  ctx.clearRect(0, 0, size, size);
  let start = -Math.PI / 2;
  catSorted.forEach(([, amount], i) => {
    const slice = (amount / total) * Math.PI * 2;
    const startA = start + gap / 2, endA = start + slice - gap / 2;
    const r = i === highlightIdx ? outerR + 6 : outerR;
    const ri = i === highlightIdx ? innerR - 4 : innerR;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startA, endA);
    ctx.arc(cx, cy, ri, endA, startA, true);
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
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
      <div class="tt-pct">${pct}% del total</div>
    `;
    tooltip.classList.remove('hidden');

    const ttW = 180, ttH = 70;
    let left = e.clientX + 12;
    let top = e.clientY - ttH / 2;
    if (left + ttW > window.innerWidth - 8) left = e.clientX - ttW - 12;
    if (top < 8) top = 8;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  });

  canvas.addEventListener('mouseleave', () => {
    tooltip.classList.add('hidden');
    drawDonut(chartData.catSorted, chartData.total);
    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const idx = getSliceAt(x, y);
    if (idx === -1) return;

    const [cat] = chartData.catSorted[idx];
    activeCategory = activeCategory === cat ? null : cat;
    renderHistDays();

    if (activeCategory) {
      document.getElementById('historial-days').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// ── Delete modal ─────────────────────────────────────────────────────────────

modalCancel.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
  pendingDeleteId = null;
});

modalConfirm.addEventListener('click', () => {
  if (pendingDeleteId) {
    expenses = expenses.filter(e => e.id !== pendingDeleteId);
    saveExpenses(expenses);
    pendingDeleteId = null;
    modalOverlay.classList.add('hidden');
    renderToday();
    const activeTab = document.querySelector('.tab.active')?.dataset.tab;
    if (activeTab === 'historial') renderHistorial();
    showToast('Gasto eliminado');
  }
});

modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.add('hidden');
    pendingDeleteId = null;
  }
});

// ── Toast ────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

// ── Shake animation ──────────────────────────────────────────────────────────

function shake(el) {
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 400);
}

// ── Category emoji map ────────────────────────────────────────────────────────

function categoryEmoji(cat) {
  const map = {
    'Supermercado': '🛒',
    'Delivery': '🛵',
    'Comer afuera': '🍽️',
    'Bares/alcohol': '🍺',
    'Compras varias': '🛍️',
    'Ropa': '👕',
    'Salud': '💊',
    'Peluquería': '✂️',
    'Ahorros': '💰',
    'Tarjeta $': '💳',
    'Préstamo': '🏦',
    'Alquiler': '🏠',
    'Garantía alquiler': '🔑',
    'Gastos comunes': '🏢',
    'Seguro auto': '🚗',
    'Nafta': '⛽',
    'UTE': '⚡',
    'Internet': '🌐',
    'Celular': '📱',
    'Tributos domiciliarios': '🏛️',
    'Entradas evento': '🎟️',
    'Otros': '📦',
  };
  return map[cat] || '📦';
}

// ── Chart colors ─────────────────────────────────────────────────────────────

const CAT_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899',
  '#8b5cf6','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7',
  '#e11d48','#0ea5e9','#d97706','#059669','#7c3aed','#dc2626',
  '#0284c7','#65a30d','#c026d3','#b45309',
];

function colorForIndex(i) {
  return CAT_COLORS[i % CAT_COLORS.length];
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function drawDonut(catSorted, total) {
  const canvas = document.getElementById('donut-chart');
  const ctx = canvas.getContext('2d');
  const size = 220;
  const cx = size / 2, cy = size / 2;
  const outerR = 95, innerR = 58;
  const gap = 0.03;

  ctx.clearRect(0, 0, size, size);
  if (total === 0) return;

  let start = -Math.PI / 2;

  catSorted.forEach(([, amount], i) => {
    const slice = (amount / total) * Math.PI * 2;
    const startA = start + gap / 2;
    const endA = start + slice - gap / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startA, endA);        // outer arc CW
    ctx.arc(cx, cy, innerR, endA, startA, true);  // inner arc CCW
    ctx.closePath();
    ctx.fillStyle = colorForIndex(i);
    ctx.fill();

    start += slice;
  });
}

// ── Category table ────────────────────────────────────────────────────────────

function renderCatTable(catSorted, total) {
  const html = catSorted.map(([cat, amount], i) => {
    const pct = total > 0 ? (amount / total * 100) : 0;
    const pctStr = pct < 1 ? '<1%' : pct.toFixed(1) + '%';
    return `
      <div class="cat-table-row">
        <div class="cat-table-dot" style="background:${colorForIndex(i)}"></div>
        <div class="cat-table-emoji">${categoryEmoji(cat)}</div>
        <div class="cat-table-name">${cat}</div>
        <div class="cat-table-pct">${pctStr}</div>
        <div class="cat-table-amount">${formatMoney(amount)}</div>
      </div>
    `;
  }).join('');
  document.getElementById('cat-table').innerHTML = html;
}

// ── Edit modal ────────────────────────────────────────────────────────────────

document.querySelectorAll('#edit-categories .cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#edit-categories .cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    editSelectedCategory = btn.dataset.cat;
  });
});

function openEditModal(id) {
  const expense = expenses.find(e => e.id === id);
  if (!expense) return;
  editingId = id;

  editAmount.value = expense.amount;
  editDate.value = expense.date;
  editNote.value = expense.note || '';
  editSelectedCategory = expense.category;

  document.querySelectorAll('#edit-categories .cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === expense.category);
  });

  editOverlay.classList.remove('hidden');
  editAmount.focus();
  editAmount.select();
}

function closeEditModal() {
  editOverlay.classList.add('hidden');
  editingId = null;
}

document.getElementById('edit-close').addEventListener('click', closeEditModal);
document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
editOverlay.addEventListener('click', e => { if (e.target === editOverlay) closeEditModal(); });

document.getElementById('edit-save').addEventListener('click', () => {
  const raw = editAmount.value.trim().replace(',', '.');
  const amount = parseFloat(raw);
  if (!raw || isNaN(amount) || amount <= 0) { shake(editAmount); return; }

  expenses = expenses.map(e => {
    if (e.id !== editingId) return e;
    return { ...e, amount, category: editSelectedCategory, date: editDate.value || e.date, note: editNote.value.trim() };
  });

  saveExpenses(expenses);
  closeEditModal();
  renderToday();
  const activeTab = document.querySelector('.tab.active')?.dataset.tab;
  if (activeTab === 'historial') renderHistorial();
  showToast('Gasto actualizado ✓');
});

// ── Init ─────────────────────────────────────────────────────────────────────

dateInput.value = todayStr();
renderToday();
amountInput.focus();

// ── Service Worker registration ───────────────────────────────────────────────

if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
