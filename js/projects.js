import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../pages/login.html';
        });
    }

    const projectsList = document.getElementById('projectsList');
    
    // Tumpuan pada Modal (Popup)
    const projectModal = document.getElementById('projectModal');
    const addProjectBtn = document.querySelector('.btn-primary'); // Butang Create Project
    const closeModalBtns = document.querySelectorAll('.close-modal');
    
    // Form Inputs (Pastikan ID ini wujud dalam HTML bos)
    const projectNameInput = document.getElementById('projectName');
    const projectCodeInput = document.getElementById('projectCode');
    const saveProjectBtn = document.getElementById('saveProjectBtn');

    await loadProjects();

    // Buka Popup
    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', () => {
            if (projectModal) projectModal.style.display = 'flex';
        });
    }

    // Tutup Popup
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (projectModal) projectModal.style.display = 'none';
        });
    });

    // Tarik Senarai Projek
    async function loadProjects() {
        const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        
        if (error || !data || data.length === 0) {
            if (projectsList) projectsList.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem;">No projects found.</td></tr>';
            return;
        }

        if (projectsList) {
            projectsList.innerHTML = data.map(p => `
                <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                    <td style="padding: 1rem;"><strong>${p.project_code || '-'}</strong></td>
                    <td style="padding: 1rem;">${p.project_name || '-'}</td>
                    <td style="padding: 1rem;"><span style="background: #ecfdf5; color: #10b981; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">${p.status || 'ACTIVE'}</span></td>
                    <td style="padding: 1rem;">
                        <button class="del-project-btn" data-id="${p.id}" style="border:none; background:none; color:#ef4444; cursor:pointer;">Delete</button>
                    </td>
                </tr>
            `).join('');

            // Fungsi Delete
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
