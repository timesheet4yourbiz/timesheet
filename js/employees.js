import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let membersData = [];
let groupsData = [];
window.currentUserRole = 'Employee'; 

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        const { data: profile } = await supabase
            .from('employees')
            .select('system_role')
            .eq('id', session.user.id)
            .single();

        if (profile) window.currentUserRole = profile.system_role;

        if (window.currentUserRole !== 'Admin') {
            const btnAddMember = document.getElementById('btnAddMember');
            const btnAddGroup = document.getElementById('btnAddGroup');
            if (btnAddMember) btnAddMember.style.display = 'none';
            if (btnAddGroup) btnAddGroup.style.display = 'none';
        }

        setupNavigation();
        bindFilters();
        
        if (window.currentUserRole === 'Admin') {
            setupMemberModal();
            setupGroupModal();
        }
        
        // Panggil enjin Excel
        setupExcelImport();

        await fetchMembers(); 
        await fetchGroups();

    } catch (error) {
        console.error("Team Module Init Error:", error);
    }
});

// ==================== EXCEL IMPORT LOGIC ====================
function setupExcelImport() {
    const btnImport = document.getElementById('btnImportExcel');
    const fileInput = document.getElementById('excelFileInput');

    if (btnImport && fileInput) {
        btnImport.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleExcelUpload);
    }
}

async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const excelData = XLSX.utils.sheet_to_json(worksheet);
            
            if (excelData.length === 0) {
                alert("Fail Excel kosong!");
                return;
            }

            alert(`Berjaya membaca ${excelData.length} baris data. Sedang mendaftar pekerja...`);

            for (const row of excelData) {
                const getVal = (...keys) => {
                    const match = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
                    return match ? row[match] : null;
                };

                const email = getVal('email', 'e-mail', 'emel');
                const name = getVal('name', 'nama', 'full name', 'nama penuh') || 'Unknown Name';
                const department = getVal('department', 'jabatan', 'dept');
                const position = getVal('position', 'jawatan', 'post');
                const role = getVal('role', 'system_role', 'peranan') || 'Employee';
                const tempPassword = getVal('password', 'kata laluan') || 'Cranetrack2026';

                if (!email) continue;

                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: email,
                    password: tempPassword,
                    options: { data: { full_name: name } }
                });

                if (authError) {
                    console.error(`Gagal mendaftar ${email}:`, authError.message);
                    continue; 
                }

                if (authData.user) {
                    await supabase.from('employees').insert({
                        id: authData.user.id,
                        name: name,
                        email: email,
                        department: department,
                        position: position,
                        system_role: role,
                        status: 'ACTIVE'
                    });
                }
            }

            alert("Semua pekerja berhasil diimport dan didaftarkan!");
            window.location.reload();

        } catch (error) {
            console.error("Ralat Import:", error);
            alert("Gagal mengimport data: " + error.message);
        }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = ''; // Reset input
}

// ==================== NAVIGATION & FILTERS ====================
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById('membersView').style.display = 'none';
            document.getElementById('groupsView').style.display = 'none';
            document.getElementById('remindersView').style.display = 'none';
            document.getElementById(e.target.getAttribute('data-tab') + 'View').style.display = 'block';
        });
    });
}

function bindFilters() {
    const searchInput = document.getElementById('searchMember');
    const roleSelect = document.getElementById('filterRole');
    const statusSelect = document.getElementById('filterStatus');

    const filterMembers = () => {
        const term = searchInput ? searchInput.value.toLowerCase() : '';
        const role = roleSelect ? roleSelect.value : 'all';
        const status = statusSelect ? statusSelect.value : 'all';

        const filtered = membersData.filter(m => {
            const matchName = (m.name || '').toLowerCase().includes(term) || (m.email || '').toLowerCase().includes(term);
            const matchRole = role === 'all' || m.system_role === role;
            const matchStatus = status === 'all' || m.status === status;
            return matchName && matchRole && matchStatus;
        });
        renderMembersTable(filtered);
    };

    if (searchInput) searchInput.addEventListener('keyup', filterMembers);
    if (roleSelect) roleSelect.addEventListener('change', filterMembers);
    if (statusSelect) statusSelect.addEventListener('change', filterMembers);
}

async function fetchMembers() {
    const { data, error } = await supabase
        .from('employees')
        .select(`
            id, name, email, employee_no, phone, department, position, 
            system_role, group_id, billable_rate, status, avatar_url,
            groups!group_id(group_name)
        `)
        .order('name');

    if (!error) {
        membersData = data || [];
        renderMembersTable(membersData);
        populateManagerDropdown(); 
    }
}

// ==================== RENDERING JADUAL PEKERJA ====================
let currentPage = 1;
const rowsPerPage = 20;

