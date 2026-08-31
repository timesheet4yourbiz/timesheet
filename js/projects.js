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
    const projectList = document.getElementById('projectList');
    const modal = document.getElementById('projectModal');
    const addBtn = document.getElementById('addProjectBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('projectForm');
    const saveBtn = document.getElementById('saveBtn');

    // Load Data
    await loadProjects();

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

        const projData = {
            project_code: document.getElementById('projCode').value,
            project_name: document.getElementById('projName').value,
            client: document.getElementById('projClient').value,
            status: document.getElementById('projStatus').value
        };

        const { error } = await supabase.from('projects').insert([projData]);

        if (error) {
            alert('Error saving project: ' + error.message);
            console.error(error);
        } else {
            modal.style.display = 'none';
            form.reset();
            await loadProjects();
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    });

    async function loadProjects() {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            projectList.innerHTML = `<tr><td colspan="4" style="color:red">Error loading data</td></tr>`;
            return;
        }

        if (data.length === 0) {
            projectList.innerHTML = `<tr><td colspan="4">No projects found.</td></tr>`;
            return;
        }

        projectList.innerHTML = data.map(proj => `
            <tr>
                <td><strong>${proj.project_code}</strong></td>
                <td>${proj.project_name}</td>
                <td>${proj.client || '-'}</td>
                <td><span class="badge ${proj.status === 'ACTIVE' ? 'badge-active' : ''}">${proj.status}</span></td>
            </tr>
        `).join('');
    }
});
