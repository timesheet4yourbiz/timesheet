import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    // Semakan Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    const tagsTableBody = document.getElementById('tagsTableBody');
    const newTagInput = document.getElementById('newTagInput');
    const addTagBtn = document.getElementById('addTagBtn');
    const searchTagInput = document.getElementById('searchTagInput');

    await loadTags();

    // Fungsi Tambah Tag
    if (addTagBtn) {
        addTagBtn.addEventListener('click', async () => {
            const tagName = newTagInput.value.trim();
            if (!tagName) return alert("Sila masukkan nama tag.");

            addTagBtn.disabled = true;
            addTagBtn.textContent = '...';

            const { error } = await supabase.from('tags').insert([{ tag_name: tagName }]);

            addTagBtn.disabled = false;
            addTagBtn.textContent = 'ADD';

            if (error) {
                console.error(error);
                alert("Ralat menambah tag: " + error.message);
            } else {
                newTagInput.value = '';
                await loadTags(); // Muat semula senarai
            }
        });
    }

    // Fungsi Carian Pantas (Client-side)
    if (searchTagInput) {
        searchTagInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const rows = tagsTableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const nameCell = row.querySelector('.tag-name-cell');
                if (nameCell) {
                    const name = nameCell.textContent.toLowerCase();
                    row.style.display = name.includes(searchTerm) ? '' : 'none';
                }
            });
        });
    }

    // Tarik Senarai Tag ke Jadual
    async function loadTags() {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .order('tag_name', { ascending: true });

        if (error || !data || data.length === 0) {
            if(tagsTableBody) tagsTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: #888;">No tags found. Add one above.</td></tr>';
            return;
        }

        if(tagsTableBody) {
            tagsTableBody.innerHTML = data.map(t => `
                <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                    <td style="padding: 15px 10px 15px 20px;">
                        <input type="checkbox" style="cursor: pointer;">
                    </td>
                    <td class="tag-name-cell" style="padding: 15px 20px; color: #334155; font-weight: 500;">
                        ${t.tag_name}
                    </td>
                    <td style="padding: 15px 20px; text-align: right; display: flex; justify-content: flex-end; gap: 10px;">
                        <!-- Butang Edit (Pensil) -->
                        <button class="edit-tag-btn" data-id="${t.id}" data-name="${t.tag_name}" style="border:none; background:none; color:#94a3b8; cursor:pointer; font-size: 1.1rem;" title="Edit Tag">✎</button>
                        <!-- Butang Delete -->
                        <button class="del-tag-btn" data-id="${t.id}" style="border:none; background:none; color:#ef4444; cursor:pointer; font-size: 1.1rem;" title="Delete Tag">⋮</button>
                    </td>
                </tr>
            `).join('');

            // Pendaftaran Event Listener untuk Edit & Delete
            document.querySelectorAll('.edit-tag-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const tagId = e.currentTarget.getAttribute('data-id');
                    const currentName = e.currentTarget.getAttribute('data-name');
                    
                    const newName = prompt("Kemaskini Nama Tag:", currentName);
                    if (newName && newName.trim() !== "" && newName !== currentName) {
                        await supabase.from('tags').update({ tag_name: newName.trim() }).eq('id', tagId);
                        loadTags();
                    }
                });
            });

            document.querySelectorAll('.del-tag-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Anda pasti mahu memadam tag ini?')) {
                        await supabase.from('tags').delete().eq('id', e.currentTarget.getAttribute('data-id'));
                        loadTags();
                    }
                });
            });
        }
    }
});
