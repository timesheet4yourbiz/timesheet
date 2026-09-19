import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    const projectsList = document.getElementById('projectsList');
    const projectModal = document.getElementById('projectModal');
    const addProjectBtn = document.querySelector('.btn-primary');
    const closeModalBtns = document.querySelectorAll('.close-modal');

    await loadProjects();

    if (addProjectBtn) addProjectBtn.addEventListener('click', () => { if (projectModal) projectModal.style.display = 'flex'; });
    closeModalBtns.forEach(btn => btn.addEventListener('click', () => { if (projectModal) projectModal.style.display = 'none'; }));

    async function loadProjects() {
        // Tarik projek berserta task di dalamnya secara serentak
        const { data, error } = await supabase
            .from('projects')
            .select('*, tasks(*)')
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            if (projectsList) projectsList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem;">No projects found.</td></tr>';
            return;
        }

        if (projectsList) {
            projectsList.innerHTML = data.map(p => `
                <!-- Baris Utama Projek (Boleh Diklik) -->
                <tr class="project-row" data-id="${p.id}" style="border-bottom: 1px solid var(--border-color); background: white; cursor: pointer; transition: 0.2s;">
                    <td style="padding: 1rem;"><strong>${p.project_code || '-'}</strong></td>
                    <td style="padding: 1rem; color: #0ea5e9; font-weight: 600;">
                        ${p.project_name || '-'} 
                        <span style="font-size: 0.75rem; color: #94a3b8; margin-left: 10px;">▼ Klik untuk urus Task</span>
                    </td>
                    <td style="padding: 1rem;"><span style="background: #ecfdf5; color: #10b981; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">${p.status || 'ACTIVE'}</span></td>
                    <td style="padding: 1rem; text-align: right;">
                        <button class="del-project-btn" data-id="${p.id}" style="border:none; background:none; color:#ef4444; cursor:pointer; font-weight: 600;">Delete</button>
                    </td>
                </tr>
                
                <!-- Ruangan Tersembunyi Task (Accordion Slide) -->
                <tr style="border:none; background: #f8fafc;">
                    <td colspan="4" style="padding: 0;">
                        <div class="task-accordion-wrapper" id="tasks-${p.id}">
                            <div class="task-accordion-inner">
                                <div style="padding: 1.5rem; border-bottom: 1px solid var(--border-color); margin-left: 20px; border-left: 3px solid #0ea5e9;">
                                    
                                    <!-- Kotak Tambah Task Baru Secara Langsung -->
                                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                                        <input type="text" id="newTask-${p.id}" placeholder="Tambah Task baharu untuk projek ini..." style="flex:1; padding:0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-family: inherit;">
                                        <button class="add-task-btn" data-projectid="${p.id}" style="padding:0.6rem 1.5rem; background:#3ecf8e; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">+ Add Task</button>
                                    </div>
                                    
                                    <!-- Senarai Task -->
                                    <ul style="list-style: none; padding: 0; margin: 0;">
                                        ${p.tasks && p.tasks.length > 0 ? p.tasks.map(t => `
                                            <li style="display:flex; justify-content:space-between; align-items: center; padding:0.8rem 0; border-bottom:1px dashed #cbd5e1; font-size: 0.9rem;">
                                                <span style="color: var(--text-main); font-weight: 500;">• ${t.task_name}</span>
                                                <button class="del-task-btn" data-id="${t.id}" style="color:#ef4444; background:none; border:none; cursor:pointer; font-weight:bold; font-size: 0.8rem;">✕ Padam</button>
                                            </li>
                                        `).join('') : '<li style="color:#94a3b8; font-style:italic; font-size: 0.85rem;">Tiada task untuk projek ini. Sila tambah di atas.</li>'}
                                    </ul>
                                    
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            `).join('');

            // --- EVENT LISTENERS ---

            // 1. Logik Klik Baris Projek (Buka/Tutup Slide)
            document.querySelectorAll('.project-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    // Jangan buka slide kalau pengguna sengaja klik butang Delete
                    if(e.target.classList.contains('del-project-btn')) return; 
                    
                    const projectId = row.getAttribute('data-id');
                    const wrapper = document.getElementById(`tasks-${projectId}`);
                    
                    wrapper.classList.toggle('open'); // Mula animasi turun/naik
                    row.style.background = wrapper.classList.contains('open') ? '#f1f5f9' : 'white';
                });
            });

            // 2. Logik Tambah Task
            document.querySelectorAll('.add-task-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const projectId = e.target.getAttribute('data-projectid');
                    const inputEl = document.getElementById(`newTask-${projectId}`);
                    const taskName = inputEl.value.trim();

                    if (!taskName) return alert('Sila masukkan nama task.');

                    btn.textContent = '...';
                    btn.disabled = true;

                    await supabase.from('tasks').insert([{ project_id: projectId, task_name: taskName }]);
                    loadProjects(); // Auto-refresh paparan
                });
            });

            // 3. Logik Padam Task
            document.querySelectorAll('.del-task-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Anda pasti mahu memadam task ini?')) {
                        await supabase.from('tasks').delete().eq('id', e.target.getAttribute('data-id'));
                        loadProjects();
                    }
                });
            });

            // 4. Logik Padam Projek
            document.querySelectorAll('.del-project-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('AMARAN: Padam projek ini akan turut memadam SEMUA task di dalamnya. Teruskan?')) {
                        await supabase.from('projects').delete().eq('id', e.target.getAttribute('data-id'));
                        loadProjects();
                    }
                });
            });
        }
    }
});
