import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    const projectsList = document.getElementById('projectsList');
    const projectModal = document.getElementById('projectModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveProjectBtn = document.getElementById('saveProjectBtn');
    
    const projectNameInput = document.getElementById('projectNameInput');
    const clientSelect = document.getElementById('clientSelect');

    await loadProjects();
    await loadClientsDropdown();

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            projectModal.style.display = 'flex';
        });
    }

    const closeModal = () => {
        projectModal.style.display = 'none';
        projectNameInput.value = '';
        clientSelect.value = '';
    };
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (saveProjectBtn) {
        saveProjectBtn.addEventListener('click', async () => {
            const pName = projectNameInput.value.trim();
            const pClient = clientSelect.value; 
            if (!pName) return alert('Sila masukkan nama projek.');
            saveProjectBtn.disabled = true;
            saveProjectBtn.textContent = 'CREATING...';
            const autoCode = 'PRJ-' + Math.floor(1000 + Math.random() * 9000);
            // Bina payload secara selamat
            // Bina payload secara aman tanpa pembuatan kode PRJ
            const payload = { 
                project_name: pName,
                status: 'ACTIVE'
            };
            
            // Hanya masukkan client_id jika pengguna benar-benar memilih client
            if (pClient && pClient !== "") {
                payload.client_id = pClient;
            }
            console.log("Menghantar data projek:", payload);
            const { data, error } = await supabase.from('projects').insert([payload]).select();
            saveProjectBtn.disabled = false;
            saveProjectBtn.textContent = 'CREATE';
            if (error) {
                alert('Ralat mencipta projek: ' + error.message);
                console.error("Ralat Insert:", error);
            } else {
                console.log('Projek berjaya disimpan ke Supabase:', data);
                closeModal();
                await loadProjects(); // Muat semula senarai
            }
        });
    }

    async function loadClientsDropdown() {
        const { data, error } = await supabase.from('clients').select('id, client_name').order('client_name');
        if (!error && data && clientSelect) {
            clientSelect.innerHTML = '<option value="">Select client</option>' + 
                data.map(c => `<option value="${c.id}">${c.client_name}</option>`).join('');
        }
    }

    async function loadProjects() {
        console.log("Memuat turun senarai projek bersama Client...");
        
        // Kita aktifkan semula '.select('*, clients(client_name)')' untuk tarik nama client
        const { data, error } = await supabase
            .from('projects')
            .select('*, clients(client_name)')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error("Ralat muat turun projek:", error);
            if (projectsList) projectsList.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color: red;">Ralat: ${error.message}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            if (projectsList) projectsList.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:2rem; color: #888;">No projects found. Create one to get started.</td></tr>';
            return;
        }

        if (projectsList) {
            projectsList.innerHTML = data.map(p => {
                // Tarik nama client jika wujud, jika tiada letak '-'
                const clientName = p.clients ? p.clients.client_name : '-';

                return `
                    <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                        
                        <!-- Kotak Checkbox (Lebar dilaras, padding dikemas) -->
                        <td style="padding: 15px 10px 15px 24px; width: 50px; text-align: center;">
                            <input type="checkbox" style="cursor: pointer;">
                        </td>
                        
                        <!-- Nama Projek (Jarak yang selesa dari checkbox) -->
                        <td style="padding: 15px 20px 15px 10px; font-weight: 500; color: #1e293b; white-space: nowrap;">
                            <span style="display:inline-block; width:8px; height:8px; background:#0ea5e9; border-radius:50%; margin-right:8px;"></span>
                            <a href="project-details.html?id=${p.id}" style="text-decoration: none; color: inherit; cursor: pointer;">
                                ${p.project_name || p.project_code || 'Tiada Nama'}
                            </a>
                        </td>
                        
                        <!-- Client -->
                        <td style="padding: 15px 20px; color: #475569; font-weight: 500;">
                            ${clientName}
                        </td>
                        
                        <td style="padding: 15px; color: #64748b;">0.00h</td>
                        <td style="padding: 15px; color: #64748b;">0.00 MYR</td>
                        <td style="padding: 15px; color: #64748b;">-</td>
                        <td style="padding: 15px; color: #334155;">Public</td>
                        
                        <td style="padding: 15px 24px; text-align: right;">
                            <button class="del-project-btn" data-id="${p.id}" style="border:none; background:none; color:#ef4444; cursor:pointer; font-weight: 500;">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');

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
