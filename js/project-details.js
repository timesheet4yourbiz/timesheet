import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Muatkan Sidebar (Ini akan mengembalikan sidebar bos)
    loadSidebar();

    // 2. Semakan Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    // 3. Dapatkan ID Projek dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (!projectId) {
        alert("ID Projek tidak dijumpai.");
        window.location.href = 'projects.html';
        return;
    }

    // DOM Elements
    const pdName = document.getElementById('pdName');
    const pdClient = document.getElementById('pdClient');
    const tasksTableBody = document.getElementById('tasksTableBody');
    const newTaskInput = document.getElementById('newTaskInput');
    const addTaskBtn = document.getElementById('addTaskBtn');

    // Jalankan fungsi utama
    await loadProjectHeader();
    await loadTasks();

    // 4. Fungsi Add Task
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', async () => {
            const tName = newTaskInput.value.trim();
            if (!tName) return alert("Sila masukkan nama task.");

            addTaskBtn.disabled = true;
            addTaskBtn.textContent = '...';

            const { error } = await supabase.from('tasks').insert([{
                project_id: projectId,
                task_name: tName,
                status: 'PENDING'
            }]);

            addTaskBtn.disabled = false;
            addTaskBtn.textContent = 'ADD';

            if (error) {
                console.error(error);
                alert("Ralat menambah task: " + error.message);
            } else {
                newTaskInput.value = '';
                await loadTasks(); // Refresh jadual task
            }
        });
    }

    // Tarik Tajuk Projek & Client
    async function loadProjectHeader() {
        const { data, error } = await supabase
            .from('projects')
            .select('*, clients(client_name)')
            .eq('id', projectId)
            .single();

        if (error || !data) {
            if(pdName) pdName.textContent = 'Projek Tidak Dijumpai';
            return;
        }

        if(pdName) pdName.textContent = data.project_name || data.project_code || 'Tiada Nama';
        if(pdClient) pdClient.textContent = data.clients ? data.clients.client_name : 'Tiada Client';
    }

    // Tarik Senarai Task ke Jadual
    async function loadTasks() {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            if(tasksTableBody) tasksTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #888;">No tasks found for this project.</td></tr>';
            return;
        }

        if(tasksTableBody) {
            tasksTableBody.innerHTML = data.map(t => `
                <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                    <td style="padding: 15px 20px; color: #334155; font-weight: 500;">
                        ${t.task_name}
                    </td>
                    <td style="padding: 15px 20px;">
                        <span style="background: #e2e8f0; color: #475569; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Anyone ▼</span>
                    </td>
                    <td style="padding: 15px 20px; text-align: right;">
                        <button class="del-task-btn" data-id="${t.id}" style="border:none; background:none; color:#ef4444; cursor:pointer; font-weight: 500; font-size: 1rem;" title="Delete Task">⋮ Delete</button>
                    </td>
                </tr>
            `).join('');

            // Fungsi Padam Task
            document.querySelectorAll('.del-task-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Anda pasti mahu memadam task ini?')) {
                        await supabase.from('tasks').delete().eq('id', e.target.getAttribute('data-id'));
                        loadTasks();
                    }
                });
            });
        }
    }
});


// ==========================================
// FUNGSI LOAD TEMPLATE TASKS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const loadTemplateBtn = document.getElementById('loadTemplateBtn');
    
    if (loadTemplateBtn) {
        loadTemplateBtn.addEventListener('click', async () => {
            
            // 1. Dapatkan ID Projek dari URL (Contoh: ?id=123)
            const urlParams = new URLSearchParams(window.location.search);
            const projectId = urlParams.get('id'); 
            
            if (!projectId) {
                alert("Ralat: ID Projek tidak dijumpai.");
                return;
            }

            // 2. Tanya pengesahan dari pengguna
            if (!confirm("Adakah anda pasti untuk memuatkan senarai Task standard (Template) ke dalam projek ini?")) return;

            // 3. Senarai Task Standard Favelle Favco
            const templateTasks = [
                "SE - P (PRIMARY)",
                "SE - S (SECONDARY)",
                "ME - P (PRIMARY)",
                "ME - S (SECONDARY)",
                "EE - P (PRIMARY)",
                "EE - S (SECONDARY)",
                "DOCUMENTATION"
            ];

            // Tukar butang jadi mod loading
            const originalText = loadTemplateBtn.innerHTML;
            loadTemplateBtn.innerHTML = "⏳ Memuatkan...";
            loadTemplateBtn.disabled = true;

            try {
                // Sediakan data untuk dihantar ke Supabase
                const tasksToInsert = templateTasks.map(taskName => ({
                    project_id: projectId,
                    task_name: taskName
                }));

                // Hantar semua task sekaligus ke dalam table 'tasks'
                const { error } = await supabase
                    .from('tasks')
                    .insert(tasksToInsert);

                if (error) throw error;

                alert("Template berjaya dimuatkan!");
                
                // Refresh halaman supaya task baru muncul di skrin
                window.location.reload(); 
                
                // NOTA: Jika bos ada fungsi khas untuk refresh jadual (contoh: loadTasks()), 
                // bos boleh buang window.location.reload() dan panggil fungsi tersebut.

            } catch (error) {
                console.error("Ralat Template:", error);
                alert("Gagal memuatkan template: " + error.message);
            } finally {
                // Kembalikan butang ke asal
                loadTemplateBtn.innerHTML = originalText;
                loadTemplateBtn.disabled = false;
            }
        });
    }
});
