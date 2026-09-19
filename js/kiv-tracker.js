import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    // 1. Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../pages/login.html';
        });
    }

    // DOM Elements
    const taskDescription = document.getElementById('taskDescription');
    const projectSelect = document.getElementById('projectSelect');
    const timerDisplay = document.getElementById('timerDisplay');
    const startStopBtn = document.getElementById('startStopBtn');
    const trackerEntriesList = document.getElementById('trackerEntriesList');

    // Timer Variables
    let timerInterval = null;
    let startTime = null;
    let elapsedTime = 0;
    let isRunning = false;

    // Load Initial Data
    await loadProjectsDropdown();
    await loadTimeEntries();

    // --- 2. LOGIK TIMER ---
    startStopBtn.addEventListener('click', async () => {
        if (!isRunning) {
            // START TIMER
            isRunning = true;
            startTime = new Date();
            startStopBtn.textContent = 'STOP';
            startStopBtn.classList.add('stop-mode');

            timerInterval = setInterval(() => {
                const now = new Date();
                elapsedTime = Math.floor((now - startTime) / 1000);
                timerDisplay.textContent = formatTime(elapsedTime);
            }, 1000);

        } else {
            // STOP TIMER & SAVE TO SUPABASE
            clearInterval(timerInterval);
            const endTime = new Date();
            const description = taskDescription.value.trim() || 'No description';
            const projectId = projectSelect.value || null;

            startStopBtn.disabled = true;
            startStopBtn.textContent = 'SAVING...';

            const { error } = await supabase.from('time_entries').insert([{
                user_id: session.user.id,
                project_id: projectId,
                description: description,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                duration_seconds: elapsedTime
            }]);

            // Reset UI State
            isRunning = false;
            elapsedTime = 0;
            timerDisplay.textContent = '00:00:00';
            taskDescription.value = '';
            startStopBtn.textContent = 'START';
            startStopBtn.classList.remove('stop-mode');
            startStopBtn.disabled = false;

            if (error) {
                console.error(error);
                alert('Ralat menyimpan rekod masa.');
            } else {
                await loadTimeEntries();
            }
        }
    });

    // Helper: Format Saat ke HH:MM:SS
    function formatTime(totalSeconds) {
        const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const secs = (totalSeconds % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    }

    // --- 3. TARIK PROJEK KE DROPDOWN ---
    async function loadProjectsDropdown() {
        // Tukar 'name' kepada 'project_name'
        const { data } = await supabase.from('projects').select('id, project_name').order('project_name');
        if (data) {
            projectSelect.innerHTML = '<option value="">Select Project</option>' +
                data.map(p => `<option value="${p.id}">${p.project_name}</option>`).join('');
        }
    }

    // --- 4. PAPAR REKOD MASA TERKINI ---
    async function loadTimeEntries() {
        // Tukar 'projects(name)' kepada 'projects(project_name)'
        const { data, error } = await supabase
            .from('time_entries')
            .select('*, projects(project_name)')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error || !data || data.length === 0) {
            trackerEntriesList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No recent entries found.</td></tr>';
            return;
        }

        trackerEntriesList.innerHTML = data.map(entry => `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.8rem; font-weight: 500;">${entry.description}</td>
                <td style="padding: 0.8rem; color: var(--text-muted);">${entry.projects ? entry.projects.project_name : '-'}</td>
                <td style="padding: 0.8rem; font-family: monospace; font-weight: 600;">${formatTime(entry.duration_seconds)}</td>
                <td style="padding: 0.8rem; text-align: right;">
                    <button class="del-entry-btn" data-id="${entry.id}" style="border:none; background:none; color:#ef4444; cursor:pointer;">Delete</button>
                </td>
            </tr>
        `).join('');

        // Function Delete Rekod
        document.querySelectorAll('.del-entry-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Padam rekod masa ini?')) {
                    await supabase.from('time_entries').delete().eq('id', e.target.getAttribute('data-id'));
                    loadTimeEntries();
                }
            });
        });
    }});
