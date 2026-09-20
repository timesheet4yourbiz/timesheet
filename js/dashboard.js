import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let activeTab = 'summary';
let currentChart = null;
let employeeMap = {};

// Palet warna untuk setiap projek/kategori (Mirip gaya profesional)
const colorPalette = [
    '#84cc16', // Hijau (Mirip Clockify)
    '#3b82f6', // Biru
    '#f59e0b', // Oren
    '#8b5cf6', // Ungu
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#ef4444', // Merah
    '#f97316', // Jingga
    '#06b6d4', // Cyan
    '#10b981'  // Emerald
];

let filterState = {
    datePreset: 'this_month',
    startDate: '',
    endDate: '',
    projectId: 'all',
    taskId: 'all',
    employeeId: 'all',
    groupBy: 'project'
};

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';

    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;

    setupNavigation();
    initDatePresets();
    await renderSummaryReport();
});

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            e.target.classList.add('active');
            activeTab = e.target.getAttribute('data-tab');

            if (activeTab === 'summary') {
                renderSummaryReport();
            } else {
                const view = document.getElementById('reportContentView');
                if (view) {
                    view.innerHTML = `
                        <div class="report-section empty-state">
                            <h3 style="color:#475569;">Modul ${activeTab.toUpperCase()} Akan Datang</h3>
                            <p>Bahagian ini dijadualkan untuk fasa pembangunan seterusnya.</p>
                        </div>`;
                }
            }
        });
    });
}

function initDatePresets() {
    const dates = calculatePresetDates('this_month');
    filterState.startDate = dates.startDate;
    filterState.endDate = dates.endDate;
}

function calculatePresetDates(preset) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'today') {
        start = new Date();
        end = new Date();
    } else if (preset === 'yesterday') {
        start.setDate(now.getDate() - 1);
        end.setDate(now.getDate() - 1);
    } else if (preset === 'this_week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        end = new Date(start);
        end.setDate(start.getDate() + 6);
    } else if (preset === 'last_week') {
        const day = now.getDay();
        const diff = now.getDate() - day - 6 + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        end = new Date(start);
        end.setDate(start.getDate() + 6);
    } else if (preset === 'this_month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'last_month') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === 'this_year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
    }

    return {
        startDate: start.toLocaleDateString('en-CA'),
        endDate: end.toLocaleDateString('en-CA')
    };
}

