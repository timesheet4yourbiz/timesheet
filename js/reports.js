import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let activeTab = 'summary';
let currentChart = null;
let employeeMap = {};

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
    try {
        loadSidebar();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        setupNavigation();
        initDatePresets();
        
        // Load default tab
        await renderCurrentTab();

    } catch (error) {
        console.error("Reports Init Error:", error);
    }
});

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            e.target.classList.add('active');
            activeTab = e.target.getAttribute('data-tab');
            await renderCurrentTab();
        });
    });
}

async function renderCurrentTab() {
    const view = document.getElementById('reportContentView');
    if (!view) return;

    if (activeTab === 'summary') {
        await renderSummaryReport();
    } else if (activeTab === 'detailed') {
        await renderDetailedReport();
    } else {
        view.innerHTML = `
            <div class="report-section empty-state">
                <h3 style="color:#475569;">Modul ${activeTab.toUpperCase()} Akan Datang</h3>
                <p>Bahagian ini dijadualkan untuk fasa pembangunan seterusnya.</p>
            </div>`;
    }
}

function initDatePresets() {
    const dates = calculatePresetDates('this_month');
    filterState.startDate = dates.startDate;
    filterState.endDate = dates.endDate;
}

function calculatePresetDates(preset) {
    const now = new Date();
    let start = new Date(); let end = new Date();

    if (preset === 'today') {
        start = new Date(); end = new Date();
    } else if (preset === 'yesterday') {
        start.setDate(now.getDate() - 1); end.setDate(now.getDate() - 1);
    } else if (preset === 'this_week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        end = new Date(start); end.setDate(start.getDate() + 6);
    } else if (preset === 'last_week') {
        const day = now.getDay();
        const diff = now.getDate() - day - 6 + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        end = new Date(start); end.setDate(start.getDate() + 6);
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
    return { startDate: start.toLocaleDateString('en-CA'), endDate: end.toLocaleDateString('en-CA') };
}

function formatHMS(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}:${String(mins).padStart(2, '0')}`;
}

function formatTimeOnly(dateString) {
    if (!dateString) return '--:--';
    const d = new Date(dateString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// =====================================================================
// FASA 2: SUMMARY REPORT (Sedia Ada)
// =====================================================================
async function renderSummaryReport() {
    const container = document.getElementById('reportContentView');
    container.innerHTML = `
        <div class="filter-panel">
            <div class="filter-group">
                <select id="filterPreset" class="filter-select">
                    <option value="today" ${filterState.datePreset === 'today' ? 'selected' : ''}>Today</option>
                    <option value="this_week" ${filterState.datePreset === 'this_week' ? 'selected' : ''}>This Week</option>
                    <option value="this_month" ${filterState.datePreset === 'this_month' ? 'selected' : ''}>This Month</option>
                    <option value="custom" ${filterState.datePreset === 'custom' ? 'selected' : ''}>Custom Range</option>
                </select>
                <input type="date" id="startDateInput" class="filter-input" value="${filterState.startDate}">
                <input type="date" id="endDateInput" class="filter-input" value="${filterState.endDate}">
                <select id="filterProject" class="filter-select"><option value="all">All Projects</option></select>
                <select id="filterEmployee" class="filter-select"><option value="all">All Employees</option></select>
            </div>
            <div class="filter-group">
                <label style="font-size:0.8rem; font-weight:600; color:#64748b;">Group By:</label>
                <select id="filterGroupBy" class="filter-select">
                    <option value="project" ${filterState.groupBy === 'project' ? 'selected' : ''}>Project</option>
                    <option value="employee" ${filterState.groupBy === 'employee' ? 'selected' : ''}>Employee</option>
                </select>
                <button id="btnApplyFilter" class="btn-action btn-primary">Apply Filters</button>
            </div>
        </div>

        <div class="summary-cards">
            <div class="stat-card"><div class="stat-label">Total Time</div><div class="stat-value" id="statTotalTime">00:00</div></div>
            <div class="stat-card"><div class="stat-label">Total Entries</div><div class="stat-value" id="statTotalEntries">0</div></div>
            <div class="stat-card"><div class="stat-label">Employees</div><div class="stat-value" id="statTotalEmployees">0</div></div>
        </div>

        <div class="report-section">
            <div class="chart-container"><canvas id="summaryChart"></canvas></div>
        </div>

        <div class="report-section" style="padding:0; overflow:hidden;">
            <div id="tableContainer"><div class="loading-overlay">Memuatkan data...</div></div>
        </div>
    `;

    bindFilters(() => fetchAndProcessSummaryData());
    await loadFilterDropdowns();
    await fetchAndProcessSummaryData();
}

async function fetchAndProcessSummaryData() {
    const tableContainer = document.getElementById('tableContainer');
    tableContainer.innerHTML = '<div class="loading-overlay">Memuatkan data laporan...</div>';

    const startFull = `${filterState.startDate}T00:00:00`;
    const endFull = `${filterState.endDate}T23:59:59`;

    let query = supabase.from('time_entries')
        .select(`id, duration_seconds, employee_id, project_id, project:projects!fk_time_entries_project(project_name)`)
        .eq('status', 'STOPPED')
        .gte('start_time', startFull).lte('start_time', endFull);

    if (filterState.projectId !== 'all') query = query.eq('project_id', filterState.projectId);
    if (filterState.employeeId !== 'all') query = query.eq('employee_id', filterState.employeeId);

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
        tableContainer.innerHTML = `<div class="empty-state">Tiada rekod dijumpai.</div>`;
        if (chartBar) chartBar.destroy();
        return;
    }

    let totalSec = 0; const uniqueEmp = new Set(); const groupedMap = {};
    data.forEach(e => {
        const sec = e.duration_seconds || 0;
        totalSec += sec;
        if (e.employee_id) uniqueEmp.add(e.employee_id);

        let key = filterState.groupBy === 'project' ? (e.project ? e.project.project_name : 'No Project') : (employeeMap[e.employee_id] || 'No Employee');
        if (!groupedMap[key]) groupedMap[key] = 0;
        groupedMap[key] += sec;
    });

    document.getElementById('statTotalTime').textContent = formatHMS(totalSec);
    document.getElementById('statTotalEntries').textContent = data.length;
    document.getElementById('statTotalEmployees').textContent = uniqueEmp.size;

    const labels = Object.keys(groupedMap);
    const chartValues = labels.map(k => (groupedMap[k] / 3600).toFixed(2));

    const ctx = document.getElementById('summaryChart');
    if (chartBar) chartBar.destroy();
    chartBar = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Hours', data: chartValues, backgroundColor: '#0ea5e9', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    let html = `<table class="report-table"><thead><tr><th>${filterState.groupBy.toUpperCase()}</th><th>TOTAL TIME</th></tr></thead><tbody>`;
    for (const [k, v] of Object.entries(groupedMap)) {
        html += `<tr><td style="font-weight:600;">${k}</td><td>${formatHMS(v)}</td></tr>`;
    }
    tableContainer.innerHTML = html + `</tbody></table>`;
}

// =====================================================================
// FASA 3: DETAILED REPORT (Modul Baharu)
// =====================================================================
async function renderDetailedReport() {
    const container = document.getElementById('reportContentView');
    container.innerHTML = `
        <div class="filter-panel">
            <div class="filter-group">
                <select id="filterPreset" class="filter-select">
                    <option value="today" ${filterState.datePreset === 'today' ? 'selected' : ''}>Today</option>
                    <option value="this_week" ${filterState.datePreset === 'this_week' ? 'selected' : ''}>This Week</option>
                    <option value="this_month" ${filterState.datePreset === 'this_month' ? 'selected' : ''}>This Month</option>
                    <option value="custom" ${filterState.datePreset === 'custom' ? 'selected' : ''}>Custom Range</option>
                </select>
                <input type="date" id="startDateInput" class="filter-input" value="${filterState.startDate}">
                <input type="date" id="endDateInput" class="filter-input" value="${filterState.endDate}">
                <select id="filterProject" class="filter-select"><option value="all">All Projects</option></select>
                <select id="filterEmployee" class="filter-select"><option value="all">All Employees</option></select>
            </div>
            <div class="filter-group">
                <button id="btnApplyFilter" class="btn-action btn-primary">Apply Filters</button>
            </div>
        </div>

        <div class="report-section" style="padding:0; overflow:hidden;">
            <div style="overflow-x: auto;">
                <table class="report-table" style="min-width: 900px;">
                    <thead>
                        <tr>
                            <th style="width:10%;">Date</th>
                            <th style="width:15%;">Employee</th>
                            <th style="width:15%;">Project</th>
                            <th style="width:15%;">Task</th>
                            <th style="width:20%;">Description</th>
                            <th style="width:10%;">Start - End</th>
                            <th style="width:10%; text-align:right;">Duration</th>
                        </tr>
                    </thead>
                    <tbody id="detailedTableBody">
                        <tr><td colspan="7" class="loading-overlay">Memuatkan data terperinci...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    bindFilters(() => fetchAndProcessDetailedData());
    await loadFilterDropdowns();
    await fetchAndProcessDetailedData();
}

