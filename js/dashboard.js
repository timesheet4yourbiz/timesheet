import { initNotificationBell } from './notifications.js';
import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let filterState = {
    startDate: '',
    endDate: '',
    projectId: 'all',
    teamId: 'all'
};

let chartBar = null;
let chartDonut = null;

// ==========================================
// STATE UNTUK PAGINATION & SORTING
// ==========================================
let teamDataList = []; 
let currentPage = 1;
let recordsPerPage = 20; 
let currentSort = { column: 'member', isAsc: true };

// ==========================================
// UTILITI
// ==========================================
const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#84cc16'];
function getProjectColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colorPalette[Math.abs(hash) % colorPalette.length];
}

function getInitials(nameOrEmail) {
    if(!nameOrEmail) return '?';
    const parts = nameOrEmail.split(/[\s.@]+/);
    let init = parts[0].charAt(0).toUpperCase();
    if(parts.length > 1 && parts[1].length > 0) init += parts[1].charAt(0).toUpperCase();
    return init;
}

function formatHMS(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}:${String(mins).padStart(2, '0')}`;
}

// ==========================================
// INIT DASHBOARD
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        let currentDashDate = new Date();

        const getDashWeekRange = (dateObj) => {
            const curr = new Date(dateObj);
            const day = curr.getDay();
            const diff = curr.getDate() - day + (day === 0 ? -6 : 1); 
            const start = new Date(curr.setDate(diff));
            start.setHours(0,0,0,0);
            
            const end = new Date(start);
            end.setDate(start.getDate() + 6); 
            end.setHours(23,59,59,999);
            return { start, end };
        };

        const updateDashDateDisplay = () => {
            const { start, end } = getDashWeekRange(currentDashDate);
            filterState.startDate = start.toLocaleDateString('en-CA');
            filterState.endDate = end.toLocaleDateString('en-CA');

            const dateTextEl = document.getElementById('dashDateRangeText');
            if (dateTextEl) {
                const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                dateTextEl.textContent = `${startStr} - ${endStr}`;
            }
        };

        const prevDashBtn = document.getElementById('prevDashBtn');
        if (prevDashBtn) prevDashBtn.addEventListener('click', async () => {
            currentDashDate.setDate(currentDashDate.getDate() - 7);
            updateDashDateDisplay();
            await refreshDashboardData();
        });

        const nextDashBtn = document.getElementById('nextDashBtn');
        if (nextDashBtn) nextDashBtn.addEventListener('click', async () => {
            currentDashDate.setDate(currentDashDate.getDate() + 7);
            updateDashDateDisplay();
            await refreshDashboardData();
        });

        updateDashDateDisplay();
        bindFilters();
        bindPaginationControls();
        bindSortingControls();
        
        await loadProjectDropdown();
        await refreshDashboardData();

    } catch (error) {
        console.error("Dashboard Init Error:", error);
    }
});

// ==========================================
// FILTERS
// ==========================================
function bindFilters() {
    const filterProject = document.getElementById('filterProject');
    const filterTeam = document.getElementById('filterTeam');

    if (filterProject) filterProject.addEventListener('change', (e) => {
        filterState.projectId = e.target.value; refreshDashboardData();
    });
    if (filterTeam) filterTeam.addEventListener('change', (e) => {
        filterState.teamId = e.target.value; refreshDashboardData();
    });
}

async function loadProjectDropdown() {
    const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
    const select = document.getElementById('filterProject');
    if (projs && select) {
        projs.forEach(p => select.innerHTML += `<option value="${p.id}">${p.project_name}</option>`);
    }
}

function getDatesArray(startStr, endStr) {
    const dates = [];
    let curr = new Date(startStr);
    const end = new Date(endStr);
    while (curr <= end) {
        dates.push(curr.toLocaleDateString('en-CA'));
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

// ==========================================
// REFRESH DATA UTAMA
// ==========================================
async function refreshDashboardData() {
    if (!filterState.startDate || !filterState.endDate) return;

    const startIso = new Date(`${filterState.startDate}T00:00:00`).toISOString();
    const endIso = new Date(`${filterState.endDate}T23:59:59.999`).toISOString();

    let query = supabase.from('time_entries')
        .select(`duration_seconds, start_time, work_date, status, description, employee_id, project_id, project:projects!fk_time_entries_project(project_name)`)
        .gte('start_time', startIso).lte('start_time', endIso)
        .order('start_time', { ascending: false });
        
    if (filterState.projectId !== 'all') query = query.eq('project_id', filterState.projectId);

    const { data: entries, error } = await query;
    if (error) { console.error("Query Error:", error); return; }
    
    const { data: employeesData } = await supabase.from('employees').select('id, email, name');
    const employees = employeesData || [];

    processKPI(entries);
    processBarChart(entries);
    processDonutAndRanking(entries);
    
    teamDataList = processTeamActivitiesData(entries, employees);
    
    currentPage = 1;
    applySortingAndRender();
}

// ==========================================
// RENDER KPI & CHARTS
// ==========================================
function processKPI(entries) {
    let totalSec = 0;
    const projMap = {};
    
    (entries || []).forEach(e => {
        if(e.status !== 'STOPPED') return;
        const sec = e.duration_seconds || 0;
        totalSec += sec;
        const pName = e.project ? e.project.project_name : 'No Project';
        projMap[pName] = (projMap[pName] || 0) + sec;
    });

    let topP = '--', maxP = 0;
    for (const [k, v] of Object.entries(projMap)) { if (v > maxP) { maxP = v; topP = k; } }

    document.getElementById('kpiTotalTime').textContent = formatHMS(totalSec);
    document.getElementById('kpiTopProject').textContent = topP;
    const donutTotal = document.getElementById('donutTotal');
    if (donutTotal) donutTotal.textContent = formatHMS(totalSec);
}

function processBarChart(entries) {
    const dateArr = getDatesArray(filterState.startDate, filterState.endDate);
    const labels = dateArr.map(d => new Date(d).toLocaleDateString('en-US', {month:'short', day:'numeric'}));
    const projDateMap = {};
    
    (entries || []).forEach(e => {
        if(e.status !== 'STOPPED') return;
        const dStr = e.work_date || e.start_time.split('T')[0];
        const pName = e.project ? e.project.project_name : 'No Project';
        
        if (!projDateMap[pName]) {
            projDateMap[pName] = {};
            dateArr.forEach(d => projDateMap[pName][d] = 0);
        }
        if (projDateMap[pName][dStr] !== undefined) {
            projDateMap[pName][dStr] += (e.duration_seconds || 0);
        }
    });

    const datasets = Object.keys(projDateMap).map(pName => {
        const dataArr = dateArr.map(d => (projDateMap[pName][d] / 3600).toFixed(2));
        return { label: pName, data: dataArr, backgroundColor: getProjectColor(pName), borderRadius: 4 };
    });

    const ctx = document.getElementById('stackedBarChart');
    if (!ctx) return;
    if (chartBar) chartBar.destroy();
    
    chartBar = new Chart(ctx, {
        type: 'bar', data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
            scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, border: { display: false } } }
        }
    });
}

function processDonutAndRanking(entries) {
    const projMap = {};
    let grandTotal = 0;
    
    (entries || []).forEach(e => {
        if(e.status !== 'STOPPED') return;
        const sec = e.duration_seconds || 0;
        const pName = e.project ? e.project.project_name : 'No Project';
        projMap[pName] = (projMap[pName] || 0) + sec;
        grandTotal += sec;
    });

    const sortedProjs = Object.entries(projMap).sort((a,b) => b[1] - a[1]);
    const rankCont = document.getElementById('projectRankingList');
    if (rankCont) {
        rankCont.innerHTML = '';
        if (sortedProjs.length === 0) {
            rankCont.innerHTML = '<div style="color:#94a3b8; text-align:center; padding: 20px;">Tiada data</div>';
        } else {
            sortedProjs.forEach(item => {
                const pName = item[0]; const sec = item[1];
                const perc = grandTotal > 0 ? ((sec / grandTotal) * 100).toFixed(1) : 0;
                const clr = getProjectColor(pName);
                
                rankCont.innerHTML += `
                    <div class="ranking-item">
                        <div class="r-name"><span class="color-dot" style="background:${clr};"></span> ${pName}</div>
                        <div class="r-dur">${formatHMS(sec)}</div>
                        <div class="r-perc">${perc}%</div>
                    </div>
                `;
            });
        }
    }

    const ctx = document.getElementById('donutChart');
    if (!ctx) return;
    if (chartDonut) chartDonut.destroy();
    
    chartDonut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedProjs.map(i => i[0]),
            datasets: [{ data: sortedProjs.map(i => (i[1] / 3600).toFixed(2)), backgroundColor: sortedProjs.map(i => getProjectColor(i[0])), borderWidth: 0, hoverOffset: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
    });
}

// ==========================================
// ENGINE: SUSUN DATA TEAM (8 LAJUR)
// ==========================================
function processTeamActivitiesData(entries, employees) {
    const teamMap = {};
    const todayStr = new Date().toLocaleDateString('en-CA');

    employees.forEach(emp => {
        teamMap[emp.id] = { 
            id: emp.id,
            name: emp.name || emp.email.split('@')[0], 
            email: emp.email, 
            totalSec: 0, 
            todaySec: 0, 
            latest: null,
            isTracking: false,
            projects: {} 
        };
    });

    (entries || []).forEach(e => {
        if (!e.employee_id) return;
        if (!teamMap[e.employee_id]) {
            teamMap[e.employee_id] = { id: e.employee_id, name: 'ID: ' + String(e.employee_id).substring(0,6), email: '', totalSec: 0, todaySec: 0, latest: null, isTracking: false, projects: {} };
        }
        
        const dStr = e.work_date || e.start_time.split('T')[0];
        const sec = e.duration_seconds || 0;

        if (e.status === 'IN_PROGRESS' || e.status === 'RUNNING') {
            teamMap[e.employee_id].isTracking = true;
            if (!teamMap[e.employee_id].latest) teamMap[e.employee_id].latest = e;
        } else {
            const pName = e.project ? e.project.project_name : 'No Project';
            teamMap[e.employee_id].totalSec += sec;
            if (dStr === todayStr) teamMap[e.employee_id].todaySec += sec;
            
            teamMap[e.employee_id].projects[pName] = (teamMap[e.employee_id].projects[pName] || 0) + sec;
            if (!teamMap[e.employee_id].latest) teamMap[e.employee_id].latest = e;
        }
    });

    return Object.values(teamMap);
}

// ==========================================
// ENGINE: SORTING & PAGINATION
// ==========================================
function bindSortingControls() {
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-sort');
            if (currentSort.column === column) {
                currentSort.isAsc = !currentSort.isAsc;
            } else {
                currentSort.column = column;
                currentSort.isAsc = true;
            }
            document.querySelectorAll('.sortable-header').forEach(h => h.classList.remove('asc', 'desc'));
            header.classList.add(currentSort.isAsc ? 'asc' : 'desc');
            applySortingAndRender();
        });
    });
}

function applySortingAndRender() {
    teamDataList.sort((a, b) => {
        let valA, valB;
        if (currentSort.column === 'member') { valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); } 
        else if (currentSort.column === 'tracked') { valA = a.totalSec; valB = b.totalSec; } 
        else if (currentSort.column === 'activity') {
            valA = a.latest ? new Date(a.latest.start_time).getTime() : 0;
            valB = b.latest ? new Date(b.latest.start_time).getTime() : 0;
        }
        if (valA < valB) return currentSort.isAsc ? -1 : 1;
        if (valA > valB) return currentSort.isAsc ? 1 : -1;
        return 0;
    });
    renderTeamActivities();
}

function bindPaginationControls() {
    const recordSelect = document.getElementById('recordsPerPage');
    if (recordSelect) {
        recordSelect.addEventListener('change', (e) => {
            recordsPerPage = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
            currentPage = 1; renderTeamActivities();
        });
    }

    document.getElementById('btnFirst')?.addEventListener('click', () => { currentPage = 1; renderTeamActivities(); });
    document.getElementById('btnPrev')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTeamActivities(); } });
    document.getElementById('btnNext')?.addEventListener('click', () => { 
        const maxPage = recordsPerPage === 'all' ? 1 : Math.ceil(teamDataList.length / recordsPerPage);
        if (currentPage < maxPage) { currentPage++; renderTeamActivities(); } 
    });
    document.getElementById('btnLast')?.addEventListener('click', () => { 
        if(recordsPerPage !== 'all') { currentPage = Math.ceil(teamDataList.length / recordsPerPage); renderTeamActivities(); }
    });

    const pageInput = document.getElementById('currentPageInput');
    if (pageInput) {
        pageInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            const maxPage = recordsPerPage === 'all' ? 1 : Math.ceil(teamDataList.length / recordsPerPage);
            if (val < 1) val = 1;
            if (val > maxPage) val = maxPage;
            currentPage = val; renderTeamActivities();
        });
    }
}

function getStatusAndBadge(member) {
    if (member.isTracking) return '<span class="badge-status badge-inprogress">In progress</span>';
    if (!member.latest) return '<span class="badge-status badge-noactivity">No activity</span>';

    const now = new Date();
    const past = new Date(member.latest.start_time);
    
    const today = new Date(); today.setHours(0,0,0,0);
    const pastDay = new Date(past); pastDay.setHours(0,0,0,0);
    const diffDays = Math.floor((today - pastDay) / (1000 * 60 * 60 * 24));
    const diffHrs = Math.floor((now - past) / 3600000);

    if (diffDays === 0) return '<span class="badge-status badge-inaday">In a day</span>';
    if (diffDays > 0 && diffDays < 30) {
        let txt = diffHrs < 24 ? `${diffHrs} hours ago` : `${diffDays} days ago`;
        return `<span class="badge-status badge-hoursago">${txt}</span>`;
    }
    return '<span class="badge-status badge-noactivity">No activity</span>';
}

// RENDER JADUAL AKTIVITI PASTI ADA PERINGATAN (CHASE)
function renderTeamActivities() {
    const tbody = document.getElementById('teamActivitiesBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const totalRecs = teamDataList.length;
    if (totalRecs === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding: 20px;">Tiada data.</td></tr>';
        return;
    }

    let pagedData = teamDataList;
    if (recordsPerPage !== 'all') {
        const maxPage = Math.ceil(totalRecs / recordsPerPage);
        if (currentPage > maxPage) currentPage = maxPage;
        const startIndex = (currentPage - 1) * recordsPerPage;
        pagedData = teamDataList.slice(startIndex, startIndex + recordsPerPage);
    }

    pagedData.forEach((member, index) => {
        const init = getInitials(member.name);
        const actualIndex = (recordsPerPage !== 'all' ? (currentPage - 1) * recordsPerPage : 0) + index + 1;
        
        let taskName = 'No recent activity';
        let projName = '-';
        let projColor = 'transparent';
        
        if (member.latest) {
            taskName = member.latest.description || 'Untitled Task';
            projName = member.latest.project ? member.latest.project.project_name : 'No Project';
            projColor = getProjectColor(projName);
        }

        const badgeHtml = getStatusAndBadge(member);

        let currentTimerHtml = '-';
        if (member.isTracking) {
             currentTimerHtml = `${formatHMS(member.todaySec)} <span class="timer-active-dot"></span>`;
        } else if (member.latest && member.todaySec > 0) {
             currentTimerHtml = formatHMS(member.todaySec);
        } else if (member.latest && badgeHtml.includes('hoursago')) {
             currentTimerHtml = formatHMS(member.latest.duration_seconds || 0);
        }

        let barSegments = '';
        for (const [pName, pSec] of Object.entries(member.projects)) {
            if (pSec > 0 && member.totalSec > 0) {
                const perc = (pSec / member.totalSec) * 100;
                barSegments += `<div class="prog-bar-segment" style="width: ${perc}%; background-color: ${getProjectColor(pName)};"></div>`;
            }
        }
        let breakdownHtml = member.totalSec > 0 
            ? `<div class="prog-bar-bg" style="width: 100%; height: 16px; background: #f1f5f9; border-radius: 2px; overflow: hidden; display: flex;">${barSegments}</div>`
            : `<div class="prog-bar-bg" style="width: 100%; height: 16px; background: #f1f5f9; border-radius: 2px;"></div>`;

        // Render Baris (Row) HTML dengan Pop-up Menu Dropdown
        tbody.innerHTML += `
            <tr>
                <td style="text-align: center; color: #0f172a; font-weight: 600;">${actualIndex}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div class="avatar" style="border-radius: 8px; width: 36px; height: 36px; background: ${getProjectColor(member.name)}; color: white; font-weight: 600;">${init}</div>
                        <div>
                            <div style="font-weight: 600; color: #0f172a; font-size: 0.85rem; text-transform: capitalize;">${member.name}</div>
                            <div style="color: #64748b; font-size: 0.75rem;">${member.email || '-'}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-weight: 600; color: #0f172a; font-size: 0.85rem; margin-bottom: 4px;">${taskName}</div>
                    <div style="color: #64748b; font-size: 0.75rem; display: flex; align-items: center;">
                        ${member.latest ? `<span class="proj-dot" style="background: ${projColor};"></span> ${projName}` : '-'}
                    </div>
                </td>
                <td>${badgeHtml}</td>
                <td style="text-align: center; font-weight: 500; color: #0f172a;">${currentTimerHtml}</td>
                <td style="font-weight: 500; color: #0f172a;">${formatHMS(member.totalSec)}</td>
                <td>${breakdownHtml}</td>
                <td style="text-align: center; position: relative;">
                    <!-- DROPDOWN MENU 3 TITIK -->
                    <div class="action-dropdown" style="position: relative; display: inline-block;">
                        <button class="action-dots-btn" style="background: none; border: none; cursor: pointer; color: #64748b; padding: 6px;" title="Tindakan">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                        </button>
                        
                        <div class="action-menu-popup" style="display: none; position: absolute; right: 0; top: 100%; background: white; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); width: 180px; z-index: 99; text-align: left; overflow: hidden;">
                            <div class="action-menu-item chase-btn" data-empid="${member.id}" data-empname="${member.name}" style="padding: 10px 14px; font-size: 0.85rem; color: #1e293b; cursor: pointer; font-weight: 500; transition: background 0.2s;">
                                🔔 Send Reminder
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
}

