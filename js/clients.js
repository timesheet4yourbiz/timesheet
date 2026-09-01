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
    const clientsList = document.getElementById('clientsList');
    const clientModal = document.getElementById('clientModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveClientBtn = document.getElementById('saveClientBtn');
    const clientNameInput = document.getElementById('clientNameInput');

    // Execution
    await loadClients();

    // Modal Togglers
    openModalBtn.addEventListener('click', () => {
        clientNameInput.value = ''; // Kosongkan input
        clientModal.style.display = 'flex';
    });

    const closeModal = () => clientModal.style.display = 'none';
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Save Client ke Supabase
    saveClientBtn.addEventListener('click', async () => {
        const clientName = clientNameInput.value.trim();
        if (!clientName) return alert('Please enter a client name.');

        saveClientBtn.disabled = true;
        saveClientBtn.textContent = 'Saving...';

        const { error } = await supabase.from('clients').insert([{
            client_name: clientName,
            status: 'ACTIVE'
        }]);

        saveClientBtn.disabled = false;
        saveClientBtn.textContent = 'Create Client';

        if (error) {
            console.error(error);
            alert('Error saving client. Please try again.');
        } else {
            closeModal();
            await loadClients(); // Refresh jadual
        }
    });

    // Helper Function: Tarik senarai Client dari Supabase
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
                    <button style="background: none; border: none; cursor: pointer; color: #94a3b8;" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg>
                    </button>
                </td>
            </tr>
        `).join('');
    }
});
