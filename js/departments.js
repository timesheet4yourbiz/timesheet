import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';
document.addEventListener('DOMContentLoaded', async () => {
loadSidebar(); 
    
    // Semak Session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../pages/login.html';
        return;
    }
    
    document.getElementById('userEmail').textContent = session.user.email;
    
    // Logout Logic
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    // Elements
    const deptList = document.getElementById('deptList');
    const modal = document.getElementById('deptModal');
    const addBtn = document.getElementById('addDeptBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('deptForm');
    const saveBtn = document.getElementById('saveBtn');

    // Load Data
    await loadDepartments();

    // Modal Toggles
    addBtn.addEventListener('click', () => modal.style.display = 'flex');
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        form.reset();
    });

    // Save Data (Double click protection applied)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const deptData = {
            department_code: document.getElementById('deptCode').value,
            department_name: document.getElementById('deptName').value,
            status: 'ACTIVE'
        };

        const { error } = await supabase.from('departments').insert([deptData]);

        if (error) {
            alert('Error saving department: ' + error.message);
            console.error(error);
        } else {
            modal.style.display = 'none';
            form.reset();
            await loadDepartments();
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    });

    async function loadDepartments() {
        const { data, error } = await supabase
            .from('departments')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            deptList.innerHTML = `<tr><td colspan="3" style="color:red">Error loading data</td></tr>`;
            return;
        }

        if (data.length === 0) {
            deptList.innerHTML = `<tr><td colspan="3">No departments found.</td></tr>`;
            return;
        }

        deptList.innerHTML = data.map(dept => `
            <tr>
                <td><strong>${dept.department_code}</strong></td>
                <td>${dept.department_name}</td>
                <td>${dept.status}</td>
            </tr>
        `).join('');
    }
});
