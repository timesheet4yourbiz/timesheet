import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    // Semakan Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    // Dapatkan ID Projek dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (!projectId) {
        alert("ID Projek tidak dijumpai.");
        window.location.href = 'projects.html';
        return;
    }

    const pdName = document.getElementById('pdName');
    const pdClient = document.getElementById('pdClient');
    const tasksTableBody = document.getElementById('tasksTableBody');
    const newTaskInput = document.getElementById('newTaskInput');
    const addTaskBtn = document.getElementById('addTaskBtn');

    await loadProjectHeader();
    await loadTasks();

    // Fungsi Add Task
    addTaskBtn.addEventListener('click', async () => {
        const tName = newTaskInput.value.trim();
        if (!tName) return alert("Sila masukkan nama task.");

        addTaskBtn.disabled = true;
        addTaskBtn.textContent = '...';

        const { error } = await supabase.from('tasks').insert([{
            project_id: projectId,
            task_name: tName,
            status: 'PENDING'
        }]);

        addTaskBtn.disabled = false;
        addTaskBtn.textContent = 'ADD';

        if (error) {
            console.error(error);
            alert("Ralat menambah task: " + error.message);
        } else {
            newTaskInput.value = '';
            loadTasks();
        }
    });

    async function loadProjectHeader() {
        const { data, error } = await supabase
            .from('projects')
            .select('*, clients(client_name)')
            .eq('id', projectId)
            .single();

        if (error || !data) {
            pdName.textContent = 'Projek Tidak Dijumpai';
            return;
        }

        pdName.textContent = data.project_name || data.project_code;
        pdClient.textContent = data.clients ? data.clients.client_name : 'No Client';
    }

    async function loadTasks() {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            tasksTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #888;">No tasks found for this project.</td></tr>';
            return;
        }

        tasksTableBody.innerHTML = data.map(t => `
            <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                <td style="padding: 15px 20px; color: #334155; font-weight: 500;">
                    ${t.task_name}
                </td>
                <td style="padding: 15px 20px;">
                    <span style="background: #e2e8f0; color: #475569; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Anyone ▼</span>
                </td>
                <td style="padding: 15px 20px; text-align: right;">
                    <button class="del-task-btn" data-id="${t.id}" style="border:none; background:none; color:#ef4444; cursor:pointer; font-weight: 500; font-size: 1rem;" title="Delete">⋮</button>
                </td>
            </tr>
        `).join('');

        // Fungsi Padam Task
        document.querySelectorAll('.del-task-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Padam task ini?')) {
                    await supabase.from('tasks').delete().eq('id', e.target.getAttribute('data-id'));
                    loadTasks();
                }
            });
        });
    }
});
