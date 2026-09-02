import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';
document.addEventListener('DOMContentLoaded', async () => {
loadSidebar();    

    // Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../pages/login.html';
        });
    }
    
    document.getElementById('userEmail').textContent = session.user.email;    
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const empSelect = document.getElementById('empSelect');
    const projSelect = document.getElementById('projSelect');
    const generateBtn = document.getElementById('generateBtn');
    const exportBtn = document.getElementById('exportBtn');
    const reportList = document.getElementById('reportList');
    const summaryBox = document.getElementById('summaryBox');
    const totalHoursEl = document.getElementById('totalHours');

    let currentReportData = [];

    // Init Defaults & Dropdowns
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    dateFrom.value = firstDay.toLocaleDateString('en-CA');
    dateTo.value = today.toLocaleDateString('en-CA');

    await loadDropdowns();

    generateBtn.addEventListener('click', generateReport);
    exportBtn.addEventListener('click', exportToCSV);

    async function loadDropdowns() {
        const { data: emps } = await supabase.from('employees').select('id, full_name').order('full_name');
        if (emps) {
            empSelect.innerHTML += emps.map(e => `<option value="${e.id}">${e.full_name}</option>`).join('');
        }

        const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
        if (projs) {
            projSelect.innerHTML += projs.map(p => `<option value="${p.id}">${p.project_name}</option>`).join('');
        }
    }

    async function generateReport() {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        reportList.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading data...</td></tr>';
        exportBtn.style.display = 'none';
        summaryBox.style.display = 'none';

        // Build Query
        let query = supabase.from('time_entries').select(`
            work_date, total_minutes, entry_source,
            employees!employee_id!inner(id, full_name),
            tasks!inner(id, task_name, project_id, projects!inner(project_name))
        `).order('work_date', { ascending: false });

        if (dateFrom.value) query = query.gte('work_date', dateFrom.value);
        if (dateTo.value) query = query.lte('work_date', dateTo.value);
        if (empSelect.value) query = query.eq('employee_id', empSelect.value);
        if (projSelect.value) query = query.eq('tasks.project_id', projSelect.value);

        const { data, error } = await query;

        if (error) {
            reportList.innerHTML = `<tr><td colspan="6" style="color:red;">Error: ${error.message}</td></tr>`;
        } else if (!data || data.length === 0) {
            reportList.innerHTML = '<tr><td colspan="6" style="text-align: center;">No records found for selected filters.</td></tr>';
        } else {
            currentReportData = data;
            renderTable(data);
            exportBtn.style.display = 'block';
        }

        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Report';
    }

    function renderTable(data) {
        let totalMins = 0;
        
        reportList.innerHTML = data.map(row => {
            totalMins += row.total_minutes;
            
            const h = Math.floor(row.total_minutes / 60);
            const m = row.total_minutes % 60;
            const duration = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            return `
                <tr>
                    <td>${row.work_date}</td>
                    <td><strong>${row.employees.full_name}</strong></td>
                    <td>${row.tasks.projects.project_name}</td>
                    <td>${row.tasks.task_name}</td>
                    <td>${duration}</td>
                    <td>${row.entry_source}</td>
                </tr>
            `;
        }).join('');

        // Update Summary
        const totalH = Math.floor(totalMins / 60);
        const totalM = totalMins % 60;
        totalHoursEl.textContent = `${totalH} hours ${totalM} minutes`;
        summaryBox.style.display = 'block';
    }

    function exportToCSV() {
        if (currentReportData.length === 0) return;

        let csvContent = "Date,Employee,Project,Task,Duration (Minutes),Source\n";
        
        currentReportData.forEach(row => {
            const date = row.work_date;
            const emp = `"${row.employees.full_name}"`;
            const proj = `"${row.tasks.projects.project_name}"`;
            const task = `"${row.tasks.task_name}"`;
            const mins = row.total_minutes;
            const source = row.entry_source;

            csvContent += `${date},${emp},${proj},${task},${mins},${source}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `WorkTime_Report_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
