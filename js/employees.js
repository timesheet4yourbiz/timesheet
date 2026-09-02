import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    
    const employeesTableBody = document.getElementById('employeesTableBody');
    const searchInput = document.getElementById('searchInput');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const bulkApproveBtn = document.getElementById('bulkApproveBtn');
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');

    let allEmployees = []; // Simpan data untuk fungsi carian

    await loadEmployees();

    // --- 1. FUNGSI TARIK DATA & RENDER JADUAL ---
    async function loadEmployees() {
        const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            employeesTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 1.5rem;">No employees found.</td></tr>';
            return;
        }

        allEmployees = data;
        renderTable(allEmployees);
    }

    function renderTable(data) {
        employeesTableBody.innerHTML = data.map(emp => {
            const isPending = emp.status === 'PENDING';
            const statusBadge = isPending 
                ? '<span style="background:#fef3c7; color:#d97706; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.8rem;">PENDING</span>'
                : '<span style="background:#ecfdf5; color:#10b981; padding:0.2rem 0.6rem; border-radius:4px; font-size:0.8rem;">ACTIVE</span>';

            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.8rem;"><input type="checkbox" class="row-checkbox" value="${emp.id}"></td>
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
        attachActionListeners();
    }

    // --- 2. FUNGSI CARIAN (SEARCH) ---
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allEmployees.filter(emp => emp.email.toLowerCase().includes(term) || emp.role.toLowerCase().includes(term));
        renderTable(filtered);
    });

    // --- 3. FUNGSI SELECT ALL KOTAK SEMAK ---
    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });

    // --- 4. FUNGSI PUKAL (BULK ACTIONS) ---
    function getSelectedIds() {
        const checkboxes = document.querySelectorAll('.row-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    bulkApproveBtn.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return alert('Sila tanda (tick) pekerja terlebih dahulu.');
        
        await supabase.from('employees').update({ status: 'ACTIVE' }).in('id', ids);
        selectAllCheckbox.checked = false;
        loadEmployees();
    });

    bulkDeleteBtn.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return alert('Sila tanda (tick) pekerja terlebih dahulu.');
        
        if (confirm(`Padam ${ids.length} pekerja ini secara serentak?`)) {
            await supabase.from('employees').delete().in('id', ids);
            selectAllCheckbox.checked = false;
            loadEmployees();
        }
    });

    // --- 5. FUNGSI BUTANG INDIVIDU ---
    function attachActionListeners() {
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await supabase.from('employees').update({ status: 'ACTIVE' }).eq('id', e.target.getAttribute('data-id'));
                loadEmployees();
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Padam pekerja ini?')) {
                    await supabase.from('employees').delete().eq('id', e.target.getAttribute('data-id'));
                    loadEmployees();
                }
            });
        });
    }
});
