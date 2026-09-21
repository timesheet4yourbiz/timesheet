import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let membersData = [];
let groupsData = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        bindFilters();
        setupNavigation();
        setupModal();
        
        await fetchGroups();
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
                        <h3>${tab.toUpperCase()} Module Coming Soon</h3>
                        <p>This section is scheduled for the next development phase.</p>
                    </div>`;
            } else {
                window.location.reload(); 
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
}

function getInitials(name) {
    if(!name) return '?';
    const parts = name.split(/[\s.@]+/);
    let init = parts[0].charAt(0).toUpperCase();
    if(parts.length > 1 && parts[1].length > 0) init += parts[1].charAt(0).toUpperCase();
    return init;
}

// --- MODAL & DATA SAVE LOGIC (TANPA EDGE FUNCTION) ---
function setupModal() {
    const modal = document.getElementById('memberModal');
    const btnClose = document.getElementById('btnCloseModal');
    const btnAdd = document.getElementById('btnAddMember');
    const form = document.getElementById('memberForm');

    btnClose.addEventListener('click', () => modal.style.display = 'none');
    
    // FUNGSI TAMBAH PEKERJA BARU
    btnAdd.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = "Add New Member";
        document.getElementById('formMemberId').value = ''; 
        document.getElementById('formEmail').value = '';
        document.getElementById('formEmail').disabled = false; 
        document.getElementById('formName').value = '';
        document.getElementById('formEmpNo').value = '';
        document.getElementById('formPhone').value = '';
        document.getElementById('formDept').value = '';
        document.getElementById('formPosition').value = '';
        document.getElementById('formRole').value = 'Employee';
        document.getElementById('formGroup').value = '';
        document.getElementById('formRate').value = '0.00';
        document.getElementById('formStatus').value = 'Active';
        
        modal.style.display = 'flex';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSave = document.getElementById('btnSaveMember');
        btnSave.textContent = "Saving...";
        btnSave.disabled = true;

        const empId = document.getElementById('formMemberId').value;
        const emailInput = document.getElementById('formEmail').value;
        const nameInput = document.getElementById('formName').value;
        
        const payload = {
            name: nameInput,
            employee_no: document.getElementById('formEmpNo').value,
            phone: document.getElementById('formPhone').value,
            department: document.getElementById('formDept').value,
            position: document.getElementById('formPosition').value,
            system_role: document.getElementById('formRole').value,
            group_id: document.getElementById('formGroup').value || null,
            billable_rate: parseFloat(document.getElementById('formRate').value || 0),
            status: document.getElementById('formStatus').value
        };

        if (empId) {
            // JIKA ADA ID: UPDATE PROFILE SEDIA ADA
            const result = await supabase.from('employees').update(payload).eq('id', empId);
            
            btnSave.textContent = "Save Member";
            btnSave.disabled = false;

            if (result.error) {
                alert("Database Error: " + result.error.message);
            } else {
                modal.style.display = 'none';
                fetchMembers(); 
            }
        } else {
            // JIKA TIADA ID: DAFTAR AKAUN BARU
            btnSave.textContent = "Creating Account...";
            
            const tempPassword = "TempPwd" + Math.floor(Math.random() * 1000000) + "!";
            
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: emailInput,
                password: tempPassword,
            });

            if (authError) {
                btnSave.textContent = "Save Member";
                btnSave.disabled = false;
                alert("Gagal mendaftar e-mel (Mungkin e-mel ini sudah wujud): " + authError.message);
                return;
            }

            if (authData.user) {
                payload.id = authData.user.id;
                payload.email = emailInput;
                
                // PENYELESAIAN DI SINI: Guna UPSERT untuk elak ralat Duplicate Key
                const { error: dbError } = await supabase.from('employees').upsert([payload]);
                
                btnSave.textContent = "Save Member";
                btnSave.disabled = false;

                if (dbError) {
                    alert("Account created, but failed to save profile info: " + dbError.message);
                } else {
                    alert(`Success! User has been added.\n\nIMPORTANT: Since this is an admin creation, the user's temporary password is:\n${tempPassword}\n\nPlease share this with them.`);
                    modal.style.display = 'none';
                    fetchMembers(); 
                }
            }
        }
    });

// FUNGSI EDIT PROFIL PEKERJA
window.openEditModal = function(id) {
    const member = membersData.find(m => m.id === id);
    if (!member) return;

    document.getElementById('modalTitle').textContent = "Edit Member Profile";
    document.getElementById('formMemberId').value = member.id;
    document.getElementById('formEmail').value = member.email || '';
    document.getElementById('formEmail').disabled = true; 
    document.getElementById('formName').value = member.name || '';
    document.getElementById('formEmpNo').value = member.employee_no || '';
    document.getElementById('formPhone').value = member.phone || '';
    document.getElementById('formDept').value = member.department || '';
    document.getElementById('formPosition').value = member.position || '';
    document.getElementById('formRole').value = member.system_role || 'Employee';
    document.getElementById('formGroup').value = member.group_id || '';
    document.getElementById('formRate').value = member.billable_rate || '0.00';
    document.getElementById('formStatus').value = member.status || 'Active';

    document.getElementById('memberModal').style.display = 'flex';
};

async function fetchGroups() {
    const { data } = await supabase.from('groups').select('id, group_name');
    groupsData = data || [];
    
    const grpSelect = document.getElementById('formGroup');
    if (grpSelect) {
        groupsData.forEach(g => {
            grpSelect.innerHTML += `<option value="${g.id}">${g.group_name}</option>`;
        });
    }
}

async function fetchMembers() {
    const tbody = document.getElementById('membersTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-overlay">Loading team members...</td></tr>';

    const { data, error } = await supabase
        .from('employees')
        .select(`
            id, name, email, employee_no, phone, department, position, 
            system_role, group_id, billable_rate, status, avatar_url,
            groups!group_id(group_name)
        `)
        .order('name');

    if (error) {
        console.error("Error fetching members:", error);
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:#ef4444;">Failed to load data. ${error.message}</td></tr>`;
        return;
    }

    membersData = data || [];
    renderTable(membersData);
}

function renderTable(data) {
    const tbody = document.getElementById('membersTableBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No team members found.</td></tr>';
        return;
    }

    data.forEach(member => {
        const init = getInitials(member.name || member.email);
        const dispName = member.name || 'Unknown Name';
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
                    <button class="action-btn" title="Edit Profile" onclick="openEditModal('${member.id}')">✎</button>
                </td>
            </tr>
        `;
    });
}
