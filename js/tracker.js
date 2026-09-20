import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    const taskDescInput = document.getElementById('taskDescInput');
    const projectSelect = document.getElementById('projectSelect'); 
    const taskSelect = document.getElementById('taskSelect'); 
    const tagSelect = document.getElementById('tagSelect');
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBtn = document.getElementById('timerBtn');
    const entriesContainer = document.getElementById('entriesContainer');

    let currentEmployeeId = null;
    let activeEntryId = null;
    let timerInterval = null;
    let startTime = null;

    await initEmployee();
    await loadProjects();
    await loadTags();
    
    if (currentEmployeeId) {
        await checkActiveTimer();
        await loadRecentEntries();
    } else {
        if(entriesContainer) entriesContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444; font-weight:bold;">Akaun e-mel anda (${session.user.email}) belum didaftarkan di modul Team. Sistem tidak dapat merekod masa.</div>`;
    }

    if (projectSelect && taskSelect) {
        projectSelect.addEventListener('change', async (e) => {
            const pid = e.target.value;
            if (!pid) {
                taskSelect.style.display = 'none';
                taskSelect.innerHTML = '<option value="">Select Task</option>';
                return;
            }
            
            taskSelect.style.display = 'block';
            taskSelect.innerHTML = '<option value="">Loading tasks...</option>';
            
            const { data, error } = await supabase.from('tasks').select('id, task_name').eq('project_id', pid);
            
            if (error) {
                taskSelect.innerHTML = '<option value="">Error loading</option>';
                return;
            }
            
            if (data && data.length > 0) {
                taskSelect.innerHTML = '<option value="">Select Task</option>' + data.map(t => `<option value="${t.id}">${t.task_name}</option>`).join('');
            } else {
                taskSelect.innerHTML = '<option value="">No Tasks Found</option>';
            }
        });
    }

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
        const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).maybeSingle();
        if (data) currentEmployeeId = data.id;
    }

    async function loadProjects() {
        const { data } = await supabase.from('projects').select('id, project_name').order('project_name', { ascending: true });
        if (data && projectSelect) {
            projectSelect.innerHTML = '<option value="">⊕ Select Project</option>' + data.map(p => `<option value="${p.id}">${p.project_name}</option>`).join('');
        }
    }

    async function loadTags() {
        const { data } = await supabase.from('tags').select('id, tag_name').order('tag_name', { ascending: true });
        if (data && tagSelect) {
            tagSelect.innerHTML = '<option value="">Select Tag</option>' + data.map(t => `<option value="${t.id}">${t.tag_name}</option>`).join('');
        }
    }

    async function checkActiveTimer() {
        const { data } = await supabase.from('time_entries').select('*').eq('employee_id', currentEmployeeId).eq('status', 'RUNNING').maybeSingle();
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
                
                const tasksReq = await supabase.from('tasks').select('id, task_name').eq('project_id', data.project_id);
                if (tasksReq.data && tasksReq.data.length > 0 && taskSelect) {
                    taskSelect.style.display = 'block';
                    taskSelect.innerHTML = '<option value="">Select Task</option>' + tasksReq.data.map(t => `<option value="${t.id}">${t.task_name}</option>`).join('');
                    if (data.task_id) taskSelect.value = data.task_id;
                }
            }
            if (data.tag_id && tagSelect) tagSelect.value = data.tag_id;
            
            if(taskSelect) taskSelect.disabled = true;
            if(tagSelect) tagSelect.disabled = true;
            
            setButtonState('STOP');
            startClock();
        }
    }

    async function startTimer() {
        if (!currentEmployeeId) return alert("Ralat: ID Pekerja anda tidak dijumpai dalam pangkalan data.");
        
        const projectId = projectSelect ? projectSelect.value : null;
        const taskId = (taskSelect && taskSelect.style.display !== 'none') ? taskSelect.value : null;
        const tagId = tagSelect ? tagSelect.value : null;
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
        if (tagId) payload.tag_id = tagId;

        const { data, error } = await supabase.from('time_entries').insert([payload]).select().single();

        if (error) return alert("Gagal mulakan timer: " + error.message);

        activeEntryId = data.id;
        startTime = new Date(data.start_time).getTime();
        
        if(taskDescInput) taskDescInput.disabled = true;
        if(projectSelect) projectSelect.disabled = true;
        if(taskSelect) taskSelect.disabled = true;
        if(tagSelect) tagSelect.disabled = true;
        
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

        if (error) return alert("Gagal hentikan timer: " + error.message);

        stopClock();
        activeEntryId = null;
        startTime = null;
        if(timerDisplay) timerDisplay.textContent = '0:00:00';
        
        if(taskDescInput) { taskDescInput.disabled = false; taskDescInput.value = ''; }
        if(projectSelect) { projectSelect.disabled = false; projectSelect.value = ''; }
        if(taskSelect) { taskSelect.disabled = false; taskSelect.value = ''; taskSelect.style.display = 'none'; }
        if(tagSelect) { tagSelect.disabled = false; tagSelect.value = ''; }
        
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
    // FUNGSI PAPARAN REKOD
    // ==========================================

    async function loadRecentEntries() {
        if (!entriesContainer) return;
        
        entriesContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Loading entries...</div>';

        const { data, error } = await supabase
            .from('time_entries')
            .select(`
                *,
                project:projects!fk_time_entries_project(project_name),
                task:tasks!fk_time_entries_task(task_name),
                tag:tags!fk_time_entries_tag(tag_name)
            `)
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'STOPPED')
            .order('start_time', { ascending: false });

        if (error || !data || data.length === 0) {
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
                <div style="background: white; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    
                    <div style="background: #f8fafc; padding: 10px 20px; display: flex; justify-content: space-between; font-size: 0.85rem; color: #94a3b8; border-bottom: 1px solid var(--border-color);">
                        <span>${dateString}</span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span>Total: <strong style="color: #475569;">${dH}:${dM}</strong></span>
                        </div>
                    </div>
                    
                    <!-- Tajuk Column Dinamik (Ditambah Lajur Nota) -->
                    <div style="display:flex; padding: 6px 20px; background: #f1f5f9; font-size: 0.7rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; border-bottom: 1px solid var(--border-color);">
                        <div style="flex: 1;">Description</div>
                        <div style="width: 250px;">Project & Task</div>
                        <div style="width: 120px;">Tag</div>
                        <div style="width: 40px; text-align: center;">📝</div>
                        <div style="width: 140px; text-align: right;">Time</div>
                        <div style="width: 50px; text-align: right;">Duration</div>
                        <div style="width: 65px;"></div>
                    </div>
                    
                    <div class="daily-entries-list">
            `;

            group.entries.forEach(entry => {
                const sTime = new Date(entry.start_time).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true});
                const eTime = entry.end_time ? new Date(entry.end_time).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true}) : '-';
                
                const h = Math.floor((entry.duration_seconds || 0) / 3600);
                const m = String(Math.floor(((entry.duration_seconds || 0) % 3600) / 60)).padStart(2, '0');
                
                const pName = entry.project ? entry.project.project_name.toUpperCase() : 'NO PROJECT';
                const tName = entry.task ? entry.task.task_name.toUpperCase() : '';
                const tagName = entry.tag ? entry.tag.tag_name : '';
                
                const displayProjTask = tName ? `${pName} / ${tName}` : pName;
                const descValue = entry.description ? entry.description : '';
                
                // Set warna ikon bergantung kepada kewujudan nota
                const noteText = entry.notes || '';
                const noteIconColor = noteText ? '#0ea5e9' : '#cbd5e1';

                htmlContent += `
                        <div style="display: flex; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--border-color);">
                            
                            <input type="text" value="${descValue}" readonly style="flex: 1; border: none; outline: none; color: #475569; font-size: 0.9rem; background: transparent;">
                            
                            <div style="width: 250px; color: #0ea5e9; font-weight: 500; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                                <span style="display:inline-block; min-width:6px; height:6px; background:#0ea5e9; border-radius:50%;"></span>
                                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayProjTask}</span>
                            </div>
                            
                            <div style="width: 120px; color: #64748b; font-size: 0.85rem; display: flex; align-items: center; gap: 5px;">
                                ${tagName ? `🏷️ <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tagName}</span>` : '-'}
                            </div>
                            
                            <!-- Ikon Nota Boleh Klik -->
                            <div style="width: 40px; text-align: center;">
                                <span class="note-entry-btn" data-id="${entry.id}" data-note="${noteText}" style="cursor: pointer; font-size: 1.1rem; color: ${noteIconColor};" title="${noteText ? noteText : 'Add note'}">📝</span>
                            </div>
                            
                            <div style="width: 140px; text-align: right; color: #64748b; font-size: 0.85rem;">
                                ${sTime} - ${eTime}
                            </div>
                            
                            <div style="margin: 0 15px; color: #cbd5e1; cursor: pointer; font-size: 1.1rem;">📅</div>
                            
                            <div style="width: 50px; font-weight: 600; color: #334155; text-align: right; font-size: 0.95rem;">
                                ${h}:${m}
                            </div>
                            
                            <div style="margin-left: 20px; display: flex; gap: 15px; color: #cbd5e1; align-items: center; width: 45px;">
                                <span style="cursor: pointer; font-size: 1.2rem;" title="Continue">▶</span>
                                <span class="del-entry-btn" data-id="${entry.id}" style="cursor: pointer; font-weight: bold; font-size: 1.2rem;" title="Delete">⋮</span>
                            </div>
                        </div>
                `;
            });

            htmlContent += `</div></div>`;
        }

        const grandH = Math.floor(grandTotalSeconds / 3600);
        const grandM = String(Math.floor((grandTotalSeconds % 3600) / 60)).padStart(2, '0');
        
        entriesContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; color: #94a3b8; font-size: 0.85rem; padding: 10px 0; margin-bottom: 5px;">
                <span>This Week</span>
                <span>Week total: <strong style="color: #475569; font-size: 1rem;">${grandH}:${grandM}</strong></span>
            </div>
            ${htmlContent}
        `;

        // Fungsi Padam Rekod
        document.querySelectorAll('.del-entry-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(confirm('Padam rekod masa ini?')) {
                    await supabase.from('time_entries').delete().eq('id', e.target.getAttribute('data-id'));
                    loadRecentEntries();
                }
            });
        });

        // Fungsi Kemas Kini Nota
        document.querySelectorAll('.note-entry-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const entryId = e.currentTarget.getAttribute('data-id');
                const currentNote = e.currentTarget.getAttribute('data-note');
                
                const newNote = prompt("Masukkan/Edit nota untuk rekod masa ini:", currentNote);
                
                // Jika user tekan OK (bukannya butang Cancel)
                if (newNote !== null) {
                    const { error } = await supabase.from('time_entries').update({ notes: newNote.trim() }).eq('id', entryId);
                    if (error) {
                        alert("Gagal simpan nota: " + error.message);
                    } else {
                        loadRecentEntries(); // Refresh jadual supaya ikon bertukar warna
                    }
                }
            });
        });
    }
});
