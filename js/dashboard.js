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
    await loadMetrics();
    await loadRecentActivity();
    await loadChart();

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
        if (currentEmpId) {
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
        } else {
            document.getElementById('metricHours').textContent = "0h 0m";
        }
    }

    async function loadRecentActivity() {
        if (!currentEmpId) return;
        
        const { data, error } = await supabase.from('time_entries').select(`
            work_date, total_minutes,
            tasks!inner(task_name, projects!inner(project_name))
        `)
        .eq('employee_id', currentEmpId)
        .order('created_at', { ascending: false })
        .limit(5);

        const list = document.getElementById('recentActivityList');
        
        if (error || !data || data.length === 0) {
            list.innerHTML = '<tr><td colspan="4" style="padding: 1rem; text-align: center;">No recent activity.</td></tr>';
            return;
        }

        list.innerHTML = data.map(row => {
            const h = Math.floor(row.total_minutes / 60);
            const m = row.total_minutes % 60;
            const duration = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            
            return `
                <tr>
                    <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${row.work_date}</td>
                    <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);"><strong>${row.tasks.projects.project_name}</strong></td>
                    <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);">${row.tasks.task_name}</td>
                    <td style="padding: 0.75rem; border-bottom: 1px solid var(--border-color);"><span style="background: #e5e7eb; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: bold; font-size: 0.85rem;">${duration}</span></td>
                </tr>
            `;
        }).join('');
    }


    async function loadChart() {
        if (!currentEmpId) return;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });

        const { data, error } = await supabase.from('time_entries')
            .select(`total_minutes, tasks!inner(projects!inner(project_name))`)
            .eq('employee_id', currentEmpId)
            .gte('work_date', startOfMonth)
            .lte('work_date', endOfMonth);

        const ctx = document.getElementById('projectChart');
        
        if (error || !data || data.length === 0) {
            ctx.parentElement.innerHTML = '<p style="color:var(--text-muted); text-align:center; margin-top:3rem;">No data for this month</p>';
            return;
        }

        // Kumpulkan jumlah minit mengikut nama projek
        const projectTotals = {};
        data.forEach(entry => {
            const projName = entry.tasks.projects.project_name;
            projectTotals[projName] = (projectTotals[projName] || 0) + entry.total_minutes;
        });

        const labels = Object.keys(projectTotals);
        const dataValues = Object.values(projectTotals).map(mins => (mins / 60).toFixed(1)); // Tukar ke Jam

        // Kod Warna Korporat (Blue, Emerald, Amber, Purple, Slate, Cyan)
        const corporateColors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#64748b', '#0ea5e9'];

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
                cutout: '75%', // Ketebalan cincin (75% nampak sangat profesional)
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
