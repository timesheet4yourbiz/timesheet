import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';
document.addEventListener('DOMContentLoaded', async () => {
loadSidebar(); 
    
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    let currentEmpId = null;
    let timerInterval = null;
    let startTime = null;
    let isRunning = false;
    let currentEntryId = null; 

    // Sambungan ke Elemen HTML Baru
    const projectSelect = document.getElementById('projectSelect');
    const taskSelect = document.getElementById('taskSelect');
    const startBtn = document.getElementById('startBtn');
    const timerDisplay = document.getElementById('timerDisplay');
    const recentEntriesList = document.getElementById('recentEntriesList');

    // Execution
    await initEmployee();
    if (currentEmpId) {
        await loadProjects();
        await loadRecentEntries();
    }

    // Event Listeners
    projectSelect.addEventListener('change', async (e) => {
        await loadTasks(e.target.value);
    });
    startBtn.addEventListener('click', toggleTimer);

    // --- Helper Functions ---
    async function initEmployee() {
        const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).single();
        if (data) currentEmpId = data.id;
    }

    async function loadProjects() {
        const { data } = await supabase.from('projects').select('id, project_name').eq('status', 'ACTIVE');
        if (data) {
            projectSelect.innerHTML = '<option value="">Select Project...</option>' + data.map(p => `<option value="${p.id}">${p.project_name}</option>`).join('');
        }
    }

    async function loadTasks(projectId) {
        if (!projectId) {
            taskSelect.innerHTML = '<option value="">Select Task...</option>';
            return;
        }
        const { data } = await supabase.from('tasks').select('id, task_name').eq('project_id', projectId);
        if (data) {
            taskSelect.innerHTML = '<option value="">Select Task...</option>' + data.map(t => `<option value="${t.id}">${t.task_name}</option>`).join('');
        }
    }

    async function loadRecentEntries() {
        const { data, error } = await supabase.from('time_entries')
            .select(`id, start_time, end_time, total_minutes, tasks(task_name, projects(project_name))`)
            .eq('employee_id', currentEmpId)
            .order('start_time', { ascending: false })
            .limit(5);

        if (error || !data || data.length === 0) {
            recentEntriesList.innerHTML = '<tr><td colspan="5" style="padding: 1.5rem; text-align: center;">No recent entries.</td></tr>';
            return;
        }

        recentEntriesList.innerHTML = data.map(entry => {
            const pName = entry.tasks?.projects?.project_name || '-';
            const tName = entry.tasks?.task_name || '-';
            
            const st = entry.start_time ? new Date(entry.start_time).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: false}) : '-';
            const et = entry.end_time ? new Date(entry.end_time).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: false}) : '-';
            
            let dur = '-';
            if (entry.total_minutes) {
                const h = Math.floor(entry.total_minutes / 60);
                const m = entry.total_minutes % 60;
                dur = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
            }

            return `
                <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                    <td style="padding: 1rem 1.5rem; color: #334155;"><strong>${pName}</strong></td>
                    <td style="padding: 1rem 1.5rem; color: #64748b;">${tName}</td>
                    <td style="padding: 1rem 1.5rem; color: #64748b;">${st}</td>
                    <td style="padding: 1rem 1.5rem; color: #64748b;">${et}</td>
                    <td style="padding: 1rem 1.5rem; font-weight: 500; color: #334155;">${dur}</td>
                </tr>
            `;
        }).join('');
    }

    async function toggleTimer() {
        if (!isRunning) {
            // START LOGIC
            const taskId = taskSelect.value;
            if (!taskId) return alert('Please select a project and task first.');
            
            isRunning = true;
            startTime = new Date();
            startBtn.textContent = 'STOP';
            startBtn.classList.add('stop-mode');
            
            projectSelect.disabled = true;
            taskSelect.disabled = true;

            timerInterval = setInterval(updateDisplay, 1000);

            // Simpan data asas ke pangkalan data
            const { data } = await supabase.from('time_entries').insert([{
                employee_id: currentEmpId,
                task_id: taskId,
                work_date: startTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }),
                start_time: startTime.toISOString(),
                entry_source: 'TRACKER',
                status: 'RUNNING'
            }]).select().single();
            
            if (data) currentEntryId = data.id;

        } else {
            // STOP LOGIC
            isRunning = false;
            clearInterval(timerInterval);
            const endTime = new Date();
            startBtn.textContent = 'START';
            startBtn.classList.remove('stop-mode');
            
            projectSelect.disabled = false;
            taskSelect.disabled = false;
            timerDisplay.textContent = '00:00:00';

            // Kemas kini masa tamat & tempoh ke pangkalan data
            if (currentEntryId) {
                const diffMs = endTime - startTime;
                const totalMins = Math.floor(diffMs / 60000);
                const totalSecs = Math.floor(diffMs / 1000);
                
                await supabase.from('time_entries').update({
                    end_time: endTime.toISOString(),
                    total_minutes: totalMins,
                    total_seconds: totalSecs,
                    status: 'STOPPED'
                }).eq('id', currentEntryId);
                
                currentEntryId = null;
            }
            
            await loadRecentEntries();
        }
    }

    function updateDisplay() {
        const now = new Date();
        const diff = Math.floor((now - startTime) / 1000);
        
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        
        timerDisplay.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
});