// ==========================================
// EVENT LISTENER UNTUK DROPDOWN & CHASE BUTTON
// ==========================================
document.addEventListener('click', async (e) => {
    // 1. Kawalan Buka/Tutup Menu 3 Titik
    const dotsBtn = e.target.closest('.action-dots-btn');
    if (dotsBtn) {
        e.stopPropagation();
        const popup = dotsBtn.nextElementSibling;
        
        // Tutup semua menu lain dulu
        document.querySelectorAll('.action-menu-popup').forEach(p => {
            if (p !== popup) p.style.display = 'none';
        });
        
        popup.style.display = popup.style.display === 'block' ? 'none' : 'block';
        return;
    }

    // Tutup popup jika klik di luar
    if (!e.target.closest('.action-dropdown')) {
        document.querySelectorAll('.action-menu-popup').forEach(p => p.style.display = 'none');
    }

    // 2. Kawalan Butang Hantar Peringatan (.chase-btn)
    const chaseBtn = e.target.closest('.chase-btn');
    if (chaseBtn) {
        const empId = chaseBtn.getAttribute('data-empid');
        const empName = chaseBtn.getAttribute('data-empname') || 'staf';
        
        if (chaseBtn.disabled) return;
        chaseBtn.disabled = true;
        const originalText = chaseBtn.innerHTML;
        chaseBtn.innerHTML = '⏳ Sending...';

        try {
            await supabase.from('notifications').insert([{
                employee_id: empId,
                title: 'Timesheet Reminder',
                message: 'Please complete your timesheet record for today.',
                is_read: false
            }]);

            alert(`🔔 Reminder sent successfully to ${empName}!`);

        } catch (err) {
            console.error("Error sending reminder:", err);
            alert(`Reminder flagged for ${empName}.`);
        } finally {
            chaseBtn.disabled = false;
            chaseBtn.innerHTML = originalText;
            
            const popup = chaseBtn.closest('.action-menu-popup');
            if (popup) popup.style.display = 'none';
        }
    }
});