function renderMembersTable(data) {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Tiada rekod pekerja.</td></tr>';
        if (typeof updatePagination === 'function') updatePagination(0);
        return;
    }

    tbody.innerHTML = '';
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedData = data.slice(startIndex, startIndex + rowsPerPage);

    paginatedData.forEach(member => {
        const displayName = member.name || 'Unknown Name';
        const init = displayName.substring(0, 2).toUpperCase();
        const empNo = member.employee_no ? ` | ID: ${member.employee_no}` : '';
        const statusClass = (member.status || '').toUpperCase() === 'ACTIVE' ? 'status-active' : 'status-inactive';
        const rate = member.billable_rate ? parseFloat(member.billable_rate).toFixed(2) : '0.00';
        
        let groupName = '-';
        if (member.groups && member.groups.group_name) {
            groupName = member.groups.group_name;
        }

        tbody.innerHTML += `
            <tr>
                <td><input type="checkbox"></td>
                <td>
                    <div class="member-info">
                        <div class="avatar">${init}</div>
                        <div>
                            <div class="m-name" style="text-transform: capitalize;">${displayName}</div>
                            <div class="m-meta">${member.email}${empNo}</div>
                        </div>
                    </div>
                </td>
                <td><span style="font-weight:500;">${member.system_role || 'Employee'}</span><br><span style="font-size:0.75rem; color:#64748b;">${member.position || 'No Position'}</span></td>
                <td>${groupName}</td>
                <td>${rate}</td>
                <td><span class="status-badge ${statusClass}">${member.status || 'ACTIVE'}</span></td>
                <td style="text-align: center; white-space: nowrap;">
                    <div style="display: flex; justify-content: center; align-items: center; gap: 8px;">
                        <button class="action-btn" onclick="openEditModal('${member.id}')" title="Edit Member" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:2px 4px;">✏️</button>
                        <button class="action-btn" onclick="deleteMember('${member.id}')" title="Delete Member" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:2px 4px;">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    });

    if (typeof updatePagination === 'function') updatePagination(data.length);
}

// ==================== MODAL ADD/EDIT MEMBER ====================
function setupMemberModal() {
    const modal = document.getElementById('memberModal');
    const btnClose = document.getElementById('btnCloseModal');
    const btnAdd = document.getElementById('btnAddMember');
    const form = document.getElementById('memberForm');

    if(btnClose) btnClose.addEventListener('click', () => modal.style.display = 'none');
    
    if(btnAdd) {
        btnAdd.addEventListener('click', () => {
            document.getElementById('modalTitle').textContent = "Add New Member";
            document.getElementById('formMemberId').value = ''; 
            document.getElementById('formEmail').value = '';
            document.getElementById('formEmail').disabled = false; 
            form.reset(); 
            modal.style.display = 'flex';
        });
    }

    if(form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('btnSaveMember');
            if(btnSave) btnSave.disabled = true;

            const getVal = (id) => {
                const el = document.getElementById(id);
                return el ? el.value : null;
            };

            const empId = getVal('formMemberId');
            const emailInput = getVal('formEmail');
            
            const payload = {
                name: getVal('formName') || 'Unknown',
                employee_no: getVal('formEmpNo'),
                phone: getVal('formPhone'),
                department: getVal('formDept'),
                position: getVal('formPosition'),
                system_role: getVal('formRole') || 'Employee',
                group_id: getVal('formGroup') || null, 
                billable_rate: parseFloat(getVal('formRate') || 0),
                status: (getVal('formStatus') || 'ACTIVE').toUpperCase()
            };

            try {
                if (empId) {
                    const { error } = await supabase.from('employees').update(payload).eq('id', empId);
                    if(error) throw error;
                    alert("Data berjaya disimpan!");
                } else {
                    if(btnSave) btnSave.textContent = "Sending Invite...";
                    const tempPassword = "Pwd" + Math.floor(Math.random() * 1000000) + "A!";
                    
                    const { data: authData, error: authError } = await supabase.auth.signUp({ 
                        email: emailInput, 
                        password: tempPassword,
                        options: { data: { full_name: payload.name } }
                    });
                    
                    if (authError) throw authError;
                    if (authData.user) {
                        payload.id = authData.user.id;
                        payload.email = emailInput;
                        const { error: upsertErr } = await supabase.from('employees').upsert([payload]);
                        if(upsertErr) throw upsertErr;
                    }
                    alert("Berjaya ditambah!");
                }
                modal.style.display = 'none';
                window.location.reload(); 
            } catch (error) {
                console.error('Ralat simpan:', error);
                alert('Gagal menyimpan: ' + error.message);
            } finally {
                if(btnSave) {
                    btnSave.textContent = "Save Member";
                    btnSave.disabled = false;
                }
            }
        });
    }
}

window.openEditModal = function(id) {
    const member = membersData.find(m => m.id === id);
    if (!member) return;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.value = val || '';
    };

    document.getElementById('modalTitle').textContent = "Edit Member Profile";
    setVal('formMemberId', member.id);
    setVal('formEmail', member.email);
    const emailEl = document.getElementById('formEmail');
    if(emailEl) emailEl.disabled = true; 
    
    setVal('formName', member.name);
    setVal('formEmpNo', member.employee_no);
    setVal('formPhone', member.phone);
    setVal('formDept', member.department);
    setVal('formPosition', member.position);
    setVal('formRole', member.system_role || 'Employee');
    setVal('formGroup', member.group_id);
    setVal('formRate', member.billable_rate || '0.00');
    setVal('formStatus', (member.status || 'Active').charAt(0).toUpperCase() + (member.status || 'Active').slice(1).toLowerCase());

    document.getElementById('memberModal').style.display = 'flex';
};

window.deleteMember = async function(id) {
    if (!confirm('Adakah anda pasti mahu memadam pekerja ini?')) return;
    try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
        alert('Pekerja berjaya dipadam!');
        window.location.reload();
    } catch (err) {
        alert('Gagal memadam pekerja: ' + err.message);
    }
};

// ==========================================
// GROUPS MODULE LOGIC
// ==========================================
async function fetchGroups() {
    const { data, error } = await supabase.from('groups').select(`id, group_name, description, manager_id, status`).order('group_name');
    if (!error) {
        groupsData = data || [];
        populateGroupDropdowns(); 
        renderGroupsTable(groupsData);
    }
}

function renderGroupsTable(data) {
    const tbody = document.getElementById('groupsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No groups created yet.</td></tr>';
        return;
    }

    data.forEach(group => {
        const memberCount = membersData.filter(m => m.group_id === group.id).length;
        const managerObj = membersData.find(m => m.id === group.manager_id);
        const managerName = managerObj ? managerObj.name : '<span style="color:#94a3b8;">- No Manager -</span>';
        const statusClass = group.status === 'Active' ? 'status-active' : 'status-inactive';

        tbody.innerHTML += `
            <tr>
                <td><span style="font-weight:600; color:#334155;">${group.group_name}</span></td>
                <td>${managerName}</td>
                <td><span style="background:#e2e8f0; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">${memberCount} members</span></td>
                <td><span class="status-badge ${statusClass}">${group.status || 'Active'}</span></td>
                <td style="text-align: center;">
                    ${window.currentUserRole === 'Admin' 
                        ? `<button class="action-btn" onclick="openEditGroupModal('${group.id}')">✎</button>` 
                        : `<span style="font-size:0.8rem; color:#cbd5e1;">🔒</span>`}
                </td>
            </tr>
        `;
    });
}

function setupGroupModal() {
    const modal = document.getElementById('groupModal');
    const form = document.getElementById('groupForm');

    document.getElementById('btnCloseGroupModal')?.addEventListener('click', () => modal.style.display = 'none');
    
    document.getElementById('btnAddGroup')?.addEventListener('click', () => {
        document.getElementById('groupModalTitle').textContent = "Create New Group";
        if(form) form.reset();
        document.getElementById('formGroupId').value = ''; 
        modal.style.display = 'flex';
    });

    if(form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('btnSaveGroup');
            if(btnSave) btnSave.disabled = true;

            const groupId = document.getElementById('formGroupId').value;
            const payload = {
                group_name: document.getElementById('formGroupName').value,
                description: document.getElementById('formGroupDesc').value,
                manager_id: document.getElementById('formGroupManager').value || null,
                status: document.getElementById('formGroupStatus').value
            };

            if (groupId) {
                await supabase.from('groups').update(payload).eq('id', groupId);
            } else {
                await supabase.from('groups').insert([payload]);
            }
            
            modal.style.display = 'none';
            if(btnSave) btnSave.disabled = false;
            fetchGroups(); 
        });
    }
}

window.openEditGroupModal = function(id) {
    const group = groupsData.find(g => g.id === id);
    if (!group) return;

    document.getElementById('groupModalTitle').textContent = "Edit Group";
    document.getElementById('formGroupId').value = group.id;
    document.getElementById('formGroupName').value = group.group_name || '';
    document.getElementById('formGroupDesc').value = group.description || '';
    document.getElementById('formGroupManager').value = group.manager_id || '';
    document.getElementById('formGroupStatus').value = group.status || 'Active';

    document.getElementById('groupModal').style.display = 'flex';
};

function populateGroupDropdowns() {
    const select = document.getElementById('formGroup');
    if(!select) return;
    select.innerHTML = '<option value="">- No Group -</option>';
    groupsData.forEach(g => {
        select.innerHTML += `<option value="${g.id}">${g.group_name}</option>`;
    });
}

function populateManagerDropdown() {
    const select = document.getElementById('formGroupManager');
    if(!select) return;
    select.innerHTML = '<option value="">- Select Manager -</option>';
    const eligibleManagers = membersData.filter(m => ['Admin', 'Manager', 'Supervisor'].includes(m.system_role));
    eligibleManagers.forEach(m => {
        select.innerHTML += `<option value="${m.id}">${m.name} (${m.system_role})</option>`;
    });
}
