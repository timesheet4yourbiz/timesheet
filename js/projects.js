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
        const { data } = await supabase.from('clients').select('id, client_name').eq('status', 'ACTIVE').order('client_name');
        if (data) {
            clientSelect.innerHTML = '<option value="">Select client</option>' + 
                data.map(c => `<option value="${c.id}">${c.client_name}</option>`).join('');
        }
    }

    // Load Projects List
    async function loadProjects() {
        // Tarik projects dan pautkan (join) dengan jadual clients untuk dapatkan nama klien
        const { data, error } = await supabase.from('projects')
            .select(`
                id, 
                project_name, 
                status, 
                client_id,
                clients (client_name)
            `)
            .order('project_name', { ascending: true });

        if (error || !data || data.length === 0) {
            projectsList.innerHTML = '<tr><td colspan="4" style="padding: 1.5rem; text-align: center; color: #64748b;">No projects found.</td></tr>';
            return;
        }

        projectsList.innerHTML = data.map(proj => {
            const clientName = proj.clients ? proj.clients.client_name : '-';
            return `
            <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                <td style="padding: 1rem 1.5rem; font-weight: 500; color: #334155;">
                    <span style="color: #ef4444; margin-right: 8px;">•</span>${proj.project_name}
                </td>
                <td style="padding: 1rem 1.5rem; color: #64748b;">${clientName}</td>
                <td style="padding: 1rem 1.5rem;">
                    <span style="background: #f1f5f9; color: #475569; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem;">${proj.status}</span>
                </td>
                <td style="padding: 1rem 1.5rem;">
                    <button class="edit-proj-btn" data-id="${proj.id}" data-name="${proj.project_name}" data-client="${proj.client_id || ''}" style="background: none; border: none; cursor: pointer; color: #94a3b8;" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg>
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
            // Update
            const { error } = await supabase.from('projects')
                .update({ 
                    project_name: pName, 
                    client_id: cId || null 
                })
                .eq('id', editProjectId);
            errorObj = error;
        } else {
            // Generate dummy project_code
            const dummyCode = 'PRJ-' + Math.floor(Math.random() * 10000);
            
            // Insert
            const { error } = await supabase.from('projects')
                .insert([{ 
                    project_name: pName, 
                    project_code: dummyCode,
                    client_id: cId || null, 
                    status: 'ACTIVE' 
                }]);
            errorObj = error;
        }

        saveProjectBtn.disabled = false;
        saveProjectBtn.textContent = editProjectId ? 'SAVE' : 'CREATE';

        if (errorObj) {
            console.error(errorObj);
            alert('Error saving project. Please check console for details.');
        } else {
            closeModal();
            await loadProjects();
        }
    });
});
