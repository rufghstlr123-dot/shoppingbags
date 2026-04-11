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
    notepad: '',
    realStock: { XL: 0, L: 0, M: 0, S: 0 },
    realStockLastUpdated: '',
    prices: { XL: 249, L: 197, M: 171, S: 148 },
    priceHistory: [],
    currentUser: null,
    currentUserId: null,
    users: {}
};

const ADMIN_ID = "2119721";

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
                state.realStock = data.realStock || { XL: 0, L: 0, M: 0, S: 0 };
                state.realStockLastUpdated = data.realStockLastUpdated || '';
                state.prices = data.prices || { XL: 249, L: 197, M: 171, S: 148 };
                state.priceHistory = data.priceHistory || [];
                state.users = data.users || {
                    "2119721": "김원회 전임",
                    "1735073": "이효현 전임",
                    "2327696": "이지연 사원",
                    "2522160": "신우재 사원"
                };

                // Admin Seeding if not in DB
                if (!data.users && db) {
                    db.ref('sb_inventory/users').set(state.users);
                }

                renderDashboard();
                renderHistory();
                renderUserList();
                
                // If already logged in, update UI
                if (state.currentUserId) {
                    toggleAdminTab(state.currentUserId);
                }

                // Sync Price Inputsepad & Dashboard
                const np = document.getElementById('global-notepad');
                if (np && np.value !== state.notepad && document.activeElement !== np) {
                    np.value = state.notepad;
                }

                // Sync Price Inputs
                ['XL', 'L', 'M', 'S'].forEach(sz => {
                    const el = document.getElementById(`price-${sz}`);
                    if (el && document.activeElement !== el) {
                        el.value = state.prices[sz].toLocaleString();
                    }
                });
                
                // Instantly refresh all views for all users without refresh
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

    // Session Check
    const savedUserId = sessionStorage.getItem('sb_user_id');
    if (savedUserId) {
        db.ref('sb_inventory/users').once('value', (snap) => {
            const users = snap.val() || {};
            if (users[savedUserId]) {
                state.users = users;
                showApp(savedUserId, users[savedUserId]);
            } else {
                sessionStorage.removeItem('sb_user_id');
            }
        });
    }
}

function toggleAdminTab(userId) {
    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) {
        navAdmin.style.display = (userId === ADMIN_ID) ? 'flex' : 'none';
    }
}

function showApp(userId, username) {
    state.currentUserId = userId;
    state.currentUser = username;
    toggleAdminTab(userId);

    const loginPage = document.getElementById('login-page');
    const app = document.querySelector('.app-container');
    const displayUser = document.getElementById('display-user');
    
    if (displayUser) displayUser.innerHTML = `<i data-lucide="user"></i> ${username}님`;
    
    loginPage.style.opacity = '0';
    loginPage.style.pointerEvents = 'none';
    setTimeout(() => {
        loginPage.style.display = 'none';
        app.style.display = 'flex';
        renderDashboard(); 
        renderHistory();
        lucide.createIcons();
    }, 600);
}

