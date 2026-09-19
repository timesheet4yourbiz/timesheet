import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();    

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => { await supabase.auth.signOut(); window.location.href = '../pages/login.html'; });
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;

    const taskDescInput = document.getElementById('taskDescInput');
    const projectSelect = document.getElementById('projectSelect');
    const taskSelect = document.getElementById('taskSelect');
    const tagSelect = document.getElementById('tagSelect'); // Element Tag Baru
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBtn = document.getElementById('timerBtn');
    const errorBanner = document.getElementById('errorBanner');
    const entriesList = document.getElementById('entriesList');

    let currentEmployeeId = null;
    let activeEntryId = null;
    let timerInterval = null;
    let startTime = null;

    await loadProjects();
    await initEmployee();
    
    if (currentEmployeeId) {
        await checkActiveTimer();
        await loadRecentEntries();
    } else {
        showError("Akaun e-mel anda tidak didaftarkan dalam senarai Team/Employees.");
    }

    projectSelect.addEventListener('change', async (e) => {
        const projectId = e.target.value;
        if (!projectId) {
            taskSelect.innerHTML = '<option value="">[ Select Task ▼ ]</option>';
            taskSelect.disabled = true;
            validateStartButton();
            return;
        }
        await loadTasks(projectId);
    });

    taskSelect.addEventListener('change', validateStartButton);

    timerBtn.addEventListener('click', async () => {
        timerBtn.disabled = true;
        if (activeEntryId) await stopTimer();
        else await startTimer();
        timerBtn.disabled = false;
    });

    function showError(msg) {
        if(errorBanner) { errorBanner.textContent = msg; errorBanner.style.display = 'block'; } else { alert(msg); }
    }
    function hideError() { if(errorBanner) errorBanner.style.display = 'none'; }

    function validateStartButton() {
        if (!activeEntryId) timerBtn.disabled = !taskSelect.value;
    }

    async function initEmployee() {
        const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).maybeSingle();
        if (data) currentEmployeeId = data.id;
    }

    async function loadProjects() {
        const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        if (data && data.length > 0) {
            projectSelect.innerHTML = '<option value="">[ Select Project ▼ ]</option>' + 
                data.map(p => `<option value="${p.id}">${(p.project_code ? p.project_code + ' - ' : '') + (p.project_name || 'Projek')}</option>`).join('');
        }
    }

    async function loadTasks(projectId) {
        taskSelect.disabled = true;
        taskSelect.innerHTML = '<option value="">Loading...</option>';
        const { data } = await supabase.from('tasks').select('*').eq('project_id', projectId);
        taskSelect.innerHTML = '<option value="">[ Select Task ▼ ]</option>';
        if (data && data.length > 0) {
            taskSelect.innerHTML += data.map(t => `<option value="${t.id}">${t.task_name}</option>`).join('');
            taskSelect.disabled = false;
        }
        validateStartButton();
    }

    async function checkActiveTimer() {
        const { data } = await supabase.from('time_entries').select(`id, start_time, description, task_id, project_id, tag`).eq('employee_id', currentEmployeeId).eq('status', 'RUNNING').maybeSingle();
        if (data) {
            activeEntryId = data.id;
            startTime = new Date(data.start_time).getTime();
            taskDescInput.value = data.description || '';
            taskDescInput.disabled = true;
            
            projectSelect.value = data.project_id;
            await loadTasks(data.project_id);
            taskSelect.value = data.task_id;
            
            if(data.tag) tagSelect.value = data.tag;
            
            projectSelect.disabled = true;
            taskSelect.disabled = true;
            tagSelect.disabled = true; // Kunci Tag semasa jalan
            
            setButtonState('STOP');
            startClock();
        } else {
            validateStartButton();
        }
    }

    async function startTimer() {
        hideError();
        const projectId = projectSelect.value;
        const taskId = taskSelect.value;
        const tagValue = tagSelect.value; // Ambil nilai tag
        const description = taskDescInput.value.trim() || 'No description';

        if (!projectId || !taskId) return showError("Sila pilih Project dan Task.");

        const payload = {
            employee_id: currentEmployeeId,
            project_id: projectId,
            task_id: taskId,
            tag: tagValue, // Simpan tag ke database
            description: description,
            work_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }),
            start_time: new Date().toISOString(),
            status: 'RUNNING',
            entry_type: 'Timer'
        };

        const { data, error } = await supabase.from('time_entries').insert([payload]).select().single();
        if (error) return showError("Gagal memulakan timer: " + error.message);

        activeEntryId = data.id;
        startTime = new Date(data.start_time).getTime();
        
        taskDescInput.disabled = true;
        projectSelect.disabled = true;
        taskSelect.disabled = true;
        tagSelect.disabled = true;
        
        setButtonState('STOP');
        startClock();
    }

    async function stopTimer() {
        const nowIso = new Date().toISOString();
        const endTime = new Date(nowIso).getTime();
        const totalSeconds = Math.floor((endTime - startTime) / 1000);

        const { error } = await supabase.from('time_entries').update({
            end_time: nowIso, total_minutes: Math.floor(totalSeconds / 60), duration_seconds: totalSeconds, status: 'STOPPED'
        }).eq('id', activeEntryId);

        if (error) return showError("Gagal menghentikan timer: " + error.message);

        stopClock();
        activeEntryId = null;
        startTime = null;
        timerDisplay.textContent = '00:00:00';
        
        taskDescInput.disabled = false; taskDescInput.value = '';
        projectSelect.disabled = false; projectSelect.value = '';
        taskSelect.innerHTML = '<option value="">[ Select Task ▼ ]</option>'; taskSelect.disabled = true;
        tagSelect.disabled = false; tagSelect.value = '';
        
        setButtonState('START');
        await loadRecentEntries();
    }

    function setButtonState(state) {
        if (state === 'START') {
            timerBtn.textContent = '▶ START TIMER'; timerBtn.style.backgroundColor = '#d946ef'; validateStartButton();
        } else {
            timerBtn.textContent = '■ STOP'; timerBtn.style.backgroundColor = '#ef4444'; timerBtn.disabled = false;
        }
    }

    function startClock() { timerInterval = setInterval(updateDisplay, 1000); updateDisplay(); }
    function stopClock() { clearInterval(timerInterval); }
    function updateDisplay() {
        const diff = Math.floor((Date.now() - startTime) / 1000);
        timerDisplay.textContent = `${String(Math.floor(diff / 3600)).padStart(2, '0')}:${String(Math.floor((diff % 3600) / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`;
    }

    async function loadRecentEntries() {
        if(!entriesList) return;
        const { data } = await supabase.from('time_entries').select(`
                id, start_time, end_time, duration_seconds, description, tag,
                projects(project_name, project_code), tasks(task_name)
            `).eq('employee_id', currentEmployeeId).eq('status', 'STOPPED').order('start_time', { ascending: false }).limit(5);

        if (data && data.length > 0) {
            entriesList.innerHTML = data.map(entry => {
                const sTime = new Date(entry.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const eTime = entry.end_time ? new Date(entry.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                const h = String(Math.floor((entry.duration_seconds || 0) / 3600)).padStart(2, '0');
                const m = String(Math.floor(((entry.duration_seconds || 0) % 3600) / 60)).padStart(2, '0');
                const s = String((entry.duration_seconds || 0) % 60).padStart(2, '0');
                
                // Paparkan badge Tag jika ada
                const tagBadge = entry.tag ? `<span style="background: rgba(217, 70, 239, 0.2); color: #d946ef; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px;">${entry.tag}</span>` : '';

                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 10px;">${entry.description || '-'} ${tagBadge}</td>
                        <td style="padding: 10px; color: var(--text-muted);">
                            <strong>${entry.projects?.project_code || ''} ${entry.projects?.project_name || ''}</strong><br>
                            <span style="font-size: 0.85em;">${entry.tasks?.task_name || ''}</span>
                        </td>
                        <td style="padding: 10px; text-align: center;">${sTime} - ${eTime}</td>
                        <td style="padding: 10px; font-weight: bold; text-align: right;">${h}:${m}:${s}</td>
                    </tr>
                `;
            }).join('');
        } else {
            entriesList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Tiada rekod terkini.</td></tr>';
        }
    }
});
