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
        // Ini sahaja fungsi yang dipanggil untuk Carta Baru (Fungsi lama sudah dibuang)
        await loadAdvancedCharts(); 
    }

    // Helper Functions
    async function initEmployee() {
        const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).single();
        if (data) currentEmpId = data.id;
    }

    async function loadMetrics() {
        const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });
        const elEmp = document.getElementById('metricEmployees');
        if (elEmp) elEmp.textContent = empCount || 0;

        const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');
        const elProj = document.getElementById('metricProjects');
        if (elProj) elProj.textContent = projCount || 0;

        const { count: appCount } = await supabase.from('timesheet_approvals').select('*', { count: 'exact', head: true }).eq('status', 'SUBMITTED');
        const elApp = document.getElementById('metricApprovals');
        if (elApp) elApp.textContent = appCount || 0;

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
        const { data: timeData } = await supabase.from('time_entries')
            .select('total_minutes')
            .eq('employee_id', currentEmpId)
            .eq('work_date', today);
        
        let totalMins = 0;
        if (timeData) timeData.forEach(entry => totalMins += entry.total_minutes);
        
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        const elHours = document.getElementById('metricHours');
        if (elHours) elHours.textContent = `${h}h ${m}m`;
    }

    async function loadAdvancedCharts() {
        if (!currentEmpId || typeof Chart === 'undefined') return;

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

        const { data, error } = await supabase.from('time_entries')
            .select(`work_date, total_minutes, task_id, tasks!inner(task_name, projects!inner(project_name))`)
            .eq('employee_id', currentEmpId)
            .gte('work_date', weekDates[0])
            .lte('work_date', weekDates[6]);

        const listContainer = document.getElementById('taskStatsList');
        if (!listContainer) return; 

        if (error || !data || data.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No activity this week.</p>';
            return;
        }

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

            if (!taskData[taskName]) {
                taskData[taskName] = { mins: 0, color: colors[colorIndex % colors.length] };
                colorIndex++;
            }

            taskData[taskName].mins += entry.total_minutes;
            dailyData[dayStr][taskName] = (dailyData[dayStr][taskName] || 0) + (entry.total_minutes / 60);
            totalWeekMins += entry.total_minutes;
        });

        const sortedTasks = Object.keys(taskData).sort((a, b) => taskData[b].mins - taskData[a].mins);

        // Render Bar Chart
        const barCanvas = document.getElementById('weeklyBarChart');
        if (barCanvas) {
            const barDatasets = sortedTasks.map(task => ({
                label: task,
                data: shortDays.map(day => dailyData[day][task] || 0),
                backgroundColor: taskData[task].color,
                borderWidth: 0
            }));

            new Chart(barCanvas, {
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
        }

        // Render Pie Chart
        const pieCanvas = document.getElementById('taskPieChart');
        if (pieCanvas) {
            new Chart(pieCanvas, {
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
        }

        // Render Custom Task List
        listContainer.innerHTML = sortedTasks.map(task => {
            const mins = taskData[task].mins;
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const percent = totalWeekMins > 0 ? ((mins / totalWeekMins) * 100).toFixed(2) : 0;
            const color = taskData[task].color;

            return `
                <div style="display: flex; align-items: center; font-size: 0.85rem; font-family: sans-serif;">
                    <div style="width: 40%; text-align: right; padding-right: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${task}">${task}</div>
                    <div style="width: 15%; text-align: right; padding-right: 1rem; font-weight: bold;">${timeStr}</div>
                    <div style="width: 35%; display: flex; align-items: center; height: 10px; background: #f1f5f9; border-radius: 2px; overflow: hidden;">
                        <div style="width: ${percent}%; height: 100%; background: ${color};"></div>
                    </div>
                    <div style="width: 10%; text-align: right; color: #64748b; font-size: 0.75rem; margin-left: 0.5rem;">${percent}%</div>
                </div>
            `;
        }).join('');
    }
});
