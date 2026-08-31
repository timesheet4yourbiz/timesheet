import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Semak Session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../pages/login.html';
        return;
    }
    
    document.getElementById('userEmail').textContent = session.user.email;
    
    // Logout Logic
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    // Elements
    const taskList = document.getElementById('taskList');
    const projectSelect = document.getElementById('taskProject');
    const modal = document.getElementById('taskModal');
    const addBtn = document.getElementById('addTaskBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('taskForm');
    const saveBtn = document.getElementById('saveBtn');

    // Load Data
    await loadProjectsForDropdown();
    await loadTasks();

    // Modal Toggles
    addBtn.addEventListener('click', () => modal.style.display = 'flex');
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        form.reset();
    });

    // Save Data
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const taskData = {
            project_id: document.getElementById('taskProject').value,
            task_code: document.getElementById('taskCode').value,
            task_name: document.getElementById('taskName').value,
            status: 'TODO'
        };

        const { error } = await supabase.from('tasks').insert([taskData]);

        if (error) {
            alert('Error saving task: ' + error.message);
            console.error(error);
        } else {
            modal.style.display = 'none';
            form.reset();
            await loadTasks();
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    });

    async function loadProjectsForDropdown() {
        const { data, error } = await supabase
            .from('projects')
            .select('id, project_name')
            .eq('status', 'ACTIVE'); // Hanya paparkan projek yang aktif

        if (error) {
            projectSelect.innerHTML = `<option value="">Error loading projects</option>`;
            return;
        }

        projectSelect.innerHTML = `<option value="">-- Select Project --</option>` + 
            data.map(proj => `<option value="${proj.id}">${proj.project_name}</option>`).join('');
    }

    async function loadTasks() {
        // Fetch tasks bersama dengan nama project (menggunakan relationship foreign key Supabase)
        const { data, error } = await supabase
            .from('tasks')
            .select(`
                *,
                projects ( project_name )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            taskList.innerHTML = `<tr><td colspan="4" style="color:red">Error loading data</td></tr>`;
            return;
        }

        if (data.length === 0) {
            taskList.innerHTML = `<tr><td colspan="4">No tasks found.</td></tr>`;
            return;
        }

        taskList.innerHTML = data.map(task => `
            <tr>
                <td><strong>${task.task_code}</strong></td>
                <td>${task.task_name}</td>
                <td>${task.projects ? task.projects.project_name : 'Unknown Project'}</td>
                <td><span class="badge ${task.status === 'TODO' ? 'badge-todo' : ''}">${task.status}</span></td>
            </tr>
        `).join('');
    }
});
