import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let membersData = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        bindFilters();
        setupNavigation();
        
        await fetchMembers();

    } catch (error) {
        console.error("Team Module Init Error:", error);
    }
});

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            e.target.classList.add('active');
            
            const tab = e.target.getAttribute('data-tab');
            if(tab !== 'members') {
                document.getElementById('moduleContent').innerHTML = `
                    <div class="table-card" style="padding: 40px; text-align: center; color: #64748b;">
                        <h3>Modul ${tab.toUpperCase()} Akan Datang</h3>
                        <p>Bahagian ini dijadualkan untuk fasa seterusnya.</p>
                    </div>`;
            } else {
                window.location.reload(); // Quick reset untuk demo fasa ini
            }
        });
    });
}

function bindFilters() {
    const searchInput = document.getElementById('searchMember');
    const roleSelect = document.getElementById('filterRole');
    const statusSelect = document.getElementById('filterStatus');

    const filterTable = () => {
        const term = searchInput.value.toLowerCase();
        const role = roleSelect.value;
        const status = statusSelect.value;

        const filtered = membersData.filter(m => {
            const matchName = (m.name || '').toLowerCase().includes(term) || (m.email || '').toLowerCase().includes(term);
            const matchRole = role === 'all' || m.system_role === role;
            const matchStatus = status === 'all' || m.status === status;
            return matchName && matchRole && matchStatus;
        });
        renderTable(filtered);
    };

    if (searchInput) searchInput.addEventListener('keyup', filterTable);
    if (roleSelect) roleSelect.addEventListener('change', filterTable);
    if (statusSelect) statusSelect.addEventListener('change', filterTable);
    
    const btnAdd = document.getElementById('btnAddMember');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            alert('Modul "Add New Member" akan menyusul pada fasa profil. Buat masa ini, kita fokus memaparkan senarai pekerja.');
        });
    }
}

function getInitials(name) {
    if(!name) return '?';
    const parts = name.split(/[\s.@]+/);
    let init = parts[0].charAt(0).toUpperCase();
    if(parts.length > 1 && parts[1].length > 0) init += parts[1].charAt(0).toUpperCase();
    return init;
}

async function fetchMembers() {
    const tbody = document.getElementById('membersTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-overlay">Menyedut data pangkalan data...</td></tr>';

    // Mengambil pekerja berserta nama kumpulan (group) melalui Foreign Key
    const { data, error } = await supabase
        .from('employees')
        .select(`
            id, name, email, employee_no, department, position, 
            system_role, billable_rate, status, avatar_url,
            groups(group_name)
        `)
        .order('name');

    if (error) {
        console.error("Error fetching members:", error);
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:#ef4444;">Gagal memuatkan data. ${error.message}</td></tr>`;
        return;
    }

    membersData = data || [];
    renderTable(membersData);
}

function renderTable(data) {
    const tbody = document.getElementById('membersTableBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Tiada rekod pekerja dijumpai.</td></tr>';
        return;
    }

    data.forEach(member => {
        const init = getInitials(member.name || member.email);
        const dispName = member.name || 'Tiada Nama';
        const empNo = member.employee_no ? ` | ID: ${member.employee_no}` : '';
        const role = member.system_role || 'Employee';
        const group = member.groups ? member.groups.group_name : '<span style="color:#94a3b8;">-</span>';
        const rate = member.billable_rate ? parseFloat(member.billable_rate).toFixed(2) : '0.00';
        
        const statusClass = member.status === 'Active' ? 'status-active' : 'status-inactive';
        const statusText = member.status || 'Active';

        tbody.innerHTML += `
            <tr>
                <td><input type="checkbox"></td>
                <td>
                    <div class="member-info">
                        <div class="avatar">${init}</div>
                        <div>
                            <div class="m-name" style="text-transform: capitalize;">${dispName}</div>
                            <div class="m-meta">${member.email}${empNo}</div>
                        </div>
                    </div>
                </td>
                <td><span style="font-weight:500;">${role}</span><br><span style="font-size:0.75rem; color:#64748b;">${member.position || 'No Position'}</span></td>
                <td>${group}</td>
                <td>${rate}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td style="text-align: center;">
                    <button class="action-btn" title="More Actions">⋮</button>
                </td>
            </tr>
        `;
    });
}