function formatHMS(seconds) {
    if (!seconds || seconds <= 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

async function renderSummaryReport() {
    const container = document.getElementById('reportContentView');
    if (!container) return;
    
    container.innerHTML = `
        <div class="filter-panel">
            <div class="filter-group">
                <select id="filterPreset" class="filter-select">
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="this_week">This Week</option>
                    <option value="last_week">Last Week</option>
                    <option value="this_month" selected>This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="this_year">This Year</option>
                    <option value="custom">Custom Range</option>
                </select>

                <input type="date" id="startDateInput" class="filter-input" value="${filterState.startDate}">
                <input type="date" id="endDateInput" class="filter-input" value="${filterState.endDate}">

                <select id="filterProject" class="filter-select"><option value="all">All Projects</option></select>
                <select id="filterTask" class="filter-select"><option value="all">All Tasks</option></select>
                <select id="filterEmployee" class="filter-select"><option value="all">All Employees</option></select>
            </div>

            <div class="filter-group">
                <label style="font-size:0.8rem; font-weight:600; color:#64748b;">Group By:</label>
                <select id="filterGroupBy" class="filter-select">
                    <option value="project" selected>Project</option>
                    <option value="task">Task</option>
                    <option value="employee">Employee</option>
                </select>
                <button id="btnApplyFilter" class="btn-action btn-primary">Apply Filters</button>
            </div>
        </div>

        <div class="summary-cards">
            <div class="stat-card">
                <div class="stat-label">Total Time</div>
                <div class="stat-value" id="statTotalTime">00:00</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Billable Time</div>
                <div class="stat-value" id="statBillableTime" style="color: #10b981;">00:00</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Non-Billable Time</div>
                <div class="stat-value" id="statNonBillableTime" style="color: #f59e0b;">00:00</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Entries</div>
                <div class="stat-value" id="statTotalEntries">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Employees</div>
                <div class="stat-value" id="statTotalEmployees">0</div>
            </div>
        </div>

        <div class="report-section">
            <div class="chart-container">
                <canvas id="summaryChart"></canvas>
            </div>
        </div>

        <div class="report-section" style="padding:0; overflow:hidden;">
            <div id="tableContainer">
                <div class="loading-overlay">Memuatkan data laporan dari Supabase...</div>
            </div>
        </div>
    `;

    bindFilterEvents();
    await loadFilterDropdowns();
    await fetchAndProcessSummaryData();
}

async function loadFilterDropdowns() {
    const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
    const { data: tasks } = await supabase.from('tasks').select('id, task_name').order('task_name');
    const { data: emps } = await supabase.from('employees').select('id, email').order('email');

    const projSelect = document.getElementById('filterProject');
    const taskSelect = document.getElementById('filterTask');
    const empSelect = document.getElementById('filterEmployee');

    if (projs && projSelect) {
        projs.forEach(p => projSelect.innerHTML += `<option value="${p.id}">${p.project_name}</option>`);
    }
    if (tasks && taskSelect) {
        tasks.forEach(t => taskSelect.innerHTML += `<option value="${t.id}">${t.task_name}</option>`);
    }
    if (emps && empSelect) {
        emps.forEach(e => {
            employeeMap[e.id] = e.email;
            empSelect.innerHTML += `<option value="${e.id}">${e.email}</option>`;
        });
    }
}

function bindFilterEvents() {
    const presetSelect = document.getElementById('filterPreset');
    const startInput = document.getElementById('startDateInput');
    const endInput = document.getElementById('endDateInput');

    if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                const dates = calculatePresetDates(e.target.value);
                filterState.startDate = dates.startDate;
                filterState.endDate = dates.endDate;
                startInput.value = dates.startDate;
                endInput.value = dates.endDate;
            }
        });
    }

    const applyBtn = document.getElementById('btnApplyFilter');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            filterState.datePreset = presetSelect.value;
            filterState.startDate = startInput.value;
            filterState.endDate = endInput.value;
            filterState.projectId = document.getElementById('filterProject').value;
            filterState.taskId = document.getElementById('filterTask').value;
            filterState.employeeId = document.getElementById('filterEmployee').value;
            filterState.groupBy = document.getElementById('filterGroupBy').value;

            fetchAndProcessSummaryData();
        });
    }
}

