import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    const projectSelect = document.getElementById('projectSelect');
    const taskNameInput = document.getElementById('taskNameInput');
    const taskTagInput = document.getElementById('taskTagInput'); // Element Tag Baru
    const addTaskBtn = document.getElementById('addTaskBtn');
    const tasksTableBody = document.getElementById('tasksTableBody');

    await loadProjectsDropdown();
    await loadTasks();

    // Fungsi Tambah Task
    addTaskBtn.addEventListener('click', async () => {
        const projectId = projectSelect.value;
        const taskName = taskNameInput.value.trim();
        const taskTag = taskTagInput ? taskTagInput.value.trim() : '';

        if (!projectId || !taskName) return alert('Sila pilih projek dan masukkan nama tugasan.');

        addTaskBtn.disabled = true;
        addTaskBtn.textContent = 'Saving...';

        // Simpan Task bersama Tag ke Supabase
        await supabase.from('tasks').insert([{ 
            project_id: projectId, 
            task_name: taskName,
            tag: taskTag
        }]);
        
        taskNameInput.value = '';
        if (taskTagInput) taskTagInput.value = '';
        
        addTaskBtn.disabled = false;
        addTaskBtn.textContent = 'Add Task';
        await loadTasks();
    });

    async function loadProjectsDropdown() {
        // Paparkan kod projek jika ada
        const { data } = await supabase.from('projects').select('id, project_name, project_code').order('project_name');
        if (data) {
            projectSelect.innerHTML += data.map(p => 
                `<option value="${p.id}">${p.project_code ? p.project_code + ' - ' : ''}${p.project_name}</option>`
            ).join('');
        }
    }

    async function loadTasks() {
        const { data } = await supabase.from('tasks').select('*, projects(project_name)').order('created_at', { ascending: false });
        
        if (!data || data.length === 0) {
            tasksTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 1.5rem;">No tasks found.</td></tr>';
            return;
        }

        tasksTableBody.innerHTML = data.map(task => {
            const isCompleted = task.status === 'COMPLETED';
            const statusBadge = isCompleted 
                ? '<span style="background:#ecfdf5; color:#10b981; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.8rem; font-weight:600;">COMPLETED</span>'
                : '<span style="background:#fef3c7; color:#d97706; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.8rem; font-weight:600;">PENDING</span>';
            
            // Paparan badge cantik untuk Tag jika wujud
            const tagDisplay = task.tag 
                ? `<span style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${task.tag}</span>` 
                : `<span style="color: var(--text-muted); font-size: 0.85rem;">-</span>`;

            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.8rem; color: var(--text-muted);">${task.projects ? task.projects.project_name : '-'}</td>
                    <td style="padding: 0.8rem; font-weight: 500; ${isCompleted ? 'text-decoration: line-through; color: #9ca3af;' : ''}">${task.task_name}</td>
                    <td style="padding: 0.8rem;">${tagDisplay}</td>
                    <td style="padding: 0.8rem;">${statusBadge}</td>
                    <td style="padding: 0.8rem; text-align: right;">
                        ${!isCompleted ? `<button class="complete-btn" data-id="${task.id}" style="border:none; background:none; color:#3ecf8e; cursor:pointer; margin-right: 1rem; font-weight: 600;">✔ Done</button>` : ''}
                        <button class="delete-btn" data-id="${task.id}" style="border:none; background:none; color:#ef4444; cursor:pointer; font-weight: 600;">✖ Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Action Buttons
        document.querySelectorAll('.complete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await supabase.from('tasks').update({ status: 'COMPLETED' }).eq('id', e.target.dataset.id);
                loadTasks();
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Padam tugasan ini?')) {
                    await supabase.from('tasks').delete().eq('id', e.target.dataset.id);
                    loadTasks();
                }
            });
        });
    }
});
