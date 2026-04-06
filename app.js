// --- Firebase Configuration (사용자님의 파이어베이스 설정값을 이곳에 입력하세요) ---
const firebaseConfig = {
    apiKey: "AIzaSy... (사용자님의 API Key를 입력하세요)",
    authDomain: "shoppingbags-9e0e3.firebaseapp.com",
    databaseURL: "https://shoppingbags-9e0e3-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "shoppingbags-9e0e3",
    storageBucket: "shoppingbags-9e0e3.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

// Initialize Firebase
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) {
    console.error("Firebase initialization failed:", e);
}

// State management
let state = {
    entries: [],
    currentView: 'dashboard',
    entryType: 'in',
    notepad: ''
};

const PRICES = { XL: 730, L: 520, M: 350, S: 240 };
const PARTS = ["남성패션", "여성패션", "해외패션", "영패션", "아동스포츠", "리빙", "식품", "기타"];

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    setupEventListeners();
    initApp();
});

function initApp() {
    // Start Real-time listener for Firebase
    if (db) {
        db.ref('sb_inventory').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                state.entries = data.entries || [];
                state.notepad = data.notepad || '';
                
                // Sync UI with Cloud Data
                const np = document.getElementById('global-notepad');
                if (np && np.value !== state.notepad) np.value = state.notepad;
                
                renderDashboard();
                renderHistory();
                renderReports();
            }
        });
    }

    document.getElementById('entry-date').value = '';
    setEntryType('in');
    
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    
    const reportStart = document.getElementById('report-start-date');
    const reportEnd = document.getElementById('report-end-date');
    if (reportStart) reportStart.value = formatDate(firstDay);
    if (reportEnd) reportEnd.value = formatDate(lastDay);
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => resetForm(btn.dataset.type));
    });

    document.getElementById('transaction-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleSubmit();
    });

    document.getElementById('history-start-date').addEventListener('input', renderHistory);
    document.getElementById('history-end-date').addEventListener('input', renderHistory);
    document.getElementById('history-type-filter').addEventListener('change', renderHistory);
    document.getElementById('history-team-filter').addEventListener('change', renderHistory);
    document.getElementById('history-part-filter').addEventListener('change', renderHistory);

    const applyMask = (e) => {
        let val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length > 8) val = val.slice(0, 8);
        let formatted = val;
        if (val.length >= 5) {
            formatted = val.slice(0, 4) + '-' + val.slice(4, 6);
            if (val.length >= 7) formatted += '-' + val.slice(6, 8);
        }
        e.target.value = formatted;
        if (['history-start-date', 'history-end-date'].includes(e.target.id)) renderHistory();
    };

    ['entry-date', 'entry-receipt-date', 'history-start-date', 'history-end-date', 'edit-date', 'edit-receipt-date', 'report-start-date', 'report-end-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', applyMask);
    });

    const qInputs = document.querySelectorAll('input[id^="q-"], input[id^="edit-q-"]');
    qInputs.forEach(input => {
        input.addEventListener('input', function() {
            let val = this.value.replace(/[^0-9]/g, '');
            this.value = val ? parseInt(val, 10).toLocaleString() : '';
        });
        input.addEventListener('blur', function() { if (this.value === '') this.value = '0'; });
        input.addEventListener('focus', function() { if (this.value === '0') this.value = ''; });
    });

    document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);
    document.getElementById('entry-part').addEventListener('change', updateTeamDisplay);
    document.getElementById('edit-part').addEventListener('change', () => {
        document.getElementById('edit-team').value = getTeamFromPart(document.getElementById('edit-part').value);
    });

    const enterBtn = document.getElementById('enter-btn');
    if (enterBtn) {
        enterBtn.addEventListener('click', () => {
            const landing = document.getElementById('landing-page');
            const app = document.querySelector('.app-container');
            landing.style.opacity = '0';
            landing.style.pointerEvents = 'none';
            setTimeout(() => {
                landing.style.display = 'none';
                app.style.display = 'flex';
                setTimeout(() => { renderDashboard(); renderHistory(); }, 50);
            }, 600);
        });
    }

    const notepad = document.getElementById('global-notepad');
    if (notepad && db) {
        notepad.addEventListener('input', (e) => {
            state.notepad = e.target.value;
            db.ref('sb_inventory/notepad').set(state.notepad);
        });
    }

    // Connect report-start-date and report-end-date specifically for real-time report refresh
    document.getElementById('report-start-date').addEventListener('input', renderReports);
    document.getElementById('report-end-date').addEventListener('input', renderReports);
}

