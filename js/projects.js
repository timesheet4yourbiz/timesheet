import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    // DOM Elements
    const projectsList = document.getElementById('projectsList');
    const projectModal = document.getElementById('projectModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveProjectBtn = document.getElementById('saveProjectBtn');
    
    const projectNameInput = document.getElementById('projectNameInput');
    const clientSelect = document.getElementById('clientSelect');
    const modalTitle = document.querySelector('.modal-header h3');

    let editProjectId = null;

    // Execution
    await loadClientDropdown();
    await loadProjects();

    // Modal Togglers
    openModalBtn.addEventListener('click', () => {
        editProjectId = null;
        projectNameInput.value = '';
        clientSelect.value = '';
        modalTitle.textContent = 'Create new Project';
        saveProjectBtn.textContent = 'CREATE';
        projectModal.style.display = 'flex';
    });

    const closeModal = () => projectModal.style.display = 'none';
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Load Clients into Dropdown
    async function loadClientDropdown() {
        const { data } = await supabase.from('clients').select('*').order('client_name');
        if (data) {
            clientSelect.innerHTML = '<option value="">Select client</option>' + 
                data.map(c => `<option value="${c.id}">${c.client_name}</option>`).join('');
        }
    }

    // Load Projects List
    async function loadProjects() {
        const { data: projectsData, error: projError } = await supabase.from('projects').select('*').order('project_name', { ascending: true });
        const { data: clientsData } = await supabase.from('clients').select('*');

        if (projError) {
            console.error("Supabase Error:", projError);
            projectsList.innerHTML = '<tr><td colspan="4" style="padding: 1.5rem; text-align: center; color: #ef4444;">Error loading data. Check console.</td></tr>';
            return;
        }

        if (!projectsData || projectsData.length === 0) {
            projectsList.innerHTML = '<tr><td colspan="4" style="padding: 1.5rem; text-align: center; color: #64748b;">No projects found.</td></tr>';
            return;
        }

        projectsList.innerHTML = projectsData.map(proj => {
            let clientName = '-';
            if (proj.client_id && clientsData) {
                const foundClient = clientsData.find(c => c.id === proj.client_id);
                if (foundClient) clientName = foundClient.client_name;
            } else if (proj.client && typeof proj.client === 'string') {
                clientName = proj.client;
            }

            const projStatus = proj.status || 'ACTIVE';

            return `
            <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                <td style="padding: 1rem 1.5rem; font-weight: 500; color: #334155;">
                    <span style="color: #03a9f4; margin-right: 8px;">•</span>${proj.project_name || '-'}
                </td>
                <td style="padding: 1rem 1.5rem; color: #64748b;">${clientName}</td>
                <td style="padding: 1rem 1.5rem;">
                    <span style="background: #f1f5f9; color: #475569; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem;">${projStatus}</span>
                </td>
                <td style="padding: 1rem 1.5rem; display: flex; gap: 0.5rem;">
                    <button class="edit-proj-btn" data-id="${proj.id}" data-name="${proj.project_name || ''}" data-client="${proj.client_id || ''}" style="background: none; border: none; cursor: pointer; color: #94a3b8;" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg>
                    </button>
                    <button class="delete-proj-btn" data-id="${proj.id}" style="background: none; border: none; cursor: pointer; color: #ef4444;" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            </tr>
        `}).join('');

        // Attach edit listeners
        document.querySelectorAll('.edit-proj-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.currentTarget;
                editProjectId = btnEl.getAttribute('data-id');
                projectNameInput.value = btnEl.getAttribute('data-name');
                clientSelect.value = btnEl.getAttribute('data-client');
                
                modalTitle.textContent = 'Edit Project';
                saveProjectBtn.textContent = 'SAVE';
                projectModal.style.display = 'flex';
            });
        });

        // Attach delete listeners
        document.querySelectorAll('.delete-proj-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const projId = e.currentTarget.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
                    const { error } = await supabase.from('projects').delete().eq('id', projId);
                    if (error) {
                        console.error("Delete Error:", error);
                        alert('Error deleting project. Make sure it is not linked to existing tasks/timesheets.');
                    } else {
                        await loadProjects(); // Refresh jadual
                    }
                }
            });
        });
    }

    // Save or Update Project
    saveProjectBtn.addEventListener('click', async () => {
        const pName = projectNameInput.value.trim();
        const cId = clientSelect.value;
        
        if (!pName) return alert('Please enter a project name.');

        saveProjectBtn.disabled = true;
        saveProjectBtn.textContent = 'Processing...';

        let errorObj = null;

        if (editProjectId) {
            const { error } = await supabase.from('projects')
                .update({ project_name: pName, client_id: cId || null })
                .eq('id', editProjectId);
            errorObj = error;
        } else {
            const dummyCode = 'PRJ-' + Math.floor(Math.random() * 10000);
            const { error } = await supabase.from('projects')
                .insert([{ project_name: pName, project_code: dummyCode, client_id: cId || null, status: 'ACTIVE' }]);
            errorObj = error;
        }

        saveProjectBtn.disabled = false;
        saveProjectBtn.textContent = editProjectId ? 'SAVE' : 'CREATE';

        if (errorObj) {
            console.error(errorObj);
            alert('Error saving project.');
        } else {
            closeModal();
            await loadProjects();
        }
    });
});
