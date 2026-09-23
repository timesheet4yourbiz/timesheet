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

// Sistem warna konsisten untuk Projek
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

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        // ==========================================
        // ENJIN TARIKH MINGGUAN DASHBOARD
        // ==========================================
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
            
            // Simpan tarikh berformat YYYY-MM-DD ke dalam filterState untuk query Supabase
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
        if (prevDashBtn) {
            prevDashBtn.addEventListener('click', async () => {
                currentDashDate.setDate(currentDashDate.getDate() - 7);
                updateDashDateDisplay();
                await refreshDashboardData();
            });
        }

        const nextDashBtn = document.getElementById('nextDashBtn');
        if (nextDashBtn) {
            nextDashBtn.addEventListener('click', async () => {
                currentDashDate.setDate(currentDashDate.getDate() + 7);
                updateDashDateDisplay();
                await refreshDashboardData();
            });
        }

        // Jalankan pengiraan tarikh awal
        updateDashDateDisplay();
        bindFilters();
        
        await loadProjectDropdown();
        await refreshDashboardData();

    } catch (error) {
        console.error("Dashboard Init Error:", error);
    }
});

function bindFilters() {
    const filterProject = document.getElementById('filterProject');
    const filterTeam = document.getElementById('filterTeam');

    if (filterProject) {
        filterProject.addEventListener('change', (e) => {
            filterState.projectId = e.target.value;
            refreshDashboardData();
        });
    }

    if (filterTeam) {
        filterTeam.addEventListener('change', (e) => {
            filterState.teamId = e.target.value;
            refreshDashboardData();
        });
    }
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

async function refreshDashboardData() {
    if (!filterState.startDate || !filterState.endDate) return;

    const startIso = new Date(`${filterState.startDate}T00:00:00`).toISOString();
    const endIso = new Date(`${filterState.endDate}T23:59:59.999`).toISOString();

    // 1. Sedut data Time Entries
    let query = supabase.from('time_entries')
        .select(`duration_seconds, start_time, work_date, status, description, employee_id, project_id, project:projects!fk_time_entries_project(project_name)`)
        .gte('start_time', startIso).lte('start_time', endIso)
        .order('start_time', { ascending: false });
        
    if (filterState.projectId !== 'all') query = query.eq('project_id', filterState.projectId);

    const { data: entries, error } = await query;
    if (error) {
        console.error("Query Error:", error);
        return;
    }
    
    // 2. Sedut data Pekerja
    const { data: employeesData } = await supabase.from('employees').select('id, email, name');
    const employees = employeesData || [];

    processKPI(entries);
    processBarChart(entries);
    processDonutAndRanking(entries);
    processTeamActivities(entries, employees);
}

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
        return {
            label: pName,
            data: dataArr,
            backgroundColor: getProjectColor(pName),
            borderRadius: 4
        };
    });

    const ctx = document.getElementById('stackedBarChart');
    if (!ctx) return;
    if (chartBar) chartBar.destroy();
    
    chartBar = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, border: { display: false } }
            }
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
            datasets: [{
                data: sortedProjs.map(i => (i[1] / 3600).toFixed(2)),
                backgroundColor: sortedProjs.map(i => getProjectColor(i[0])),
                borderWidth: 0, hoverOffset: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: { legend: { display: false } }
        }
    });
}

function processTeamActivities(entries, employees) {
    const teamMap = {};
    
    employees.forEach(emp => {
        teamMap[emp.id] = { 
            name: emp.name || emp.email.split('@')[0], 
            email: emp.email, 
            totalSec: 0, 
            latest: null,
            isTracking: false,
            projects: {} 
        };
    });

    (entries || []).forEach(e => {
        if (!e.employee_id) return;
        
        if (!teamMap[e.employee_id]) {
            teamMap[e.employee_id] = {
                name: 'ID: ' + String(e.employee_id).substring(0,6),
                email: 'Tiada Emel',
                totalSec: 0, latest: null, isTracking: false, projects: {}
            };
        }
        
        if (e.status === 'IN_PROGRESS' || e.status === 'RUNNING') {
            teamMap[e.employee_id].isTracking = true;
            if (!teamMap[e.employee_id].latest) teamMap[e.employee_id].latest = e;
        } else {
            const sec = e.duration_seconds || 0;
            const pName = e.project ? e.project.project_name : 'No Project';
            
            teamMap[e.employee_id].totalSec += sec;
            teamMap[e.employee_id].projects[pName] = (teamMap[e.employee_id].projects[pName] || 0) + sec;
            
            if (!teamMap[e.employee_id].latest) teamMap[e.employee_id].latest = e;
        }
    });

    const tbody = document.getElementById('teamActivitiesBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const sortedTeam = Object.values(teamMap).sort((a,b) => b.totalSec - a.totalSec);

    if (sortedTeam.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8; padding: 20px;">Tiada pekerja dijumpai dalam pangkalan data.</td></tr>';
        return;
    }

    sortedTeam.forEach(member => {
        const init = getInitials(member.name);
        const formatTime = formatHMS(member.totalSec);
        
        let activityHtml = `<div class="act-proj">(Tiada Rekod)</div>`;
        if (member.isTracking && member.latest) {
            const p = member.latest.project ? member.latest.project.project_name : '(Without Project)';
            activityHtml = `<div class="act-title" style="color:#10b981;">▶ Sedang Berjalan (In Progress)</div><div class="act-proj">${p}</div>`;
        } else if (member.latest) {
            const p = member.latest.project ? member.latest.project.project_name : '(Without Project)';
            const desc = member.latest.description || '(no description)';
            activityHtml = `<div class="act-title">${desc}</div><div class="act-proj">${p}</div>`;
        }

        let trackedHtml = '';
        if (member.totalSec === 0 && !member.isTracking) {
            trackedHtml = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="zero-hours">0:00</span>
                    <button class="btn-chase" onclick="alert('Fungsi amaran emel akan dihantar ke ${member.email} pada fasa integrasi emel.')">Peringatan</button>
                </div>
            `;
        } else {
            let barSegments = '';
            for (const [pName, pSec] of Object.entries(member.projects)) {
                if (pSec > 0) {
                    const perc = (pSec / member.totalSec) * 100;
                    const clr = getProjectColor(pName);
                    barSegments += `<div class="prog-bar-segment" style="width: ${perc}%; background-color: ${clr};" title="${pName}: ${formatHMS(pSec)}"></div>`;
                }
            }

            trackedHtml = `
                <div style="font-weight:600; color:#334155;">${formatTime}</div>
                <div class="prog-bar-bg">${barSegments}</div>
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="member-info">
                        <div class="avatar">${init}</div>
                        <div>
                            <div class="m-name" style="text-transform: capitalize;">${member.name}</div>
                            <div class="m-email">${member.email}</div>
                        </div>
                    </div>
                </td>
                <td>${activityHtml}</td>
                <td>${trackedHtml}</td>
            </tr>
        `;
    });
}
