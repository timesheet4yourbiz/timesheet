import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();    

    // 1. Semakan Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../pages/login.html';
        });
    }
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;

    // 2. Pembolehubah DOM
    const taskDescInput = document.getElementById('taskDescInput');
    const projectSelect = document.getElementById('projectSelect');
    const taskSelect = document.getElementById('taskSelect');
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBtn = document.getElementById('timerBtn');
    const errorBanner = document.getElementById('errorBanner');
    const entriesList = document.getElementById('entriesList');

    let currentEmployeeId = null;
    let activeEntryId = null;
    let timerInterval = null;
    let startTime = null;

    // ==========================================
    // EXECUTION BERMULA DI SINI
    // ==========================================
    
    // Tarik Projek serta-merta (Tanpa sekatan)
    await loadProjects();
    
    // Semak jika pengguna berdaftar sebagai pekerja
    await initEmployee();
    
    if (currentEmployeeId) {
        await checkActiveTimer();
        await loadRecentEntries();
    } else {
        showError("Akaun e-mel anda tidak didaftarkan dalam senarai Team/Employees. Sila tambah e-mel anda di modul Team untuk mula merekod masa.");
    }

    // ==========================================
    // LOGIK UI & EVENT LISTENER
    // ==========================================

    // Apabila Projek Dipilih -> Tapis Task
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

    // Apabila Task Dipilih -> Sahkan Butang Start
    taskSelect.addEventListener('change', validateStartButton);

    // Butang Start/Stop Ditekan
    timerBtn.addEventListener('click', async () => {
        timerBtn.disabled = true;
        if (activeEntryId) {
            await stopTimer();
        } else {
            await startTimer();
        }
        timerBtn.disabled = false;
    });

    // ==========================================
    // FUNGSI-FUNGSI UTAMA (HELPER FUNCTIONS)
    // ==========================================

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
        if (!activeEntryId) {
            timerBtn.disabled = !taskSelect.value;
        }
    }

    async function initEmployee() {
        const { data, error } = await supabase
            .from('employees')
            .select('id')
            .eq('email', session.user.email)
            .maybeSingle();

        if (data) currentEmployeeId = data.id;
    }

    async function loadProjects() {
        // Guna select('*') seperti fail projects (1).js bos untuk elak ralat nama lajur
        const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        
        if (error) {
            console.error("Ralat memuat turun projek:", error);
            return;
        }

        if (data && data.length > 0) {
            projectSelect.innerHTML = '<option value="">[ Select Project ▼ ]</option>' + 
                data.map(p => {
                    // Paparkan gabungan Code dan Name (contoh: PRJ-001 - Sistem Web)
                    const projTitle = (p.project_code ? p.project_code + ' - ' : '') + (p.project_name || 'Projek');
                    return `<option value="${p.id}">${projTitle}</option>`;
                }).join('');
        } else {
            projectSelect.innerHTML = '<option value="">(Tiada Projek)</option>';
        }
    }

    async function loadTasks(projectId) {
        taskSelect.disabled = true;
        taskSelect.innerHTML = '<option value="">Loading tasks...</option>';
        
        const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId);
        
        if (error) console.error("Ralat memuat turun task:", error);

        taskSelect.innerHTML = '<option value="">[ Select Task ▼ ]</option>';
        if (data && data.length > 0) {
            taskSelect.innerHTML += data.map(t => `<option value="${t.id}">${t.task_name}</option>`).join('');
            taskSelect.disabled = false;
        } else {
            taskSelect.innerHTML = '<option value="">(Tiada Task)</option>';
        }
        validateStartButton();
    }

    async function checkActiveTimer() {
        const { data } = await supabase
            .from('time_entries')
            .select(`id, start_time, description, task_id, project_id`)
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'RUNNING')
            .maybeSingle();

        if (data) {
            activeEntryId = data.id;
            startTime = new Date(data.start_time).getTime();
            
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

        if (!projectId || !taskId) return showError("Sila pilih Project dan Task.");

        const workDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
        const nowIso = new Date().toISOString();

        const payload = {
            employee_id: currentEmployeeId,
            project_id: projectId,
            task_id: taskId,
            description: description,
            work_date: workDate,
            start_time: nowIso,
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
        
        setButtonState('STOP');
        startClock();
    }

    async function stopTimer() {
        const nowIso = new Date().toISOString();
        const endTime = new Date(nowIso).getTime();
        
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

        if (error) return showError("Gagal menghentikan timer: " + error.message);

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
            timerBtn.style.backgroundColor = '#d946ef'; 
            validateStartButton();
        } else {
            timerBtn.textContent = '■ STOP';
            timerBtn.style.backgroundColor = '#ef4444'; 
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

        // Tarik data entri masa
        const { data, error } = await supabase
            .from('time_entries')
            .select(`
                id, start_time, end_time, duration_seconds, description,
                projects(project_name, project_code), tasks(task_name)
            `)
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'STOPPED')
            .order('start_time', { ascending: false })
            .limit(5);

        if (data && data.length > 0) {
            entriesList.innerHTML = data.map(entry => {
                const sTime = new Date(entry.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const eTime = entry.end_time ? new Date(entry.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                
                const h = String(Math.floor((entry.duration_seconds || 0) / 3600)).padStart(2, '0');
                const m = String(Math.floor(((entry.duration_seconds || 0) % 3600) / 60)).padStart(2, '0');
                const s = String((entry.duration_seconds || 0) % 60).padStart(2, '0');

                // Dapatkan nama projek dan nama task secara selamat
                const pName = entry.projects ? (entry.projects.project_code || '') + ' ' + (entry.projects.project_name || '') : 'Tiada Projek';
                const tName = entry.tasks ? entry.tasks.task_name : 'Tiada Task';

                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 10px;">${entry.description || '-'}</td>
                        <td style="padding: 10px; color: var(--text-muted);">
                            <strong>${pName}</strong><br>
                            <span style="font-size: 0.85em;">${tName}</span>
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
