import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

// Palet warna untuk carta Doughnut
const colorPalette = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#84cc16'];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '../pages/login.html';
            return;
        }

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        await loadDashboardSummary(session.user.email);

    } catch (error) {
        console.error("Ralat memuatkan Dashboard:", error);
    }
});

async function loadDashboardSummary(userEmail) {
    // 1. Dapatkan Profil Pekerja
    const { data: empData } = await supabase.from('employees').select('id').eq('email', userEmail).maybeSingle();
    const empId = empData ? empData.id : null;

    // 2. Load Top Cards
    const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });
    const elEmp = document.getElementById('countEmployees');
    if (elEmp) elEmp.textContent = empCount || 0;

    const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    const elProj = document.getElementById('countProjects');
    if (elProj) elProj.textContent = projCount || 0;

    if (empId) {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

        const { data: timeEntries } = await supabase
            .from('time_entries')
            .select('duration_seconds')
            .eq('employee_id', empId)
            .eq('status', 'STOPPED')
            .gte('start_time', startOfDay)
            .lte('start_time', endOfDay);

        let totalSec = 0;
        if (timeEntries) timeEntries.forEach(t => totalSec += (t.duration_seconds || 0));

        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const elHours = document.getElementById('countMyHours');
        if (elHours) elHours.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        
        // 3. Load Charts
        await loadWeeklyBarChart(empId);
        await loadProjectDoughnutChart(empId);
    }
}

async function loadWeeklyBarChart(empId) {
    const ctx = document.getElementById('weeklyHoursChart');
    if (!ctx) return;

    // Jana senarai 7 hari lepas
    const dates = [];
    const labels = [];
    const dailyMap = {};
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toLocaleDateString('en-CA');
        dates.push(dateStr);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        dailyMap[dateStr] = 0;
    }

    const startIso = new Date(`${dates[0]}T00:00:00`).toISOString();
    const endIso = new Date(`${dates[6]}T23:59:59.999`).toISOString();

    const { data } = await supabase.from('time_entries')
        .select('work_date, start_time, duration_seconds')
        .eq('employee_id', empId)
        .eq('status', 'STOPPED')
        .gte('start_time', startIso)
        .lte('start_time', endIso);

    if (data) {
        data.forEach(entry => {
            const dateKey = entry.work_date || entry.start_time.split('T')[0];
            if (dailyMap[dateKey] !== undefined) {
                dailyMap[dateKey] += (entry.duration_seconds || 0);
            }
        });
    }

    const chartData = dates.map(d => (dailyMap[d] / 3600).toFixed(2));

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Hours',
                data: chartData,
                backgroundColor: '#38bdf8',
                borderRadius: 4,
                barThickness: 25
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, border: { display: false }, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false }, border: { display: false } }
            }
        }
    });
}

async function loadProjectDoughnutChart(empId) {
    const ctx = document.getElementById('projectsDoughnutChart');
    if (!ctx) return;

    const now = new Date();
    const startIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endIso = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const { data } = await supabase.from('time_entries')
        .select('duration_seconds, project_id, project:projects!fk_time_entries_project(project_name)')
        .eq('employee_id', empId)
        .eq('status', 'STOPPED')
        .gte('start_time', startIso)
        .lte('start_time', endIso);

    const projectMap = {};

    if (data && data.length > 0) {
        data.forEach(entry => {
            const pName = entry.project ? entry.project.project_name : 'No Project';
            if (!projectMap[pName]) projectMap[pName] = 0;
            projectMap[pName] += (entry.duration_seconds || 0);
        });
    } else {
        projectMap['No Data'] = 0; // Fallback jika kosong
    }

    const labels = Object.keys(projectMap);
    const chartData = labels.map(k => (projectMap[k] / 3600).toFixed(2));
    const bgColors = labels.map((_, i) => colorPalette[i % colorPalette.length]);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: chartData,
                backgroundColor: bgColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: { callbacks: { label: function(c) { return ' ' + c.raw + ' Hours'; } } }
            }
        }
    });
}
