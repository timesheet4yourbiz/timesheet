import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    // 1. Semakan Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    // 2. Kenal pasti Elemen DOM
    const taskDescInput = document.getElementById('taskDescInput');
    const timerDisplay = document.getElementById('timerDisplay');
    const timerBtn = document.getElementById('timerBtn');
    const entriesContainer = document.getElementById('entriesContainer');

    // Magik UI: Tukar teks statik "Project" kepada dropdown yang berfungsi
    const projectDiv = taskDescInput.nextElementSibling;
    projectDiv.innerHTML = `
        <select id="projectSelect" style="border:none; background:transparent; outline:none; color:#0ea5e9; font-weight:500; cursor:pointer; width: 100%; font-size:0.9rem;">
            <option value="">⊕ Select Project</option>
        </select>
    `;
    const projectSelect = document.getElementById('projectSelect');

    let currentEmployeeId = null;
    let activeEntryId = null;
    let timerInterval = null;
    let startTime = null;

    // 3. Permulaan Data
    await initEmployee();
    await loadProjects();
    
    if (currentEmployeeId) {
        await checkActiveTimer();
        await loadRecentEntries();
    } else {
        entriesContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">Sila daftar e-mel anda di bahagian Team terlebih dahulu.</div>`;
    }

    // ==========================================
    // FUNGSI PEMASA (TIMER LOGIC)
    // ==========================================

    timerBtn.addEventListener('click', async () => {
        timerBtn.disabled = true;
        if (activeEntryId) {
            await stopTimer();
        } else {
            await startTimer();
        }
        timerBtn.disabled = false;
    });

    async function initEmployee() {
        const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).maybeSingle();
        if (data) currentEmployeeId = data.id;
    }

    async function loadProjects() {
        const { data } = await supabase.from('projects').select('id, project_name').order('project_name', { ascending: true });
        if (data && projectSelect) {
            projectSelect.innerHTML += data.map(p => `<option value="${p.id}">${p.project_name}</option>`).join('');
        }
    }

    async function checkActiveTimer() {
        const { data } = await supabase
            .from('time_entries')
            .select('*')
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'RUNNING')
            .maybeSingle();

        if (data) {
            activeEntryId = data.id;
            startTime = new Date(data.start_time).getTime();
            taskDescInput.value = data.description || '';
            taskDescInput.disabled = true;
            if (data.project_id) projectSelect.value = data.project_id;
            projectSelect.disabled = true;
            
            setButtonState('STOP');
            startClock();
        }
    }

    async function startTimer() {
        const projectId = projectSelect.value;
        const description = taskDescInput.value.trim() || '(No description)';
        
        // Boleh mulakan timer tanpa projek, tapi lebih baik jika ada
        const payload = {
            employee_id: currentEmployeeId,
            description: description,
            work_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }),
            start_time: new Date().toISOString(),
            status: 'RUNNING',
            entry_type: 'Timer'
        };

        if (projectId) payload.project_id = projectId;

        const { data, error } = await supabase.from('time_entries').insert([payload]).select().single();

        if (error) return alert("Gagal mulakan timer: " + error.message);

        activeEntryId = data.id;
        startTime = new Date(data.start_time).getTime();
        
        taskDescInput.disabled = true;
        projectSelect.disabled = true;
        
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

        if (error) return alert("Gagal hentikan timer: " + error.message);

        stopClock();
        activeEntryId = null;
        startTime = null;
        timerDisplay.textContent = '0:00:00';
        
        taskDescInput.disabled = false;
        taskDescInput.value = '';
        projectSelect.disabled = false;
        projectSelect.value = '';
        
        setButtonState('START');
        await loadRecentEntries();
    }

    function setButtonState(state) {
        if (state === 'START') {
            timerBtn.textContent = 'START';
            timerBtn.style.backgroundColor = '#0ea5e9'; // Biru Clockify
        } else {
            timerBtn.textContent = 'STOP';
            timerBtn.style.backgroundColor = '#ef4444'; // Merah
        }
    }

    function startClock() { timerInterval = setInterval(updateDisplay, 1000); updateDisplay(); }
    function stopClock() { clearInterval(timerInterval); }
    
    function updateDisplay() {
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

        const { data, error } = await supabase
            .from('time_entries')
            .select(`*, projects(project_name)`)
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'STOPPED')
            .order('start_time', { ascending: false });

        if (error || !data || data.length === 0) {
            entriesContainer.innerHTML = '<div style="padding:30px; text-align:center; color:#94a3b8; font-size:0.9rem;">No time entries found. Start the timer above!</div>';
            return;
        }

        // Kumpulkan rekod mengikut Tarikh (work_date)
        const groupedData = data.reduce((acc, entry) => {
            const date = entry.work_date;
            if (!acc[date]) acc[date] = { entries: [], totalSeconds: 0 };
            acc[date].entries.push(entry);
            acc[date].totalSeconds += (entry.duration_seconds || 0);
            return acc;
        }, {});

        let htmlContent = '';
        let grandTotalSeconds = 0;

        // Loop melalui setiap hari
        for (const [date, group] of Object.entries(groupedData)) {
            grandTotalSeconds += group.totalSeconds;
            
            // Format Tarikh Header (Contoh: Fri, Sep 4)
            const dateObj = new Date(date);
            const dateString = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            // Format Total Harian
            const dH = Math.floor(group.totalSeconds / 3600);
            const dM = String(Math.floor((group.totalSeconds % 3600) / 60)).padStart(2, '0');

            htmlContent += `
                <div style="background: white; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    
                    <!-- Header Hari -->
                    <div style="background: #f8fafc; padding: 10px 20px; display: flex; justify-content: space-between; font-size: 0.85rem; color: #94a3b8; border-bottom: 1px solid var(--border-color);">
                        <span>${dateString}</span>
                        <span>Total: <strong style="color: #475569;">${dH}:${dM}</strong></span>
                    </div>
                    
                    <div class="daily-entries-list">
            `;

            // Loop rekod dalam hari tersebut
            group.entries.forEach(entry => {
                const sTime = new Date(entry.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const eTime = entry.end_time ? new Date(entry.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                
                const h = Math.floor((entry.duration_seconds || 0) / 3600);
                const m = String(Math.floor(((entry.duration_seconds || 0) % 3600) / 60)).padStart(2, '0');
                const s = String((entry.duration_seconds || 0) % 60).padStart(2, '0');
                const pName = entry.projects ? entry.projects.project_name : 'No Project';

                htmlContent += `
                        <!-- Baris Rekod -->
                        <div style="display: flex; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--border-color);">
                            <div style="flex: 1; color: #475569; font-size: 0.9rem;">${entry.description || '(No description)'}</div>
                            
                            <div style="width: 250px; color: #0ea5e9; font-weight: 500; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                                <span style="display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%;"></span>
                                ${pName}
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

            htmlContent += `
                    </div>
                </div>
            `;
        }

        // Papar keseluruhan
        const grandH = Math.floor(grandTotalSeconds / 3600);
        const grandM = String(Math.floor((grandTotalSeconds % 3600) / 60)).padStart(2, '0');
        
        entriesContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; color: #94a3b8; font-size: 0.85rem; padding: 10px 0; margin-bottom: 10px;">
                <span>Recent Entries</span>
                <span>Total Tracked: <strong style="color: #475569;">${grandH}:${grandM}</strong></span>
            </div>
            ${htmlContent}
        `;

        // Daftar Event Listener untuk Delete Rekod
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
