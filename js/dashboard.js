import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let filterState = {
    preset: 'this_week',
    startDate: '',
    endDate: '',
    projectId: 'all',
    teamId: 'all'
};

let chartBar = null;
let chartDonut = null;

// Palet warna. Fungsi akan beri warna yang sama untuk nama projek yang sama.
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

        initDateRange();
        bindFilters();
        
        await loadProjectDropdown();
        await refreshDashboardData();

    } catch (error) {
        console.error("Dashboard Init Error:", error);
    }
});

function initDateRange() { updateDateRange(filterState.preset); }

function updateDateRange(preset) {
    const now = new Date();
    let start = new Date(); let end = new Date();

    if (preset === 'today') {
        start = new Date(); end = new Date();
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
    } else if (preset === 'this_year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
    }

    filterState.startDate = start.toLocaleDateString('en-CA');
    filterState.endDate = end.toLocaleDateString('en-CA');
}

function bindFilters() {
    document.getElementById('filterDateRange').addEventListener('change', (e) => {
        filterState.preset = e.target.value;
        updateDateRange(filterState.preset);
        refreshDashboardData();
    });
    document.getElementById('filterProject').addEventListener('change', (e) => {
        filterState.projectId = e.target.value;
        refreshDashboardData();
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

async function refreshDashboardData() {
    const startIso = new Date(`${filterState.startDate}T00:00:00`).toISOString();
    const endIso = new Date(`${filterState.endDate}T23:59:59.999`).toISOString();

    // 1. Sedut data Time Entries
    let query = supabase.from('time_entries')
        .select(`duration_seconds, start_time, work_date, status, description, employee_id, project_id, project:projects!fk_time_entries_project(project_name), task:tasks!fk_time_entries_task(task_name)`)
        .gte('start_time', startIso).lte('start_time', endIso)
        .order('start_time', { ascending: false });
        
    if (filterState.projectId !== 'all') query = query.eq('project_id', filterState.projectId);

    const { data: entries } = await query;
    
    // 2. Sedut data Semua Pekerja (Untuk Fungsi Kejar)
    const { data: employees } = await supabase.from('employees').select('id, email, name');

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
    document.getElementById('donutTotal').textContent = formatHMS(totalSec);
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
    
    // Render Ranking List
    const rankCont = document.getElementById('projectRankingList');
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

    // Render Donut
    const ctx = document.getElementById('donutChart');
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
    
    // Daftar semua pekerja supaya yang 0 jam tetap keluar
    (employees || []).forEach(emp => {
        teamMap[emp.id] = { 
            name: emp.name || emp.email, 
            email: emp.email, 
            totalSec: 0, 
            latest: null,
            isTracking: false
        };
    });

    (entries || []).forEach(e => {
        if (!teamMap[e.employee_id]) return;
        
        if (e.status === 'IN_PROGRESS') {
            teamMap[e.employee_id].isTracking = true;
            if (!teamMap[e.employee_id].latest) teamMap[e.employee_id].latest = e;
        } else {
            teamMap[e.employee_id].totalSec += (e.duration_seconds || 0);
            if (!teamMap[e.employee_id].latest) teamMap[e.employee_id].latest = e;
        }
    });

    const tbody = document.getElementById('teamActivitiesBody');
    tbody.innerHTML = '';
    
    const sortedTeam = Object.values(teamMap).sort((a,b) => a.totalSec - b.totalSec);

    sortedTeam.forEach(member => {
        const init = getInitials(member.name);
        const formatTime = formatHMS(member.totalSec);
        
        let activityHtml = `<div class="act-proj">(Tiada Rekod)</div>`;
        if (member.isTracking && member.latest) {
            const p = member.latest.project ? member.latest.project.project_name : 'No Project';
            activityHtml = `<div class="act-title" style="color:#10b981;">▶ Sedang Berjalan</div><div class="act-proj">${p}</div>`;
        } else if (member.latest) {
            const p = member.latest.project ? member.latest.project.project_name : 'No Project';
            const desc = member.latest.description || '(Tiada Nota)';
            activityHtml = `<div class="act-title">${desc}</div><div class="act-proj">${p}</div>`;
        }

        // FUNGSI ADMIN CHASE UNTUK 0 JAM
        let trackedHtml = '';
        if (member.totalSec === 0 && !member.isTracking) {
            trackedHtml = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="zero-hours">0:00</span>
                    <button class="btn-chase" onclick="alert('Email amaran dihantar ke ${member.email}!')">Peringatan</button>
                </div>
            `;
        } else {
            trackedHtml = `
                <div style="font-weight:600; color:#334155;">${formatTime}</div>
                <div class="prog-bar-bg"><div class="prog-bar-fill" style="width: 100%;"></div></div>
            `;
        }

        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="member-info">
                        <div class="avatar">${init}</div>
                        <div>
                            <div class="m-name">${member.name}</div>
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