function updateTeamDisplay() {
    const part = document.getElementById('entry-part').value;
    document.getElementById('entry-team').value = getTeamFromPart(part);
}

function getTeamFromPart(part) {
    if (["남성패션", "여성패션", "해외패션", "영패션"].includes(part)) return "패션팀";
    if (["아동스포츠", "리빙", "식품"].includes(part)) return "라이프스타일팀";
    if (part === "대전점") return "";
    return "기타";
}

function switchTab(tabId) {
    if (state.currentView === 'in-out' || tabId === 'in-out') resetForm();
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.toggle('active', tab.id === tabId));
    state.currentView = tabId;
    updateHeader();
    if (tabId === 'dashboard') renderDashboard();
    if (tabId === 'history') renderHistory();
    if (tabId === 'reports') renderReports();
}

function updateHeader() {
    const titles = {
        'dashboard': { main: '대시보드', sub: '' },
        'in-out': { main: '입고 / 불출 등록', sub: '' },
        'history': { main: '거래 내역 조회', sub: '' },
        'reports': { main: '데이터 분석', sub: '' }
    };
    document.getElementById('tab-title').textContent = titles[state.currentView].main;
    document.getElementById('tab-subtitle').textContent = titles[state.currentView].sub;
}

function setEntryType(type) {
    state.entryType = type;
    document.getElementById('entry-type').value = type;
    document.querySelectorAll('.type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));

    const fields = ['entry-part', 'entry-brand', 'entry-receipt-date', 'entry-pos', 'entry-receipt'];
    const isDisabled = type === 'in';
    fields.forEach(id => document.getElementById(id).disabled = isDisabled);
    document.getElementById('entry-part').value = isDisabled ? "대전점" : "남성패션";
    if (isDisabled) {
        document.getElementById('entry-brand').value = "";
        document.getElementById('entry-receipt-date').value = "";
        document.getElementById('entry-pos').value = "";
        document.getElementById('entry-receipt').value = "";
    }
    document.getElementById('out-fields').style.opacity = isDisabled ? '0.3' : '1';
    document.getElementById('entry-team').parentElement.style.opacity = isDisabled ? '0.3' : '1';
    updateTeamDisplay();
}

function handleSubmit() {
    const type = state.entryType;
    const date = document.getElementById('entry-date').value;
    const part = document.getElementById('entry-part').value;
    const quantities = {
        XL: parseInt(document.getElementById('q-XL').value.replace(/,/g, '')) || 0,
        L: parseInt(document.getElementById('q-L').value.replace(/,/g, '')) || 0,
        M: parseInt(document.getElementById('q-M').value.replace(/,/g, '')) || 0,
        S: parseInt(document.getElementById('q-S').value.replace(/,/g, '')) || 0
    };

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return showToast('일자를 정확히 입력해주세요.', 'warning');
    if (Object.values(quantities).reduce((a, b) => a + b, 0) === 0) return showToast('수량을 입력해주세요.', 'warning');

    let totalAmount = 0;
    Object.keys(PRICES).forEach(size => { totalAmount += quantities[size] * PRICES[size]; });

    const entry = {
        id: Date.now(), type, date,
        team: type === 'out' ? getTeamFromPart(part) : '-',
        part: type === 'out' ? part : '대전점',
        brand: type === 'out' ? (document.getElementById('entry-brand').value.trim() || '-') : '-',
        receiptDate: type === 'out' ? (document.getElementById('entry-receipt-date').value || '-') : '-',
        pos: type === 'out' ? (document.getElementById('entry-pos').value.trim() || '-') : '-',
        receipt: type === 'out' ? (document.getElementById('entry-receipt').value.trim() || '-') : '-',
        memo: document.getElementById('entry-memo').value.trim() || '-',
        quantities, totalAmount
    };

    state.entries.unshift(entry);
    syncToFirebase();
    resetForm();
    showToast('등록되었습니다.', 'success');
}

function resetForm(typeOverride = 'in') {
    document.getElementById('transaction-form').reset();
    ['XL', 'L', 'M', 'S'].forEach(sz => document.getElementById(`q-${sz}`).value = '0');
    setEntryType(typeOverride);
}

function syncToFirebase() {
    if (db) db.ref('sb_inventory/entries').set(state.entries);
}

function renderDashboard() {
    const totals = { in: {XL:0,L:0,M:0,S:0}, out: {XL:0,L:0,M:0,S:0}, stock: {XL:0,L:0,M:0,S:0} };
    state.entries.forEach(e => {
        ['XL', 'L', 'M', 'S'].forEach(sz => totals[e.type][sz] += (e.quantities[sz] || 0));
    });
    ['XL', 'L', 'M', 'S'].forEach(sz => {
        const stock = totals.in[sz] - totals.out[sz];
        document.getElementById(`stock-${sz}`).textContent = stock.toLocaleString();
        document.getElementById(`in-${sz}`).textContent = totals.in[sz].toLocaleString();
        document.getElementById(`out-${sz}`).textContent = totals.out[sz].toLocaleString();
    });
}

function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    const filters = {
        start: document.getElementById('history-start-date').value,
        end: document.getElementById('history-end-date').value,
        type: document.getElementById('history-type-filter').value,
        team: document.getElementById('history-team-filter').value,
        part: document.getElementById('history-part-filter').value
    };

    let filtered = state.entries.filter(e => {
        return (!filters.start || e.date >= filters.start) &&
               (!filters.end || e.date <= filters.end) &&
               (filters.type === 'all' || e.type === filters.type) &&
               (filters.team === 'all' || (e.team || '-') === filters.team) &&
               (filters.part === 'all' || e.part === filters.part);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding: 40px;">내역 없음</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(e => `
        <tr>
            <td>${e.date}</td>
            <td class="${e.type === 'in' ? 'badge-in' : 'badge-out'}">${e.type === 'in' ? '입고' : '불출'}</td>
            <td>${e.quantities.XL.toLocaleString()}</td>
            <td>${e.quantities.L.toLocaleString()}</td>
            <td>${e.quantities.M.toLocaleString()}</td>
            <td>${e.quantities.S.toLocaleString()}</td>
            <td><strong>${e.team || '-'}</strong></td>
            <td><strong>${e.part}</strong></td>
            <td>${e.brand}</td>
            <td>${e.receiptDate || '-'}</td>
            <td>${e.pos || '-'}</td>
            <td>${e.receipt || '-'}</td>
            <td>₩ ${e.totalAmount.toLocaleString()}</td>
            <td><small>${e.memo || '-'}</small></td>
            <td><button class="btn-manage" onclick="openEditModal(${e.id})">수정</button></td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function exportToExcel() {
    let csvContent = "\uFEFF일자,구분,특대,대,중,소,팀,파트,브랜드,금액,메모\n";
    state.entries.forEach(e => {
        csvContent += `${e.date},${e.type === 'in' ? '입고' : '불출'},${e.quantities.XL},${e.quantities.L},${e.quantities.M},${e.quantities.S},${e.team},${e.part},${e.brand},${e.totalAmount},${e.memo}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = '거래내역.csv'; link.click();
}

function openEditModal(id) {
    const e = state.entries.find(entry => entry.id === id);
    if (!e) return;
    document.getElementById('edit-id').value = e.id;
    document.getElementById('edit-date').value = e.date;
    document.getElementById('edit-part').value = e.part;
    document.getElementById('edit-team').value = e.team || '';
    document.getElementById('edit-brand').value = e.brand;
    document.getElementById('edit-memo').value = e.memo || '';
    ['XL', 'L', 'M', 'S'].forEach(sz => document.getElementById(`edit-q-${sz}`).value = e.quantities[sz].toLocaleString());
    document.getElementById('edit-modal').classList.add('active');
}

function saveEdit() {
    const id = parseInt(document.getElementById('edit-id').value);
    const idx = state.entries.findIndex(e => e.id === id);
    if (idx === -1) return;
    const quantities = {
        XL: parseInt(document.getElementById('edit-q-XL').value.replace(/,/g, '')) || 0,
        L: parseInt(document.getElementById('edit-q-L').value.replace(/,/g, '')) || 0,
        M: parseInt(document.getElementById('edit-q-M').value.replace(/,/g, '')) || 0,
        S: parseInt(document.getElementById('edit-q-S').value.replace(/,/g, '')) || 0
    };
    let totalAmt = 0; Object.keys(PRICES).forEach(sz => totalAmt += quantities[sz] * PRICES[sz]);
    state.entries[idx] = { ...state.entries[idx], date: document.getElementById('edit-date').value, quantities, totalAmount: totalAmt };
    syncToFirebase(); closeEditModal(); showToast('수정되었습니다.', 'success');
}

function deleteFromModal() {
    const id = parseInt(document.getElementById('edit-id').value);
    if (confirm('삭제하시겠습니까?')) {
        state.entries = state.entries.filter(e => e.id !== id);
        syncToFirebase(); closeEditModal(); showToast('삭제되었습니다.');
    }
}

function renderReports() {
    const start = document.getElementById('report-start-date').value;
    const end = document.getElementById('report-end-date').value;
    const filtered = state.entries.filter(e => e.type === 'out' && (!start || e.date >= start) && (!end || e.date <= end));
    const teams = ['패션팀', '라이프스타일팀', '기타'];
    const matrix = {}; teams.forEach(t => matrix[t] = { XL:0, L:0, M:0, S:0, totalQty:0, totalCost:0 });
    const colTotals = { XL:0, L:0, M:0, S:0, qty:0, cost:0 };
    const pMatrix = {}; PARTS.forEach(p => pMatrix[p] = { XL:0, L:0, M:0, S:0, totalQty:0, totalCost:0 });

    filtered.forEach(e => {
        const t = teams.includes(e.team) ? e.team : '기타';
        const p = PARTS.includes(e.part) ? e.part : '기타';
        ['XL', 'L', 'M', 'S'].forEach(sz => {
            const q = e.quantities[sz] || 0;
            const c = q * PRICES[sz];
            matrix[t][sz] += q; matrix[t].totalQty += q; matrix[t].totalCost += c;
            pMatrix[p][sz] += q; pMatrix[p].totalQty += q; pMatrix[p].totalCost += c;
            colTotals[sz] += q; colTotals.qty += q; colTotals.cost += c;
        });
    });

    const fNum = (v) => (v || 0).toLocaleString();
    const renderTable = (id, items, data, mode) => {
        const body = document.querySelector(`#${id} tbody`); if (!body) return;
        body.innerHTML = items.map(item => {
            const d = data[item];
            const vals = ['XL', 'L', 'M', 'S'].map(sz => fNum(mode === 'qty' ? d[sz] : d[sz] * PRICES[sz]));
            return `<tr><td>${item}</td>${vals.map(v => `<td>${v}</td>`).join('')}<td>${fNum(mode === 'qty' ? d.totalQty : d.totalCost)}</td></tr>`;
        }).join('') + `<tr><td>합계</td>${['XL', 'L', 'M', 'S'].map(sz => `<td>${fNum(mode === 'qty' ? colTotals[sz] : colTotals[sz] * PRICES[sz])}</td>`).join('')}<td>${fNum(mode === 'qty' ? colTotals.qty : colTotals.cost)}</td></tr>`;
    };

    renderTable('team-qty-table', teams, matrix, 'qty');
    renderTable('team-cost-table', teams, matrix, 'cost');
    renderTable('part-qty-table', PARTS, pMatrix, 'qty');
    renderTable('part-cost-table', PARTS, pMatrix, 'cost');
    lucide.createIcons();
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('notifications'); if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`; toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

function closeEditModal() { document.getElementById('edit-modal').classList.remove('active'); }
