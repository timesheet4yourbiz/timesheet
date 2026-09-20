import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("1. Enjin Tracker dihidupkan...");
    loadSidebar();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    console.log("2. Mengenal pasti wayar DOM...");
    const taskDescInput = document.getElementById('taskDescInput');
    const projectSelect = document.getElementById('projectSelect'); 
    const taskSelect = document.getElementById('taskSelect'); // Wayar Task baru
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBtn = document.getElementById('timerBtn');
    const entriesContainer = document.getElementById('entriesContainer');

    if (!projectSelect) console.error("Ralat: Dropdown 'projectSelect' tidak wujud dalam HTML.");

    let currentEmployeeId = null;
    let activeEntryId = null;
    let timerInterval = null;
    let startTime = null;

    console.log("3. Menarik data Pekerja & Projek...");
    await initEmployee();
    await loadProjects();
    
    if (currentEmployeeId) {
        await checkActiveTimer();
        await loadRecentEntries();
    } else {
        if(entriesContainer) entriesContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444; font-weight:bold;">Akaun e-mel anda (${session.user.email}) belum didaftarkan di modul Team (Jadual Employees). Sistem tidak dapat merekod masa.</div>`;
    }

    // FUNGSI DINAMIK: Tarik Task bila Project ditukar
    if (projectSelect && taskSelect) {
        projectSelect.addEventListener('change', async (e) => {
            const pid = e.target.value;
            
            // Jika tiada projek dipilih, sembunyikan kotak task
            if (!pid) {
                taskSelect.style.display = 'none';
                taskSelect.innerHTML = '<option value="">Select Task</option>';
                return;
            }
            
            // Munculkan kotak task dan letak status loading
            taskSelect.style.display = 'block';
            taskSelect.innerHTML = '<option value="">Loading tasks...</option>';
            
            const { data, error } = await supabase.from('tasks').select('id, task_name').eq('project_id', pid);
            
            if (error) {
                console.error("Ralat tarik task:", error);
                taskSelect.innerHTML = '<option value="">Error loading</option>';
                return;
            }
            
            if (data && data.length > 0) {
                // Jika ada task, senaraikan
                taskSelect.innerHTML = '<option value="">Select Task</option>' + data.map(t => `<option value="${t.id}">${t.task_name}</option>`).join('');
            } else {
                // Jika projek tak ada task, tunjuk amaran jelas
                taskSelect.innerHTML = '<option value="">No Tasks Found</option>';
            }
        });
    }

    // ==========================================
    // FUNGSI PEMASA (TIMER LOGIC)
    // ==========================================

    if(timerBtn) {
        timerBtn.addEventListener('click', async () => {
            timerBtn.disabled = true;
            if (activeEntryId) {
                await stopTimer();
            } else {
                await startTimer();
            }
            timerBtn.disabled = false;
        });
    }

    async function initEmployee() {
        const { data, error } = await supabase.from('employees').select('id').eq('email', session.user.email).maybeSingle();
        if (error) console.error("Ralat check pekerja:", error);
        if (data) currentEmployeeId = data.id;
    }

    async function loadProjects() {
        const { data, error } = await supabase.from('projects').select('id, project_name').order('project_name', { ascending: true });
        if (error) console.error("Ralat tarik projek:", error);
        if (data && projectSelect) {
            projectSelect.innerHTML = '<option value="">⊕ Select Project</option>' + 
                data.map(p => `<option value="${p.id}">${p.project_name}</option>`).join('');
        }
    }

    async function checkActiveTimer() {
        const { data, error } = await supabase.from('time_entries').select('*').eq('employee_id', currentEmployeeId).eq('status', 'RUNNING').maybeSingle();
        if (data) {
            activeEntryId = data.id;
            startTime = new Date(data.start_time).getTime();
            
            if(taskDescInput) {
                taskDescInput.value = data.description || '';
                taskDescInput.disabled = true;
            }
            if (data.project_id && projectSelect) {
                projectSelect.value = data.project_id;
                projectSelect.disabled = true;
                
                // Tarik task untuk projek yang sedang berjalan
                const tasksReq = await supabase.from('tasks').select('id, task_name').eq('project_id', data.project_id);
                if (tasksReq.data && tasksReq.data.length > 0 && taskSelect) {
                    taskSelect.style.display = 'block';
                    taskSelect.innerHTML = '<option value="">Select Task</option>' + tasksReq.data.map(t => `<option value="${t.id}">${t.task_name}</option>`).join('');
                    if (data.task_id) taskSelect.value = data.task_id;
                }
            }
            if(taskSelect) taskSelect.disabled = true;
            
            setButtonState('STOP');
            startClock();
        }
    }

    async function startTimer() {
        if (!currentEmployeeId) return alert("Ralat: ID Pekerja anda tidak dijumpai dalam pangkalan data.");
        
        const projectId = projectSelect ? projectSelect.value : null;
        const taskId = (taskSelect && taskSelect.style.display !== 'none') ? taskSelect.value : null;
        const description = taskDescInput ? taskDescInput.value.trim() : '';
        
        const payload = {
            employee_id: currentEmployeeId,
            description: description || '(No description)',
            work_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }),
            start_time: new Date().toISOString(),
            status: 'RUNNING',
            entry_type: 'Timer'
        };

        if (projectId) payload.project_id = projectId;
        if (taskId) payload.task_id = taskId;

        const { data, error } = await supabase.from('time_entries').insert([payload]).select().single();

        if (error) {
            console.error("Insert Error:", error);
            return alert("Gagal mulakan timer: " + error.message);
        }

        activeEntryId = data.id;
        startTime = new Date(data.start_time).getTime();
        
        if(taskDescInput) taskDescInput.disabled = true;
        if(projectSelect) projectSelect.disabled = true;
        if(taskSelect) taskSelect.disabled = true;
        
        setButtonState('STOP');
        startClock();
    }

    async function stopTimer() {
        const nowIso = new Date().toISOString();
        const endTime = new Date(nowIso).getTime();
        const totalSeconds = Math.floor((endTime - startTime) / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);

        const { error } = await supabase.from('time_entries').update({
            end_time: nowIso, total_minutes: totalMinutes, duration_seconds: totalSeconds, status: 'STOPPED'
        }).eq('id', activeEntryId);

        if (error) {
            console.error("Update Error:", error);
            return alert("Gagal hentikan timer: " + error.message);
        }

        stopClock();
        activeEntryId = null;
        startTime = null;
        if(timerDisplay) timerDisplay.textContent = '0:00:00';
        
        if(taskDescInput) { taskDescInput.disabled = false; taskDescInput.value = ''; }
        if(projectSelect) { projectSelect.disabled = false; projectSelect.value = ''; }
        if(taskSelect) { taskSelect.disabled = false; taskSelect.value = ''; taskSelect.style.display = 'none'; }
        
        setButtonState('START');
        await loadRecentEntries();
    }

    function setButtonState(state) {
        if(!timerBtn) return;
        if (state === 'START') {
            timerBtn.textContent = 'START';
            timerBtn.style.backgroundColor = '#0ea5e9';
        } else {
            timerBtn.textContent = 'STOP';
            timerBtn.style.backgroundColor = '#ef4444';
        }
    }

    function startClock() { timerInterval = setInterval(updateDisplay, 1000); updateDisplay(); }
    function stopClock() { clearInterval(timerInterval); }
    
    function updateDisplay() {
        if(!timerDisplay) return;
        const diff = Math.floor((Date.now() - startTime) / 1000);
        const h = Math.floor(diff / 3600);
        const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const s = String(diff % 60).padStart(2, '0');
        timerDisplay.textContent = `${h}:${m}:${s}`;
    }

    // ==========================================
    // FUNGSI PAPARAN REKOD (GROUP BY DATE)
    // ==========================================

    async function loadRecentEntries() {
        if (!entriesContainer) return;
        
        entriesContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Loading entries...</div>';

        // Tarik rekod masa bersama data project dan task

        const { data, error } = await supabase
            .from('time_entries')
            .select(`
                *,
                project:projects!fk_time_entries_project(project_name),
                task:tasks!fk_time_entries_task(task_name)
            `)
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'STOPPED')
            .order('start_time', { ascending: false });

        if (error) {
            console.error("Load Entries Error:", error);
            entriesContainer.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Ralat menarik data: ${error.message}</div>`;
            return;
        }

        if (!data || data.length === 0) {
            entriesContainer.innerHTML = '<div style="padding:30px; text-align:center; color:#94a3b8; font-size:0.9rem;">No time entries found. Start the timer above!</div>';
            return;
        }

        const groupedData = data.reduce((acc, entry) => {
            const date = entry.work_date || new Date(entry.start_time).toLocaleDateString('en-CA');
            if (!acc[date]) acc[date] = { entries: [], totalSeconds: 0 };
            acc[date].entries.push(entry);
            acc[date].totalSeconds += (entry.duration_seconds || 0);
            return acc;
        }, {});

        let htmlContent = '';
        let grandTotalSeconds = 0;

        for (const [date, group] of Object.entries(groupedData)) {
            grandTotalSeconds += group.totalSeconds;
            
            const dateObj = new Date(date);
            const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            const dH = Math.floor(group.totalSeconds / 3600);
            const dM = String(Math.floor((group.totalSeconds % 3600) / 60)).padStart(2, '0');

            htmlContent += `
                <div style="background: white; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; margin-bottom: 20px;">
                    <div style="background: #f8fafc; padding: 10px 20px; display: flex; justify-content: space-between; font-size: 0.85rem; color: #94a3b8; border-bottom: 1px solid var(--border-color);">
                        <span>${dateString}</span>
                        <span>Total: <strong style="color: #475569;">${dH}:${dM}</strong></span>
                    </div>
                    <div class="daily-entries-list">
            `;

            group.entries.forEach(entry => {
                const sTime = new Date(entry.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const eTime = entry.end_time ? new Date(entry.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                
                const h = Math.floor((entry.duration_seconds || 0) / 3600);
                const m = String(Math.floor(((entry.duration_seconds || 0) % 3600) / 60)).padStart(2, '0');
                const s = String((entry.duration_seconds || 0) % 60).padStart(2, '0');
                
                const pName = entry.project ? entry.project.project_name : 'No Project';
                const tName = entry.task ? entry.task.task_name : '';
                
                // Format paparan Projek > Task
                const displayProjTask = tName ? `${pName} <span style="color:#94a3b8; font-size:0.8rem; margin-left:5px;">&gt; ${tName}</span>` : pName;

                htmlContent += `
                        <div style="display: flex; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--border-color);">
                            <div style="flex: 1; color: #475569; font-size: 0.9rem;">${entry.description || '(No description)'}</div>
                            
                            <div style="width: 250px; color: #0ea5e9; font-weight: 500; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                                <span style="display:inline-block; min-width:6px; height:6px; background:#10b981; border-radius:50%;"></span>
                                <span>${displayProjTask}</span>
                            </div>
                            
                            <div style="width: 150px; text-align: right; color: #64748b; font-size: 0.85rem;">
                                ${sTime} - ${eTime}
                            </div>
                            
                            <div style="width: 80px; font-weight: 600; color: #334155; text-align: right;">
                                ${h}:${m}:${s}
                            </div>
                            
                            <div style="margin-left: 20px; display: flex; gap: 15px; color: #cbd5e1;">
                                <span class="del-entry-btn" data-id="${entry.id}" style="cursor: pointer; font-size: 1.2rem; color: #ef4444;" title="Delete">✕</span>
                            </div>
                        </div>
                `;
            });

            htmlContent += `</div></div>`;
        }

        const grandH = Math.floor(grandTotalSeconds / 3600);
        const grandM = String(Math.floor((grandTotalSeconds % 3600) / 60)).padStart(2, '0');
        
        entriesContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; color: #94a3b8; font-size: 0.85rem; padding: 10px 0; margin-bottom: 10px;">
                <span>Recent Entries</span>
                <span>Total Tracked: <strong style="color: #475569;">${grandH}:${grandM}</strong></span>
            </div>
            ${htmlContent}
        `;

        document.querySelectorAll('.del-entry-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm('Padam rekod masa ini?')) {
                    await supabase.from('time_entries').delete().eq('id', e.target.getAttribute('data-id'));
                    loadRecentEntries();
                }
            });
        });
    }
});
