import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    let currentEmpId = null;

    // Execution
    await initEmployee();
    if (currentEmpId) {
        await loadMetrics();
        await loadRecentActivity();
        await loadChart(); // <-- Ini yang akan panggil carta
    }

    // Helper Functions
    async function initEmployee() {
        const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).single();
        if (data) currentEmpId = data.id;
    }

    async function loadMetrics() {
        // 1. Total Employees
        const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });
        document.getElementById('metricEmployees').textContent = empCount || 0;

        // 2. Active Projects
        const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');
        document.getElementById('metricProjects').textContent = projCount || 0;

        // 3. Pending Approvals
        const { count: appCount } = await supabase.from('timesheet_approvals').select('*', { count: 'exact', head: true }).eq('status', 'SUBMITTED');
        document.getElementById('metricApprovals').textContent = appCount || 0;

        // 4. My Hours Today
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
        const { data: timeData } = await supabase.from('time_entries')
            .select('total_minutes')
            .eq('employee_id', currentEmpId)
            .eq('work_date', today);
        
        let totalMins = 0;
        if (timeData) timeData.forEach(entry => totalMins += entry.total_minutes);
        
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        document.getElementById('metricHours').textContent = `${h}h ${m}m`;
    }

    // Panggil fungsi ini di bahagian atas (Execution area)
    // await loadAdvancedCharts();

    async function loadAdvancedCharts() {
        if (!currentEmpId || typeof Chart === 'undefined') return;

        // 1. Dapatkan Tarikh Isnin hingga Ahad minggu ini
        const now = new Date();
        let day = now.getDay(), diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const currentMonday = new Date(now.setDate(diff));
        
        const weekDates = [];
        const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        for (let i = 0; i < 7; i++) {
            let d = new Date(currentMonday);
            d.setDate(currentMonday.getDate() + i);
            weekDates.push(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }));
        }

        // 2. Tarik data dari Supabase untuk minggu ini
        const { data, error } = await supabase.from('time_entries')
            .select(`work_date, total_minutes, task_id, tasks!inner(task_name, projects!inner(project_name))`)
            .eq('employee_id', currentEmpId)
            .gte('work_date', weekDates[0])
            .lte('work_date', weekDates[6]);

        if (error || !data || data.length === 0) {
            document.getElementById('taskStatsList').innerHTML = '<p style="text-align: center;">No activity this week.</p>';
            return;
        }

        // 3. Proses Data & Tetapkan Warna Seragam
        const colors = ['#3b82f6', '#8b5cf6', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];
        
        const taskData = {};
        const dailyData = { 'Mon': {}, 'Tue': {}, 'Wed': {}, 'Thu': {}, 'Fri': {}, 'Sat': {}, 'Sun': {} };
        let totalWeekMins = 0;
        let colorIndex = 0;

        data.forEach(entry => {
            const taskName = entry.tasks.task_name;
            const entryDate = new Date(entry.work_date);
            let dayIdx = entryDate.getDay() - 1;
            if (dayIdx === -1) dayIdx = 6;
            const dayStr = shortDays[dayIdx];

            // Assign warna unik untuk setiap task
            if (!taskData[taskName]) {
                taskData[taskName] = { mins: 0, color: colors[colorIndex % colors.length] };
                colorIndex++;
            }

            taskData[taskName].mins += entry.total_minutes;
            dailyData[dayStr][taskName] = (dailyData[dayStr][taskName] || 0) + (entry.total_minutes / 60); // Jam untuk bar chart
            totalWeekMins += entry.total_minutes;
        });

        // Sort Tasks ikut minit tertinggi
        const sortedTasks = Object.keys(taskData).sort((a, b) => taskData[b].mins - taskData[a].mins);

        // 4. Render Carta Bar (Stacked)
        const barDatasets = sortedTasks.map(task => ({
            label: task,
            data: shortDays.map(day => dailyData[day][task] || 0),
            backgroundColor: taskData[task].color,
            borderWidth: 0
        }));

        new Chart(document.getElementById('weeklyBarChart'), {
            type: 'bar',
            data: { labels: shortDays, datasets: barDatasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, beginAtZero: true }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 5. Render Carta Pai (Doughnut)
        new Chart(document.getElementById('taskPieChart'), {
            type: 'doughnut',
            data: {
                labels: sortedTasks,
                datasets: [{
                    data: sortedTasks.map(t => taskData[t].mins),
                    backgroundColor: sortedTasks.map(t => taskData[t].color),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '55%',
                plugins: { legend: { display: false } }
            }
        });

        // 6. Render Senarai Task dengan Progress Bar
        const listContainer = document.getElementById('taskStatsList');
        listContainer.innerHTML = sortedTasks.map(task => {
            const mins = taskData[task].mins;
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const percent = ((mins / totalWeekMins) * 100).toFixed(2);
            const color = taskData[task].color;

            return `
                <div style="display: flex; align-items: center; font-size: 0.85rem; font-family: sans-serif;">
                    <div style="width: 40%; text-align: right; padding-right: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${task}">${task}</div>
                    <div style="width: 15%; text-align: right; padding-right: 1rem; font-weight: bold;">${timeStr}</div>
                    <div style="width: 35%; display: flex; align-items: center; height: 10px; background: #f1f5f9; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${percent}%; height: 100%; background: ${color};"></div>
                    </div>
                    <div style="width: 10%; text-align: right; color: #64748b;">${percent}%</div>
                </div>
            `;
        }).join('');
    }

    async function loadChart() {
        if (typeof Chart === 'undefined') {
            console.error("Chart.js failed to load. Please check your internet connection.");
            return;
        }

        // Ambil data 30 hari ke belakang supaya carta tak nampak kosong
        const now = new Date();
        const past30 = new Date(now);
        past30.setDate(now.getDate() - 30);
        
        const startDate = past30.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
        const endDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });

        const { data, error } = await supabase.from('time_entries')
            .select(`total_minutes, tasks!inner(projects!inner(project_name))`)
            .eq('employee_id', currentEmpId)
            .gte('work_date', startDate)
            .lte('work_date', endDate);

        const ctx = document.getElementById('projectChart');
        if (!ctx) return;
        
        if (error || !data || data.length === 0) {
            ctx.parentElement.innerHTML = '<p style="color:var(--text-muted); text-align:center; margin-top:3rem;">No data for the last 30 days</p>';
            return;
        }

        const projectTotals = {};
        data.forEach(entry => {
            const projName = entry.tasks.projects.project_name;
            projectTotals[projName] = (projectTotals[projName] || 0) + entry.total_minutes;
        });

        const labels = Object.keys(projectTotals);
        const dataValues = Object.values(projectTotals).map(mins => (mins / 60).toFixed(1)); 

        const corporateColors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#64748b', '#0ea5e9'];

        // Hasilkan Carta Pai (Doughnut)
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: corporateColors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', 
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 15, boxWidth: 12, font: { family: "'Segoe UI', sans-serif", size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) { return ` ${context.label}: ${context.raw} hrs`; }
                        }
                    }
                }
            }
        });
    }
});
