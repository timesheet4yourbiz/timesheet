import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Tunggu sidebar siap semak pangkat pengguna (Admin / Staff)
    await loadSidebar();

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
    
    // Elemen Carian
    const searchProjectInput = document.getElementById('searchProjectInput');
    const applyFilterBtn = document.getElementById('applyFilterBtn');

    // 2. KUNCI BUTANG "CREATE NEW PROJECT" (Jadi Kelabu jika BUKAN Admin)
    if (openModalBtn) {
        if (window.currentUserIsAdmin === false) {
            openModalBtn.style.backgroundColor = '#cbd5e1'; // Warna kelabu
            openModalBtn.style.borderColor = '#cbd5e1';
            openModalBtn.style.color = '#64748b';
            openModalBtn.style.cursor = 'not-allowed';
            openModalBtn.style.boxShadow = 'none';
            openModalBtn.title = 'Hanya Admin dibenarkan menambah projek baru';
            
            openModalBtn.addEventListener('click', (e) => {
                e.preventDefault();
                alert('Akses Terhad: Hanya Admin yang dibenarkan menambah projek baru.');
            });
        } else {
            openModalBtn.addEventListener('click', () => {
                projectModal.style.display = 'flex';
            });
        }
    }

    await loadProjects();
    await loadClientsDropdown();

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
            
            const payload = { 
                project_name: pName,
                status: 'ACTIVE'
            };
            
            if (pClient && pClient !== "") {
                payload.client_id = pClient;
            }
            
            const { data, error } = await supabase.from('projects').insert([payload]).select();
            saveProjectBtn.disabled = false;
            saveProjectBtn.textContent = 'CREATE';
            if (error) {
                alert('Ralat mencipta projek: ' + error.message);
                console.error("Ralat Insert:", error);
            } else {
                closeModal();
                await loadProjects(); 
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

    // FUNGSI MUAT TURUN PROJEK
    async function loadProjects(searchTerm = '') {
        if (projectsList) projectsList.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color: #64748b;">Loading projects...</td></tr>`;
        
        let query = supabase
            .from('projects')
            .select('*, clients(client_name)')
            .order('project_name', { ascending: true });
        
        if (searchTerm) {
            query = query.ilike('project_name', `%${searchTerm}%`);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error("Ralat muat turun projek:", error);
            if (projectsList) projectsList.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color: red;">Ralat: ${error.message}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            if (projectsList) projectsList.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color: #888;">${searchTerm ? 'Tiada projek dijumpai.' : 'No projects found. Create one to get started.'}</td></tr>`;
            return;
        }

        if (projectsList) {
            projectsList.innerHTML = data.map(p => {
                const clientName = p.clients ? p.clients.client_name : '-';
                
                // 3. KUNCI LAJUR ACTION (Ubah 'Delete' jadi 'View Only' jika BUKAN Admin)
                const actionColumnHtml = (window.currentUserIsAdmin === false)
                    ? `<span style="color:#cbd5e1; font-size:0.8rem; font-weight:500; cursor:not-allowed;">View Only</span>`
                    : `<button class="del-project-btn" data-id="${p.id}" style="border:none; background:none; color:#ef4444; cursor:pointer; font-weight: 500;">Delete</button>`;

                return `
                    <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                        <td style="padding: 15px 10px 15px 24px; width: 50px; text-align: center;">
                            <input type="checkbox" style="cursor: pointer;">
                        </td>
                        <td style="padding: 15px 20px 15px 10px; font-weight: 500; color: #1e293b; white-space: nowrap;">
                            <span style="display:inline-block; width:8px; height:8px; background:#0ea5e9; border-radius:50%; margin-right:8px;"></span>
                            <a href="project-details.html?id=${p.id}" style="text-decoration: none; color: inherit; cursor: pointer;">
                                ${p.project_name || p.project_code || 'Tiada Nama'}
                            </a>
                        </td>
                        <td style="padding: 15px 20px; color: #475569; font-weight: 500;">${clientName}</td>
                        <td style="padding: 15px; color: #64748b;">0.00h</td>
                        <td style="padding: 15px; color: #64748b;">0.00 MYR</td>
                        <td style="padding: 15px; color: #64748b;">-</td>
                        <td style="padding: 15px; color: #334155;">Public</td>
                        <td style="padding: 15px 24px; text-align: right;">
                            ${actionColumnHtml}
                        </td>
                    </tr>
                `;
            }).join('');

            document.querySelectorAll('.del-project-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Padam projek ini?')) {
                        await supabase.from('projects').delete().eq('id', e.target.getAttribute('data-id'));
                        loadProjects(searchProjectInput ? searchProjectInput.value.trim() : '');
                    }
                });
            });
        }
    }

    // EVENT LISTENER CARIAN
    if (applyFilterBtn && searchProjectInput) {
        applyFilterBtn.addEventListener('click', () => {
            loadProjects(searchProjectInput.value.trim());
        });

        searchProjectInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loadProjects(searchProjectInput.value.trim());
            }
        });

        searchProjectInput.addEventListener('input', (e) => {
            if (e.target.value.trim() === '') {
                loadProjects();
            }
        });
    }
});