async function fetchAndProcessSummaryData() {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) return;
    tableContainer.innerHTML = '<div class="loading-overlay">Memuatkan data laporan dari Supabase...</div>';

    const startFull = `${filterState.startDate}T00:00:00`;
    const endFull = `${filterState.endDate}T23:59:59`;

    let query = supabase
        .from('time_entries')
        .select(`
            id,
            duration_seconds,
            employee_id,
            project_id,
            task_id,
            project:projects!fk_time_entries_project(project_name),
            task:tasks!fk_time_entries_task(task_name)
        `)
        .eq('status', 'STOPPED')
        .gte('start_time', startFull)
        .lte('start_time', endFull);

    if (filterState.projectId !== 'all') query = query.eq('project_id', filterState.projectId);
    if (filterState.taskId !== 'all') query = query.eq('task_id', filterState.taskId);
    if (filterState.employeeId !== 'all') query = query.eq('employee_id', filterState.employeeId);

    const { data, error } = await query;

    if (error) {
        console.error('Supabase Report Query Error:', error);
        tableContainer.innerHTML = `<div class="empty-state" style="color:#ef4444;">Ralat memuatkan data: ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        tableContainer.innerHTML = `<div class="empty-state">Tiada rekod masa dijumpai untuk julat tarikh dan tapisan yang dipilih.</div>`;
        updateHeaderStats(0, 0, 0, 0, 0);
        renderChart([], []);
        return;
    }

    let totalSec = 0;
    let billableSec = 0;
    let nonBillableSec = 0;
    const uniqueEmployees = new Set();

    data.forEach(entry => {
        const sec = entry.duration_seconds || 0;
        totalSec += sec;
        nonBillableSec += sec;
        if (entry.employee_id) uniqueEmployees.add(entry.employee_id);
    });

    updateHeaderStats(totalSec, billableSec, nonBillableSec, data.length, uniqueEmployees.size);

    const groupedMap = {};

    data.forEach(entry => {
        let groupKey = 'Unassigned';
        if (filterState.groupBy === 'project') {
            groupKey = entry.project ? entry.project.project_name : 'No Project';
        } else if (filterState.groupBy === 'task') {
            groupKey = entry.task ? entry.task.task_name : 'No Task';
        } else if (filterState.groupBy === 'employee') {
            groupKey = employeeMap[entry.employee_id] || 'No Employee';
        }

        if (!groupedMap[groupKey]) {
            groupedMap[groupKey] = { totalSec: 0, billableSec: 0, nonBillableSec: 0, count: 0 };
        }

        const sec = entry.duration_seconds || 0;
        groupedMap[groupKey].totalSec += sec;
        groupedMap[groupKey].nonBillableSec += sec;
        groupedMap[groupKey].count += 1;
    });

    const labels = Object.keys(groupedMap);
    const chartValues = labels.map(k => (groupedMap[k].totalSec / 3600).toFixed(2));

    renderChart(labels, chartValues);
    renderSummaryTable(groupedMap);
}

function updateHeaderStats(totalSec, billableSec, nonBillableSec, entriesCount, empCount) {
    const tEl = document.getElementById('statTotalTime');
    const bEl = document.getElementById('statBillableTime');
    const nbEl = document.getElementById('statNonBillableTime');
    const eEl = document.getElementById('statTotalEntries');
    const empEl = document.getElementById('statTotalEmployees');

    if (tEl) tEl.textContent = formatHMS(totalSec);
    if (bEl) bEl.textContent = formatHMS(billableSec);
    if (nbEl) nbEl.textContent = formatHMS(nonBillableSec);
    if (eEl) eEl.textContent = entriesCount;
    if (empEl) empEl.textContent = empCount;
}

function renderChart(labels, dataValues) {
    const ctx = document.getElementById('summaryChart');
    if (!ctx) return;

    if (currentChart) currentChart.destroy();

    // Memastikan setiap bar mendapat warna yang berbeza mengikut turutan
    const bgColors = labels.map((_, index) => colorPalette[index % colorPalette.length]);

    currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Jam (Hours)',
                data: dataValues,
                backgroundColor: bgColors,
                borderWidth: 0,
                borderRadius: 4,
                barThickness: 60 // Bagi bar nampak tebal dan kemas
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.raw + ' Hours';
                        }
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true, 
                    title: { display: true, text: 'Hours', color: '#94a3b8' },
                    grid: { color: '#f1f5f9' },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    border: { display: false }
                }
            }
        }
    });
}

function renderSummaryTable(groupedData) {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) return;
    
    let html = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>${filterState.groupBy.toUpperCase()}</th>
                    <th>TOTAL TIME</th>
                    <th>BILLABLE TIME</th>
                    <th>NON-BILLABLE TIME</th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const [key, val] of Object.entries(groupedData)) {
        html += `
            <tr>
                <td style="font-weight:600; color:#0f172a;">${key}</td>
                <td>${formatHMS(val.totalSec)}</td>
                <td style="color:#10b981;">${formatHMS(val.billableSec)}</td>
                <td style="color:#f59e0b;">${formatHMS(val.nonBillableSec)}</td>
            </tr>
        `;
    }

    html += `</tbody></table>`;
    tableContainer.innerHTML = html;
}
