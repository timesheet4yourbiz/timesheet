import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
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
    const employeeList = document.getElementById('employeeList');
    const modal = document.getElementById('employeeModal');
    const addBtn = document.getElementById('addEmployeeBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('employeeForm');
    const saveBtn = document.getElementById('saveBtn');

    // Load Data
    await loadEmployees();

    // Modal Toggles
    addBtn.addEventListener('click', () => modal.style.display = 'flex');
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        form.reset();
    });

    // Save Data
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const empData = {
            employee_code: document.getElementById('empCode').value,
            full_name: document.getElementById('empName').value,
            email: document.getElementById('empEmail').value,
            join_date: document.getElementById('empDate').value,
            employment_status: 'FULL_TIME',
            is_active: true
        };

        const { error } = await supabase.from('employees').insert([empData]);

        if (error) {
            alert('Error saving employee: ' + error.message);
            console.error(error);
        } else {
            modal.style.display = 'none';
            form.reset();
            await loadEmployees();
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    });

    async function loadEmployees() {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            employeeList.innerHTML = `<tr><td colspan="4" style="color:red">Error loading data</td></tr>`;
            return;
        }

        if (data.length === 0) {
            employeeList.innerHTML = `<tr><td colspan="4">No employees found.</td></tr>`;
            return;
        }

        employeeList.innerHTML = data.map(emp => `
            <tr>
                <td>${emp.employee_code}</td>
                <td><strong>${emp.full_name}</strong></td>
                <td>${emp.email}</td>
                <td>${emp.is_active ? 'Active' : 'Inactive'}</td>
            </tr>
        `).join('');
    }
});