function handleLogout() {
    sessionStorage.removeItem('sb_user_id');
    location.reload();
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

    // Real-time listener for Physical Stock inputs (Absolute Robust Sync)
    document.querySelectorAll('.real-input').forEach(input => {
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('click', (e) => e.stopPropagation());
        
        input.addEventListener('input', function() {
            // High-speed filtering
            let val = this.value.replace(/[^0-9]/g, '');
            const sz = this.id.split('-')[1];
            const numVal = parseInt(val, 10) || 0;
            
            // Instant local feedback (Comparison with system stock)
            const stockVal = parseInt(document.getElementById(`stock-${sz}`).textContent.replace(/,/g, ''), 10) || 0;
            const mismatchIcon = document.getElementById(`mismatch-${sz}`);
            if (mismatchIcon) {
                mismatchIcon.style.display = stockVal !== numVal ? 'block' : 'none';
            }

            // Sync without update loop
            state.realStock[sz] = numVal;
            const now = new Date();
            const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} | ${state.currentUser}(${state.currentUserId})`;
            state.realStockLastUpdated = timeStr;

            if (db) {
                db.ref(`sb_inventory/realStock/${sz}`).set(numVal);
                db.ref(`sb_inventory/realStockLastUpdated`).set(timeStr);
            }
            
            // Keep cursor at the end for smooth typing
            this.value = val; 
        });

        input.addEventListener('blur', function() {
            const numVal = parseInt(this.value.replace(/[^0-9]/g, ''), 10) || 0;
            this.value = numVal.toLocaleString();
        });

        input.addEventListener('focus', function() {
            const val = this.value.replace(/[^0-9]/g, '');
            this.value = val === '0' ? '' : val;
        });
    });

    // Price Input Listeners
    ['XL', 'L', 'M', 'S'].forEach(sz => {
        const el = document.getElementById(`price-${sz}`);
        if (el) {
            el.addEventListener('input', function() {
                let val = this.value.replace(/[^0-9]/g, '');
                const numVal = parseInt(val, 10) || 0;
                this.value = numVal.toLocaleString();
            });
            el.addEventListener('blur', function() {
                if (this.value === '') this.value = '0';
            });
        }
    });

    // Apply Price Changes
    const applyPriceBtn = document.getElementById('apply-price-btn');
    if (applyPriceBtn) {
        applyPriceBtn.addEventListener('click', () => {
            const now = new Date().toLocaleString('ko-KR');
            ['XL', 'L', 'M', 'S'].forEach(sz => {
                const el = document.getElementById(`price-${sz}`);
                const newVal = parseInt(el.value.replace(/,/g, ''), 10) || 0;
                const oldVal = state.prices[sz];

                // Record History for every item regardless of change
                const log = {
                    id: Date.now() + Math.random(),
                    timestamp: now,
                    size: sz,
                    from: oldVal,
                    to: newVal,
                    modifierId: state.currentUserId,
                    modifierName: state.currentUser
                };
                state.priceHistory.unshift(log);
                state.prices[sz] = newVal;
            });

            if (state.priceHistory.length > 100) state.priceHistory = state.priceHistory.slice(0, 100);
            
            if (db) {
                db.ref('sb_inventory').update({
                    prices: state.prices,
                    priceHistory: state.priceHistory
                });
            }
            showToast('단가가 적용되고 이력에 기록되었습니다.', 'success');
        });
    }

    // Price History Modal
    const priceHistModal = document.getElementById('price-history-modal');
    document.getElementById('price-history-btn').addEventListener('click', () => {
        renderPriceHistory();
        priceHistModal.classList.add('active');
    });
    document.getElementById('close-price-history').addEventListener('click', () => {
        priceHistModal.classList.remove('active');
    });

    document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);
    document.getElementById('export-report-btn').addEventListener('click', exportReportToExcel);
    document.getElementById('entry-part').addEventListener('change', updateTeamDisplay);
    document.getElementById('edit-part').addEventListener('change', () => {
        document.getElementById('edit-team').value = getTeamFromPart(document.getElementById('edit-part').value);
    });

    // Login Form Handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('username').value;
            const errorMsg = document.getElementById('login-error');

            if (state.users[id]) {
                sessionStorage.setItem('sb_user_id', id);
                showApp(id, state.users[id]);
            } else {
                errorMsg.style.display = 'block';
                setTimeout(() => { errorMsg.style.display = 'none'; }, 3000);
            }
        });
    }

    // Logout Handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Admin & Modal Listeners
    const addUserBtn = document.getElementById('add-user-btn');
    const userModal = document.getElementById('user-modal');
    if (addUserBtn) {
        addUserBtn.onclick = () => userModal?.classList.add('active');
    }

    const closeUserModal = document.getElementById('close-user-modal');
    if (closeUserModal) {
        closeUserModal.onclick = () => userModal?.classList.remove('active');
    }

    const saveUserBtn = document.getElementById('save-user-btn');
    if (saveUserBtn) {
        saveUserBtn.onclick = () => {
            const id = document.getElementById('new-user-id').value.trim();
            const name = document.getElementById('new-user-name').value.trim();
            if (!id || !name) return showToast('사원번호와 성함을 입력해주세요.', 'warning');
            state.users[id] = name;
            if (db) db.ref('sb_inventory/users').set(state.users);
            userModal.classList.remove('active');
            document.getElementById('new-user-id').value = '';
            document.getElementById('new-user-name').value = '';
            showToast('계정이 등록되었습니다.', 'success');
        };
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
    updateHeader();
    if (tabId === 'dashboard') renderDashboard();
    if (tabId === 'history') renderHistory();
    if (tabId === 'reports') renderReports();
    if (tabId === 'admin') renderUserList();
}

function updateHeader() {
    const titles = {
        'dashboard': { main: '대시보드', sub: '' },
        'in-out': { main: '입고 / 불출 등록', sub: '' },
        'history': { main: '거래 내역 조회', sub: '' },
        'reports': { main: '데이터 분석', sub: '' },
        'admin': { main: '계정 관리', sub: '' }
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

    // [운영 원칙] 총 금액은 '등록 시점'의 단가를 기준으로 고정 저장합니다.
    // 이후 단가가 변경되어도 이미 저장된 과거 내역의 금액은 변하지 않습니다.
    let totalAmount = 0;
    Object.keys(state.prices).forEach(size => { totalAmount += quantities[size] * state.prices[size]; });

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
        const real = state.realStock ? (state.realStock[sz] || 0) : 0;
        document.getElementById(`stock-${sz}`).textContent = stock.toLocaleString();
        document.getElementById(`in-${sz}`).textContent = totals.in[sz].toLocaleString();
        document.getElementById(`out-${sz}`).textContent = totals.out[sz].toLocaleString();
        
        const realEl = document.getElementById(`real-${sz}`);
        const mismatchIcon = document.getElementById(`mismatch-${sz}`);
        
        if (realEl) {
            // CRITICAL: Only update value if the user is NOT currently typing in THIS field
            if (document.activeElement !== realEl) {
                realEl.value = real.toLocaleString();
            }
        }

        // Show/Hide mismatch icon (Comparison alert)
        if (mismatchIcon) {
            mismatchIcon.style.display = stock !== real ? 'block' : 'none';
        }
    });

    // Update Last Updated Time
    const lastUpdateEl = document.getElementById('real-stock-last-updated');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = state.realStockLastUpdated ? `마지막 업데이트: ${state.realStockLastUpdated}` : '마지막 업데이트: -';
    }

    lucide.createIcons();
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
    // UTF-8 BOM for Excel compatibility
    let csvContent = "\uFEFF일자,구분,특대,대,중,소,팀,파트,브랜드,영수일자,POS번호,영수번호,금액,메모\n";
    state.entries.forEach(e => {
        const row = [
            e.date,
            e.type === 'in' ? '입고' : '불출',
            e.quantities.XL,
            e.quantities.L,
            e.quantities.M,
            e.quantities.S,
            e.team || '-',
            e.part || '-',
            `"${(e.brand || '-').replace(/"/g, '""')}"`,
            e.receiptDate || '-',
            e.pos || '-',
            e.receipt || '-',
            e.totalAmount,
            `"${(e.memo || '-').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(',') + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `쇼핑백_거래내역_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

function exportReportToExcel() {
    // UTF-8 BOM for Excel compatibility
    let csvContent = "\uFEFF=== 데이터 분석 리포트 ===\n";
    csvContent += `기간: ${document.getElementById('report-start-date').value} ~ ${document.getElementById('report-end-date').value}\n\n`;

    const tables = [
        { id: 'team-qty-table', title: '팀별 불출 현황 (수량)' },
        { id: 'team-cost-table', title: '팀별 불출 현황 (가격)' },
        { id: 'part-qty-table', title: '파트별 불출 현황 (수량)' },
        { id: 'part-cost-table', title: '파트별 불출 현황 (가격)' }
    ];

    tables.forEach(tableInfo => {
        const table = document.getElementById(tableInfo.id);
        if (!table) return;

        csvContent += `[${tableInfo.title}]\n`;
        
        // Headers
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent);
        csvContent += headers.join(',') + '\n';

        // Body
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        rows.forEach(tr => {
            const cells = Array.from(tr.querySelectorAll('td')).map(td => {
                let val = td.textContent.replace(/,/g, ''); // Remove commas from numbers
                if (val.includes('₩')) val = val.replace('₩', '').trim();
                return val;
            });
            csvContent += cells.join(',') + '\n';
        });
        csvContent += '\n'; // Add space between tables
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `쇼핑백_분석리포트_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

function renderPriceHistory() {
    const body = document.getElementById('price-history-body');
    if (!body) return;
    
    body.innerHTML = state.priceHistory.map(log => `
        <tr>
            <td style="font-size: 0.85rem;">${log.timestamp}</td>
            <td><span class="badge tag-${log.size.toLowerCase()}">${log.size === 'XL' ? '특대' : log.size === 'L' ? '대' : log.size === 'M' ? '중' : '소'}</span></td>
            <td style="color: #94a3b8; font-size: 0.9rem;">${(log.from || 0).toLocaleString()}원</td>
            <td style="font-weight: 700; font-size: 0.95rem;">${(log.to || 0).toLocaleString()}원</td>
            <td style="font-size: 0.85rem; color: #64748b;">${log.modifierName || '시스템'}(${log.modifierId || '-'})</td>
            <td style="text-align: right;">
                <button class="delete-btn-sm" onclick="deletePriceHistory('${log.id}')">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 40px;">변경 이력이 없습니다.</td></tr>';
    lucide.createIcons();
}

function deletePriceHistory(id) {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    state.priceHistory = state.priceHistory.filter(log => log.id !== id);
    if (db) db.ref('sb_inventory/priceHistory').set(state.priceHistory);
    renderPriceHistory();
    showToast('기록이 삭제되었습니다.', 'info');
}

function openEditModal(id) {
    const e = state.entries.find(entry => entry.id === id);
    if (!e) return;
    
    document.getElementById('edit-id').value = e.id;
    document.getElementById('edit-date').value = e.date;
    document.getElementById('edit-part').value = e.part;
    document.getElementById('edit-team').value = e.team || '';
    document.getElementById('edit-brand').value = e.brand;
    document.getElementById('edit-receipt-date').value = e.receiptDate === '-' ? '' : e.receiptDate;
    document.getElementById('edit-pos').value = e.pos === '-' ? '' : e.pos;
    document.getElementById('edit-receipt').value = e.receipt === '-' ? '' : e.receipt;
    document.getElementById('edit-memo').value = e.memo === '-' ? '' : e.memo;
    
    ['XL', 'L', 'M', 'S'].forEach(sz => {
        document.getElementById(`edit-q-${sz}`).value = (e.quantities[sz] || 0).toLocaleString();
    });

    // Handle visibility of out-specific fields
    const isOut = e.type === 'out';
    document.getElementById('edit-out-fields-container').style.opacity = isOut ? '1' : '0.3';
    document.getElementById('edit-receipt-row').style.opacity = isOut ? '1' : '0.3';
    document.getElementById('edit-part').disabled = !isOut;
    document.getElementById('edit-brand').disabled = !isOut;
    document.getElementById('edit-receipt-date').disabled = !isOut;
    document.getElementById('edit-pos').disabled = !isOut;
    document.getElementById('edit-receipt').disabled = !isOut;

    document.getElementById('edit-modal').classList.add('active');
}

function saveEdit() {
    const id = parseInt(document.getElementById('edit-id').value);
    const idx = state.entries.findIndex(e => e.id === id);
    if (idx === -1) return;

    const entry = state.entries[idx];
    const isOut = entry.type === 'out';
    
    const quantities = {
        XL: parseInt(document.getElementById('edit-q-XL').value.replace(/,/g, '')) || 0,
        L: parseInt(document.getElementById('edit-q-L').value.replace(/,/g, '')) || 0,
        M: parseInt(document.getElementById('edit-q-M').value.replace(/,/g, '')) || 0,
        S: parseInt(document.getElementById('edit-q-S').value.replace(/,/g, '')) || 0
    };
    
    let totalAmt = 0; 
    Object.keys(state.prices).forEach(sz => totalAmt += quantities[sz] * state.prices[sz]);

    const updatedPart = document.getElementById('edit-part').value;
    
    state.entries[idx] = { 
        ...entry, 
        date: document.getElementById('edit-date').value,
        part: updatedPart,
        team: isOut ? getTeamFromPart(updatedPart) : '-',
        brand: isOut ? (document.getElementById('edit-brand').value.trim() || '-') : '-',
        receiptDate: isOut ? (document.getElementById('edit-receipt-date').value || '-') : '-',
        pos: isOut ? (document.getElementById('edit-pos').value.trim() || '-') : '-',
        receipt: isOut ? (document.getElementById('edit-receipt').value.trim() || '-') : '-',
        memo: document.getElementById('edit-memo').value.trim() || '-',
        quantities, 
        totalAmount: totalAmt 
    };
    
    syncToFirebase(); 
    closeEditModal(); 
    showToast('수정이 완료되었습니다.', 'success');
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
            // [운영 원칙] 리포트 통계는 '현재 설정된 단가'를 기준으로 전체 수량을 재계산하여 보여줍니다.
            // 이는 과거 물동량을 현재의 가치(단가)로 통합 분석하기 위함입니다.
            const c = q * state.prices[sz];
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
            const vals = ['XL', 'L', 'M', 'S'].map(sz => fNum(mode === 'qty' ? d[sz] : d[sz] * state.prices[sz]));
            return `<tr><td>${item}</td>${vals.map(v => `<td>${v}</td>`).join('')}<td>${fNum(mode === 'qty' ? d.totalQty : d.totalCost)}</td></tr>`;
        }).join('') + `<tr><td>합계</td>${['XL', 'L', 'M', 'S'].map(sz => `<td>${fNum(mode === 'qty' ? colTotals[sz] : colTotals[sz] * state.prices[sz])}</td>`).join('')}<td>${fNum(mode === 'qty' ? colTotals.qty : colTotals.cost)}</td></tr>`;
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

// --- Admin & Support Functions ---
function renderUserList() {
    const body = document.getElementById('user-list-body');
    if (!body) return;
    
    body.innerHTML = Object.entries(state.users).map(([id, name]) => `
        <tr>
            <td style="font-weight: 600;">${id}</td>
            <td>${name}</td>
            <td style="text-align: right;">
                ${id === ADMIN_ID ? '<span class="badge tag-xl">마스터</span>' : 
                `<button class="delete-btn-sm" onclick="deleteUser('${id}')">삭제</button>`}
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" style="text-align: center; color: #94a3b8; padding: 40px;">등록된 계정이 없습니다.</td></tr>';
}

function deleteUser(id) {
    if (id === ADMIN_ID) return;
    if (confirm(`'${state.users[id]}' 계정을 삭제하시겠습니까?`)) {
        delete state.users[id];
        if (db) db.ref('sb_inventory/users').set(state.users);
        showToast('계정이 삭제되었습니다.');
    }
}

// Global scope for onclick
window.deleteUser = deleteUser;

// --- End of Script ---

