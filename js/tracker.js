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

    // DOM Elements
    const taskDescInput = document.getElementById('taskDescInput');
    const projectSelect = document.getElementById('projectSelect');
    const taskSelect = document.getElementById('taskSelect');
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBtn = document.getElementById('timerBtn');
    const errorBanner = document.getElementById('errorBanner');
    const entriesList = document.getElementById('entriesList'); // Pastikan table tbody ini wujud di HTML

    let currentEmployeeId = null;
    let activeEntryId = null;
    let timerInterval = null;
    let startTime = null;

    // 1. Dapatkan ID Pekerja berdasarkan emel login
    async function initEmployee() {
        const { data, error } = await supabase
            .from('employees')
            .select('id')
            .eq('email', session.user.email)
            .single();

        if (error || !data) {
            showError("Akaun anda tiada dalam senarai Pekerja. Sila hubungi Admin.");
            return false;
        }
        currentEmployeeId = data.id;
        return true;
    }

    // 2. Load Data & Semak Active Timer
    if (await initEmployee()) {
        await loadProjects();
        await checkActiveTimer();
        await loadRecentEntries();
    }

    // 3. LOGIK DROPDOWN (Project -> Task Filter)
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

    // 4. LOGIK BUTANG TIMER (START / STOP)
    timerBtn.addEventListener('click', async () => {
        timerBtn.disabled = true;
        
        if (activeEntryId) {
            await stopTimer();
        } else {
            await startTimer();
        }
        
        timerBtn.disabled = false;
    });

    // --- HELPER FUNCTIONS ---
    function showError(msg) {
        if(errorBanner) {
            errorBanner.textContent = msg;
            errorBanner.style.display = 'block';
        } else {
            alert(msg);
        }
    }

    function hideError() {
        if(errorBanner) errorBanner.style.display = 'none';
    }

    function validateStartButton() {
        // Peraturan: Task mesti dipilih (yang secara automatik bermaksud Projek telah dipilih)
        if (!activeEntryId) {
            timerBtn.disabled = !taskSelect.value;
        }
    }

    async function loadProjects() {
        const { data } = await supabase.from('projects').select('id, project_name').eq('status', 'Active');
        if (data) {
            projectSelect.innerHTML += data.map(p => `<option value="${p.id}">${p.project_name}</option>`).join('');
        }
    }

    async function loadTasks(projectId) {
        taskSelect.disabled = true;
        taskSelect.innerHTML = '<option value="">Loading tasks...</option>';
        
        const { data } = await supabase.from('tasks').select('id, task_name').eq('project_id', projectId);
        
        taskSelect.innerHTML = '<option value="">[ Select Task ▼ ]</option>';
        if (data && data.length > 0) {
            taskSelect.innerHTML += data.map(t => `<option value="${t.id}">${t.task_name}</option>`).join('');
            taskSelect.disabled = false;
        } else {
            taskSelect.innerHTML = '<option value="">(No tasks available)</option>';
        }
        validateStartButton();
    }

    async function checkActiveTimer() {
        // Periksa jika ada timer yang masih RUNNING di database
        const { data, error } = await supabase
            .from('time_entries')
            .select(`id, start_time, description, task_id, project_id`)
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'RUNNING')
            .single();

        if (data) {
            activeEntryId = data.id;
            startTime = new Date(data.start_time).getTime();
            
            // Kemaskini UI dengan data yang sedang berjalan
            taskDescInput.value = data.description || '';
            taskDescInput.disabled = true;
            
            projectSelect.value = data.project_id;
            await loadTasks(data.project_id);
            taskSelect.value = data.task_id;
            
            projectSelect.disabled = true;
            taskSelect.disabled = true;
            
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
        const description = taskDescInput.value.trim() || 'No description';

        if (!projectId || !taskId) {
            showError("Sila pilih Project dan Task.");
            return;
        }

        const workDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
        const nowIso = new Date().toISOString();

        const entryData = {
            employee_id: currentEmployeeId,
            project_id: projectId,
            task_id: taskId,
            description: description,
            work_date: workDate,
            start_time: nowIso,
            status: 'RUNNING',
            entry_type: 'Timer'
        };

        const { data, error } = await supabase.from('time_entries').insert([entryData]).select().single();

        if (error) {
            showError("Gagal memulakan timer: " + error.message);
            return;
        }

        activeEntryId = data.id;
        startTime = new Date(data.start_time).getTime();
        
        // Kunci input semasa timer berjalan
        taskDescInput.disabled = true;
        projectSelect.disabled = true;
        taskSelect.disabled = true;
        
        setButtonState('STOP');
        startClock();
    }

    async function stopTimer() {
        const nowIso = new Date().toISOString();
        const endTime = new Date(nowIso).getTime();
        
        // Kira durasi sebenar
        const totalSeconds = Math.floor((endTime - startTime) / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);

        const { error } = await supabase
            .from('time_entries')
            .update({
                end_time: nowIso,
                total_minutes: totalMinutes,
                duration_seconds: totalSeconds,
                status: 'STOPPED'
            })
            .eq('id', activeEntryId);

        if (error) {
            showError("Gagal menghentikan timer: " + error.message);
            return;
        }

        // Reset UI ke keadaan asal
        stopClock();
        activeEntryId = null;
        startTime = null;
        timerDisplay.textContent = '00:00:00';
        
        taskDescInput.disabled = false;
        taskDescInput.value = '';
        
        projectSelect.disabled = false;
        projectSelect.value = '';
        
        taskSelect.innerHTML = '<option value="">[ Select Task ▼ ]</option>';
        taskSelect.disabled = true;
        
        setButtonState('START');
        await loadRecentEntries();
    }

    function setButtonState(state) {
        if (state === 'START') {
            timerBtn.textContent = '▶ START TIMER';
            timerBtn.style.backgroundColor = '#d946ef'; // Warna Neon Pink (Start)
            validateStartButton();
        } else {
            timerBtn.textContent = '■ STOP';
            timerBtn.style.backgroundColor = '#ef4444'; // Warna Merah (Stop)
            timerBtn.disabled = false;
        }
    }

    function startClock() {
        timerInterval = setInterval(updateDisplay, 1000);
        updateDisplay();
    }

    function stopClock() {
        clearInterval(timerInterval);
    }

    function updateDisplay() {
        const now = Date.now();
        const diffInSeconds = Math.floor((now - startTime) / 1000);
        
        const h = String(Math.floor(diffInSeconds / 3600)).padStart(2, '0');
        const m = String(Math.floor((diffInSeconds % 3600) / 60)).padStart(2, '0');
        const s = String(diffInSeconds % 60).padStart(2, '0');
        
        timerDisplay.textContent = `${h}:${m}:${s}`;
    }

    async function loadRecentEntries() {
        if(!entriesList) return;

        const { data, error } = await supabase
            .from('time_entries')
            .select(`
                id, start_time, end_time, duration_seconds, description,
                projects(project_name), tasks(task_name)
            `)
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'STOPPED')
            .order('start_time', { ascending: false })
            .limit(5);

        if (data && data.length > 0) {
            entriesList.innerHTML = data.map(entry => {
                const sTime = new Date(entry.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const eTime = entry.end_time ? new Date(entry.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                
                const h = String(Math.floor(entry.duration_seconds / 3600)).padStart(2, '0');
                const m = String(Math.floor((entry.duration_seconds % 3600) / 60)).padStart(2, '0');
                const s = String(entry.duration_seconds % 60).padStart(2, '0');

                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 10px;">${entry.description || '-'}</td>
                        <td style="padding: 10px; color: var(--text-muted);">
                            <strong>${entry.projects?.project_name || '-'}</strong><br>
                            <span style="font-size: 0.85em;">${entry.tasks?.task_name || '-'}</span>
                        </td>
                        <td style="padding: 10px; text-align: center;">${sTime} - ${eTime}</td>
                        <td style="padding: 10px; font-weight: bold; text-align: right;">${h}:${m}:${s}</td>
                    </tr>
                `;
            }).join('');
        } else {
            entriesList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No recent entries.</td></tr>';
        }
    }
});
