import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    // Semak Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    // DOM Elements - Padanan dengan HTML bos
    const projectsList = document.getElementById('projectsList');
    
    // Modal Elements
    const projectModal = document.getElementById('projectModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveProjectBtn = document.getElementById('saveProjectBtn');
    
    // Input Elements
    const projectNameInput = document.getElementById('projectNameInput');
    const clientSelect = document.getElementById('clientSelect');

    await loadProjects();
    await loadClientsDropdown();

    // Buka Modal
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            projectModal.style.display = 'flex';
        });
    }

    // Tutup Modal
    const closeModal = () => {
        projectModal.style.display = 'none';
        projectNameInput.value = '';
        clientSelect.value = '';
    };
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Simpan Projek Baharu
    if (saveProjectBtn) {
        saveProjectBtn.addEventListener('click', async () => {
            const pName = projectNameInput.value.trim();
            const pClient = clientSelect.value; // Boleh digunakan jika bos ada lajur client_id dalam DB

            if (!pName) return alert('Sila masukkan nama projek.');

            saveProjectBtn.disabled = true;
            saveProjectBtn.textContent = 'CREATING...';

            // Simpan ke Supabase
            const { error } = await supabase.from('projects').insert([{ 
                project_name: pName,
                // client_id: pClient // Aktifkan jika jadual projects ada lajur client_id
            }]);

            saveProjectBtn.disabled = false;
            saveProjectBtn.textContent = 'CREATE';

            if (error) {
                alert('Ralat mencipta projek: ' + error.message);
            } else {
                closeModal();
                loadProjects(); // Muat semula jadual
            }
        });
    }

    // Muat turun Client ke Dropdown (Contoh jika ada jadual clients)
    async function loadClientsDropdown() {
        const { data, error } = await supabase.from('clients').select('id, client_name').order('client_name');
        if (data && clientSelect) {
            clientSelect.innerHTML = '<option value="">Select client</option>' + 
                data.map(c => `<option value="${c.id}">${c.client_name}</option>`).join('');
        }
    }

    // Tarik Senarai Projek (Jadual Bersih)
    async function loadProjects() {
        const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        
        if (error || !data || data.length === 0) {
            if (projectsList) projectsList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color: #888;">No projects found. Create one to get started.</td></tr>';
            return;
        }

        if (projectsList) {
            projectsList.innerHTML = data.map(p => `
                <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;">
                    <td style="padding: 1rem 1.5rem; font-weight: 500; color: #333;">
                        <span style="display:inline-block; width:8px; height:8px; background:#0ea5e9; border-radius:50%; margin-right:10px;"></span>
                        ${p.project_name || p.project_code || 'Tiada Nama'}
                    </td>
                    <td style="padding: 1rem 1.5rem; color: #666;">-</td>
                    <td style="padding: 1rem 1.5rem;">
                        <span style="background: #ecfdf5; color: #10b981; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">${p.status || 'ACTIVE'}</span>
                    </td>
                    <td style="padding: 1rem 1.5rem; text-align: left;">
                        <button class="del-project-btn" data-id="${p.id}" style="border:none; background:none; color:#ef4444; cursor:pointer; font-weight: 500; font-size: 0.85rem;">Delete</button>
                    </td>
                </tr>
            `).join('');

            // Fungsi Delete Projek
            document.querySelectorAll('.del-project-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Padam projek ini?')) {
                        await supabase.from('projects').delete().eq('id', e.target.getAttribute('data-id'));
                        loadProjects();
                    }
                });
            });
        }
    }
});
