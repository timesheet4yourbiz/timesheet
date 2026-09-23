import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();    

        // Auth
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';
        
        // Papar Emel (Dengan Perisai Null Check)
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;
        
        // Butang Logout (Dengan Perisai Null Check)
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await supabase.auth.signOut();
                window.location.href = '../pages/login.html';
            });
        }

        // DOM Elements
        const clientsList = document.getElementById('clientsList');
        const clientModal = document.getElementById('clientModal');
        const openModalBtn = document.getElementById('openModalBtn'); // Boleh jadi ID dari HTML bos
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const saveClientBtn = document.getElementById('saveClientBtn');
        const clientNameInput = document.getElementById('clientNameInput');
        const modalTitle = document.querySelector('.modal-header h3');

        // State Variables
        let editClientId = null;

        // Buka Modal (Mod Create Baru)
        if (openModalBtn) {
            openModalBtn.addEventListener('click', () => {
                editClientId = null; // Reset ID
                if (clientNameInput) clientNameInput.value = '';
                if (modalTitle) modalTitle.textContent = 'Create New Client';
                if (saveClientBtn) saveClientBtn.textContent = 'Create Client';
                if (clientModal) clientModal.style.display = 'flex';
            });
        }

        const closeModal = () => {
            if (clientModal) clientModal.style.display = 'none';
        };

        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        // Save atau Update Client
        if (saveClientBtn) {
            saveClientBtn.addEventListener('click', async () => {
                const clientName = clientNameInput ? clientNameInput.value.trim() : '';
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
        }

        // Tarik dan Papar Senarai Client
        async function loadClients() {
            if (!clientsList) return; // Perisai jika jadual tiada dalam HTML

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
                    
                    if (clientNameInput) clientNameInput.value = cName;
                    if (modalTitle) modalTitle.textContent = 'Edit Client';
                    if (saveClientBtn) saveClientBtn.textContent = 'Update Client';
                    if (clientModal) clientModal.style.display = 'flex';
                });
            });
        }

        // Laksanakan carian data pertama kali
        await loadClients();

    } catch (err) {
        console.error("Critical error in clients.js:", err);
    }
});
