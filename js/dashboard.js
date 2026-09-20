import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let filterState = {
    preset: 'this_week',
    startDate: '',
    endDate: '',
    projectId: 'all',
    teamId: 'all' // Placeholder
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';

        initDateRange();
        bindFilters();
        
        await loadProjectDropdown();
        await refreshDashboardData();

    } catch (error) {
        console.error("Dashboard Init Error:", error);
    }
});

function initDateRange() {
    updateDateRange(filterState.preset);
}

function updateDateRange(preset) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

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

function formatHMS(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}:${String(mins).padStart(2, '0')}`;
}

async function refreshDashboardData() {
    const startIso = new Date(`${filterState.startDate}T00:00:00`).toISOString();
    const endIso = new Date(`${filterState.endDate}T23:59:59.999`).toISOString();

    // 1. Ambil data time entries berpandukan filter
    let query = supabase.from('time_entries')
        .select(`duration_seconds, project_id, project:projects!fk_time_entries_project(project_name)`)
        .eq('status', 'STOPPED')
        .gte('start_time', startIso)
        .lte('start_time', endIso);
        
    if (filterState.projectId !== 'all') {
        query = query.eq('project_id', filterState.projectId);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Query Ralat:", error);
        return;
    }

    // 2. Kira KPI Utama
    let totalSec = 0;
    const projectDurations = {};

    (data || []).forEach(row => {
        const sec = row.duration_seconds || 0;
        totalSec += sec;
        
        if (row.project_id) {
            const pName = row.project ? row.project.project_name : 'Unknown';
            if (!projectDurations[pName]) projectDurations[pName] = 0;
            projectDurations[pName] += sec;
        }
    });

    // Cari Top Project
    let topProjectName = '--';
    let maxSec = 0;
    for (const [pName, sec] of Object.entries(projectDurations)) {
        if (sec > maxSec) {
            maxSec = sec;
            topProjectName = pName;
        }
    }

    // Paparkan di UI
    document.getElementById('kpiTotalTime').textContent = formatHMS(totalSec);
    document.getElementById('kpiTopProject').textContent = topProjectName;
    // Top Client dibiarkan '--' buat masa ini kerana table Client tiada
}