async function fetchAndProcessDetailedData() {
    const tbody = document.getElementById('detailedTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-overlay">Menyusun data dari pangkalan data...</td></tr>';

    const startFull = `${filterState.startDate}T00:00:00`;
    const endFull = `${filterState.endDate}T23:59:59`;

    let query = supabase.from('time_entries')
        .select(`
            id, work_date, start_time, end_time, duration_seconds, description, status,
            employee_id, project_id, task_id,
            project:projects!fk_time_entries_project(project_name),
            task:tasks!fk_time_entries_task(task_name)
        `)
        .gte('start_time', startFull).lte('start_time', endFull)
        .order('start_time', { ascending: false });

    if (filterState.projectId !== 'all') query = query.eq('project_id', filterState.projectId);
    if (filterState.employeeId !== 'all') query = query.eq('employee_id', filterState.employeeId);

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Tiada rekod dijumpai untuk kriteria ini.</td></tr>`;
        return;
    }

    let html = '';
    data.forEach(entry => {
        const dateStr = entry.work_date ? new Date(entry.work_date).toLocaleDateString('en-GB') : new Date(entry.start_time).toLocaleDateString('en-GB');
        const empName = employeeMap[entry.employee_id] || 'Unknown';
        const pName = entry.project ? entry.project.project_name : '<span style="color:#94a3b8;">(No Project)</span>';
        const tName = entry.task ? entry.task.task_name : '<span style="color:#94a3b8;">-</span>';
        const desc = entry.description || '<span style="color:#94a3b8;">-</span>';
        
        let timeRange = `${formatTimeOnly(entry.start_time)} - ${entry.end_time ? formatTimeOnly(entry.end_time) : '?'}`;
        let durStr = formatHMS(entry.duration_seconds);

        if (entry.status === 'IN_PROGRESS') {
            timeRange = `<span style="color:#10b981; font-weight:600;">${formatTimeOnly(entry.start_time)} - Running</span>`;
            durStr = `<span style="color:#10b981;">Tracking...</span>`;
        }

        html += `
            <tr>
                <td style="color:#64748b; font-size:0.8rem;">${dateStr}</td>
                <td style="font-weight:500; color:#334155;">${empName}</td>
                <td>${pName}</td>
                <td>${tName}</td>
                <td style="color:#64748b;">${desc}</td>
                <td style="font-size:0.75rem; color:#64748b;">${timeRange}</td>
                <td style="text-align:right; font-weight:600; color:#0f172a;">${durStr}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// =====================================================================
// UTILITI BERSAMA (Shared Utils)
// =====================================================================
async function loadFilterDropdowns() {
    const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
    const { data: emps } = await supabase.from('employees').select('id, email, name').order('name');

    const projSelect = document.getElementById('filterProject');
    const empSelect = document.getElementById('filterEmployee');

    if (projs && projSelect && projSelect.options.length === 1) {
        projs.forEach(p => projSelect.innerHTML += `<option value="${p.id}">${p.project_name}</option>`);
    }
    if (emps && empSelect && empSelect.options.length === 1) {
        emps.forEach(e => {
            const displayName = e.name || e.email;
            employeeMap[e.id] = displayName;
            empSelect.innerHTML += `<option value="${e.id}">${displayName}</option>`;
        });
    }

    // Set nilai sedia ada jika tab bertukar
    if (projSelect) projSelect.value = filterState.projectId;
    if (empSelect) empSelect.value = filterState.employeeId;
}

function bindFilters(fetchCallback) {
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
            filterState.employeeId = document.getElementById('filterEmployee').value;
            
            const gb = document.getElementById('filterGroupBy');
            if (gb) filterState.groupBy = gb.value;

            fetchCallback();
        });
    }
}
