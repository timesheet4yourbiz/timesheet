import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';
document.addEventListener('DOMContentLoaded', async () => {
loadSidebar(); 
    
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    // DOM Elements
    const clientsList = document.getElementById('clientsList');
    const clientModal = document.getElementById('clientModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveClientBtn = document.getElementById('saveClientBtn');
    const clientNameInput = document.getElementById('clientNameInput');
    const modalTitle = document.querySelector('.modal-header h3');

    // State Variables
    let editClientId = null;

    // Execution
    await loadClients();

    // Buka Modal (Mod Create Baru)
    openModalBtn.addEventListener('click', () => {
        editClientId = null; // Reset ID
        clientNameInput.value = '';
        modalTitle.textContent = 'Create New Client';
        saveClientBtn.textContent = 'Create Client';
        clientModal.style.display = 'flex';
    });

    const closeModal = () => clientModal.style.display = 'none';
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Save atau Update Client
    saveClientBtn.addEventListener('click', async () => {
        const clientName = clientNameInput.value.trim();
        if (!clientName) return alert('Please enter a client name.');

        saveClientBtn.disabled = true;
        saveClientBtn.textContent = 'Saving...';

        let errorObj = null;

        if (editClientId) {
            // UPDATE LOGIC
            const { error } = await supabase.from('clients')
                .update({ client_name: clientName })
                .eq('id', editClientId);
            errorObj = error;
        } else {
            // INSERT LOGIC
            const { error } = await supabase.from('clients')
                .insert([{ client_name: clientName, status: 'ACTIVE' }]);
            errorObj = error;
        }

        saveClientBtn.disabled = false;
        saveClientBtn.textContent = editClientId ? 'Update Client' : 'Create Client';

        if (errorObj) {
            console.error(errorObj);
            alert('Error saving client. Please try again.');
        } else {
            closeModal();
            await loadClients(); // Refresh jadual
        }
    });

    // Tarik dan Papar Senarai Client
    async function loadClients() {
        const { data, error } = await supabase.from('clients')
            .select('*')
            .order('client_name', { ascending: true });

        if (error || !data || data.length === 0) {
            clientsList.innerHTML = '<tr><td colspan="3" style="padding: 1.5rem; text-align: center; color: #64748b;">No clients found. Click "+ Add Client" to create one.</td></tr>';
            return;
        }

        clientsList.innerHTML = data.map(client => `
            <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                <td style="padding: 1rem 1.5rem; font-weight: 500; color: #334155;">${client.client_name}</td>
                <td style="padding: 1rem 1.5rem;">
                    <span style="background: #ecfdf5; color: #10b981; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">${client.status}</span>
                </td>
                <td style="padding: 1rem 1.5rem;">
                    <button class="edit-client-btn" data-id="${client.id}" data-name="${client.client_name}" style="background: none; border: none; cursor: pointer; color: #94a3b8; transition: color 0.2s;" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg>
                    </button>
                </td>
            </tr>
        `).join('');

        // Aktifkan Butang Edit (Mod Update)
        document.querySelectorAll('.edit-client-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const btnEl = e.currentTarget;
                editClientId = btnEl.getAttribute('data-id');
                const cName = btnEl.getAttribute('data-name');
                
                clientNameInput.value = cName;
                modalTitle.textContent = 'Edit Client';
                saveClientBtn.textContent = 'Update Client';
                clientModal.style.display = 'flex';
            });
        });
    }
});
