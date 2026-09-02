import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    
    const employeesTableBody = document.getElementById('employeesTableBody');

    await loadEmployees();

    async function loadEmployees() {
        const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            employeesTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1.5rem;">No employees found.</td></tr>';
            return;
        }

        employeesTableBody.innerHTML = data.map(emp => {
            const isPending = emp.status === 'PENDING';
            const statusBadge = isPending 
                ? '<span style="background:#fef3c7; color:#d97706; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.8rem;">PENDING</span>'
                : '<span style="background:#ecfdf5; color:#10b981; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.8rem;">ACTIVE</span>';

            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.8rem; font-weight: 500;">${emp.email}</td>
                    <td style="padding: 0.8rem; color: var(--text-muted);">${emp.role}</td>
                    <td style="padding: 0.8rem;">${statusBadge}</td>
                    <td style="padding: 0.8rem; text-align: right;">
                        ${isPending ? `<button class="approve-btn" data-id="${emp.id}" style="border:none; background:none; color:#3ecf8e; cursor:pointer; margin-right: 1rem; font-weight: bold;">✔ Approve</button>` : ''}
                        <button class="delete-btn" data-id="${emp.id}" style="border:none; background:none; color:#ef4444; cursor:pointer;">✖ Remove</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Butang Approve
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const empId = e.target.getAttribute('data-id');
                await supabase.from('employees').update({ status: 'ACTIVE' }).eq('id', empId);
                loadEmployees();
            });
        });

        // Butang Delete
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Padam pekerja ini dari sistem?')) {
                    const empId = e.target.getAttribute('data-id');
                    await supabase.from('employees').delete().eq('id', empId);
                    loadEmployees();
                }
            });
        });
    }
});
