import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Session & Initialization
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    // DOM Elements
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

    // 2. Dapatkan ID Pekerja berdasarkan emel login
    async function initEmployee() {
        const { data, error } = await supabase
            .from('employees')
            .select('id')
            .eq('email', session.user.email)
            .single();

        if (error || !data) {
            showError("Your email is not registered as an Employee. Please add your email in the Employees module.");
            return false;
        }
        currentEmployeeId = data.id;
        return true;
    }

    // 3. Load Data & Semak Active Timer
    if (await initEmployee()) {
        await loadProjects();
        await checkActiveTimer();
        await loadRecentEntries();
    }

    // 4. Dropdown Logic
    projectSelect.addEventListener('change', async (e) => {
        const projectId = e.target.value;
        if (!projectId) {
            taskSelect.innerHTML = '<option value="">-- Select Task --</option>';
            taskSelect.disabled = true;
            validateStartButton();
            return;
        }
        await loadTasks(projectId);
    });

    taskSelect.addEventListener('change', validateStartButton);

    // 5. Timer Button Logic (START / STOP)
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
        errorBanner.textContent = msg;
        errorBanner.style.display = 'block';
    }

    function hideError() {
        errorBanner.style.display = 'none';
    }

    function validateStartButton() {
        // Hanya benarkan klik START jika belum ada timer aktif dan task dipilih
        if (!activeEntryId) {
            timerBtn.disabled = !taskSelect.value;
        }
    }

    async function loadProjects() {
        const { data } = await supabase.from('projects').select('id, project_name').eq('status', 'ACTIVE');
        if (data) {
            projectSelect.innerHTML += data.map(p => `<option value="${p.id}">${p.project_name}</option>`).join('');
        }
    }

    async function loadTasks(projectId) {
        taskSelect.disabled = true;
        taskSelect.innerHTML = '<option value="">Loading...</option>';
        const { data } = await supabase.from('tasks').select('id, task_name').eq('project_id', projectId);
        
        taskSelect.innerHTML = '<option value="">-- Select Task --</option>';
        if (data) {
            taskSelect.innerHTML += data.map(t => `<option value="${t.id}">${t.task_name}</option>`).join('');
            taskSelect.disabled = false;
        }
    }

    // Semak pangkalan data untuk mengelakkan timer bertindih (Rule 12)
    async function checkActiveTimer() {
        const { data, error } = await supabase
            .from('time_entries')
            .select(`id, start_time, task_id, tasks(project_id)`)
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'RUNNING')
            .single();

        if (data) {
            activeEntryId = data.id;
            startTime = new Date(data.start_time).getTime();
            
            // Kemaskini UI
            projectSelect.value = data.tasks.project_id;
            await loadTasks(data.tasks.project_id);
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
        
        // Final security check sebelum insert
        const { count } = await supabase
            .from('time_entries')
            .select('*', { count: 'exact', head: true })
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'RUNNING');
            
        if (count > 0) {
            showError("You already have an active timer.");
            await checkActiveTimer();
            return;
        }

        // Dapatkan tarikh waktu Malaysia (Asia/Kuala_Lumpur) untuk work_date
        const workDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
        const nowIso = new Date().toISOString();

        const entryData = {
            employee_id: currentEmployeeId,
            task_id: taskSelect.value,
            work_date: workDate,
            start_time: nowIso,
            status: 'RUNNING',
            entry_source: 'TIMER',
            is_manual: false
        };

        const { data, error } = await supabase.from('time_entries').insert([entryData]).select().single();

        if (error) {
            showError("Failed to start timer: " + error.message);
            return;
        }

        activeEntryId = data.id;
        startTime = new Date(data.start_time).getTime();
        
        projectSelect.disabled = true;
        taskSelect.disabled = true;
        
        setButtonState('STOP');
        startClock();
    }

    async function stopTimer() {
        const nowIso = new Date().toISOString();
        const endTime = new Date(nowIso).getTime();
        
        // Kira jumlah masa
        const totalSeconds = Math.floor((endTime - startTime) / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);

        const { error } = await supabase
            .from('time_entries')
            .update({
                end_time: nowIso,
                total_minutes: totalMinutes,
                total_seconds: totalSeconds,
                status: 'STOPPED'
            })
            .eq('id', activeEntryId);

        if (error) {
            showError("Failed to stop timer: " + error.message);
            return;
        }

        // Reset UI
        stopClock();
        activeEntryId = null;
        startTime = null;
        timerDisplay.textContent = '00:00:00';
        
        projectSelect.disabled = false;
        taskSelect.disabled = false;
        projectSelect.value = '';
        taskSelect.innerHTML = '<option value="">-- Select Task --</option>';
        taskSelect.disabled = true;
        
        setButtonState('START');
        await loadRecentEntries();
    }

    function setButtonState(state) {
        if (state === 'START') {
            timerBtn.textContent = 'START';
            timerBtn.className = 'btn-timer btn-start';
            validateStartButton();
        } else {
            timerBtn.textContent = 'STOP';
            timerBtn.className = 'btn-timer btn-stop';
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
        const { data } = await supabase
            .from('time_entries')
            .select(`
                id, start_time, end_time, total_seconds,
                tasks(task_name, projects(project_name))
            `)
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'STOPPED')
            .order('created_at', { ascending: false })
            .limit(5);

        if (data && data.length > 0) {
            entriesList.innerHTML = data.map(entry => {
                const sTime = new Date(entry.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const eTime = entry.end_time ? new Date(entry.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                
                const h = String(Math.floor(entry.total_seconds / 3600)).padStart(2, '0');
                const m = String(Math.floor((entry.total_seconds % 3600) / 60)).padStart(2, '0');
                const s = String(entry.total_seconds % 60).padStart(2, '0');

                return `
                    <tr>
                        <td><strong>${entry.tasks.projects.project_name}</strong></td>
                        <td>${entry.tasks.task_name}</td>
                        <td>${sTime}</td>
                        <td>${eTime}</td>
                        <td>${h}:${m}:${s}</td>
                    </tr>
                `;
            }).join('');
        } else {
            entriesList.innerHTML = '<tr><td colspan="5">No recent entries.</td></tr>';
        }
    }
});
