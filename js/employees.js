import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let membersData = [];
let groupsData = [];

// Tambah pembolehubah global untuk simpan jawatan pengguna semasa
window.currentUserRole = 'Employee'; 

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        // KAWALAN KESELAMATAN: Semak jawatan (role) pengguna yang sedang log masuk
        const { data: profile } = await supabase
            .from('employees')
            .select('system_role')
            .eq('id', session.user.id)
            .single();

        if (profile) {
            window.currentUserRole = profile.system_role;
        }

        // Jika BUKAN Admin, sorokkan butang "+ ADD"
        if (window.currentUserRole !== 'Admin') {
            const btnAddMember = document.getElementById('btnAddMember');
            const btnAddGroup = document.getElementById('btnAddGroup');
            if (btnAddMember) btnAddMember.style.display = 'none';
            if (btnAddGroup) btnAddGroup.style.display = 'none';
        }

        setupNavigation();
        bindFilters();
        
        // Hanya Admin boleh guna Modal Add/Edit
        if (window.currentUserRole === 'Admin') {
            setupMemberModal();
            setupGroupModal();
        }
        
        await fetchMembers(); 
        await fetchGroups();

    } catch (error) {
        console.error("Team Module Init Error:", error);
    }
});
// --- TAB NAVIGATION LOGIC ---
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            e.target.classList.add('active');
            
            document.getElementById('membersView').style.display = 'none';
            document.getElementById('groupsView').style.display = 'none';
            document.getElementById('remindersView').style.display = 'none';
            
            const tab = e.target.getAttribute('data-tab');
            document.getElementById(tab + 'View').style.display = 'block';
        });
    });
}

// ==========================================
// MEMBERS MODULE LOGIC
// ==========================================
function bindFilters() {
    const searchInput = document.getElementById('searchMember');
    const roleSelect = document.getElementById('filterRole');
    const statusSelect = document.getElementById('filterStatus');

    const filterMembers = () => {
        const term = searchInput.value.toLowerCase();
        const role = roleSelect.value;
        const status = statusSelect.value;

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

    const searchGroup = document.getElementById('searchGroup');
    if(searchGroup) {
        searchGroup.addEventListener('keyup', () => {
            const term = searchGroup.value.toLowerCase();
            const filtered = groupsData.filter(g => (g.group_name || '').toLowerCase().includes(term));
            renderGroupsTable(filtered);
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



document.addEventListener('DOMContentLoaded', () => {
    const btnImport = document.getElementById('btnImportExcel');
    const fileInput = document.getElementById('excelFileInput');

    if (btnImport && fileInput) {
        // Apabila butang ditekan, buka tetingkap pilih fail
        btnImport.addEventListener('click', () => fileInput.click());

        // Apabila fail Excel dipilih
        fileInput.addEventListener('change', handleExcelUpload);
    }
});

async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            // 1. Baca fail Excel
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // 2. Ambil data dari sheet pertama
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 3. Tukar data Excel kepada format JSON
            const excelData = XLSX.utils.sheet_to_json(worksheet);
            
            if (excelData.length === 0) {
                alert("Fail Excel kosong!");
                return;
            }

            alert(`Berjaya membaca ${excelData.length} baris data. Sedang mendaftar pekerja...`);

            // 4. Daftarkan akun pekerja dan simpan data ke Supabase
            for (const row of excelData) {
                // Fungsi pembantu untuk cari lajur tanpa hirau huruf besar/kecil
                const getVal = (...keys) => {
                    const match = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
                    return match ? row[match] : null;
                };

                const email = getVal('email', 'e-mail', 'emel');
                const name = getVal('name', 'nama', 'full name', 'nama penuh') || 'Unknown Name';
                const department = getVal('department', 'jabatan', 'dept');
                const position = getVal('position', 'jawatan', 'post');
                const role = getVal('role', 'system_role', 'peranan') || 'user';
                const tempPassword = getVal('password', 'kata laluan') || 'Cranetrack2026';

                if (!email) continue;

                // A. Daftarkan e-mel dan password ke Supabase Auth
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: email,
                    password: tempPassword
                });

                if (authError) {
                    console.error(`Gagal mendaftar ${email}:`, authError.message);
                    continue; 
                }

                // B. Simpan profil lengkap ke pangkalan data 'employees'
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

function renderMembersTable(data) {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No team members found.</td></tr>';
        if (typeof updatePagination === 'function') updatePagination(0);
        return;
    }

    tbody.innerHTML = '';

    // 1. Potong data mengikut muka surat semasa (10 orang per halaman)
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedData = data.slice(startIndex, startIndex + rowsPerPage);

    // 2. Paparkan 10 orang sahaja untuk muka surat ini
    paginatedData.forEach(member => {
        const displayName = member.name || 'Unknown Name';
        const init = displayName.substring(0, 2).toUpperCase();
        const empNo = member.employee_no ? ` | ID: ${member.employee_no}` : '';
        const statusClass = (member.status || '').toUpperCase() === 'ACTIVE' ? 'status-active' : 'status-inactive';
        const rate = member.billable_rate ? parseFloat(member.billable_rate).toFixed(2) : '0.00';
        const group = member.group_name || '-';

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
                <td>${group}</td>
                <td>${rate}</td>
                <td><span class="status-badge ${statusClass}">${member.status || 'ACTIVE'}</span></td>
                <td style="text-align: center; white-space: nowrap;">
                    <div style="display: flex; justify-content: center; align-items: center; gap: 8px;">
                        <button class="action-btn" onclick="editMember('${member.id}')" title="Edit Member" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:2px 4px;">✏️</button>
                        <button class="action-btn" onclick="deleteMember('${member.id}')" title="Delete Member" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:2px 4px;">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    });

    // 3. Kemas kini nombor pada Bar Pagination
    if (typeof updatePagination === 'function') {
        updatePagination(data.length);
    }
}

function setupMemberModal() {
    const modal = document.getElementById('memberModal');
    const btnClose = document.getElementById('btnCloseModal');
    const btnAdd = document.getElementById('btnAddMember');
    const form = document.getElementById('memberForm');

    btnClose.addEventListener('click', () => modal.style.display = 'none');
    
    btnAdd.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = "Add New Member";
        document.getElementById('formMemberId').value = ''; 
        document.getElementById('formEmail').value = '';
        document.getElementById('formEmail').disabled = false; 
        document.getElementById('formName').value = '';
        form.reset(); 
        document.getElementById('formRole').value = 'Employee';
        document.getElementById('formRate').value = '0.00';
        document.getElementById('formStatus').value = 'Active';
        modal.style.display = 'flex';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSave = document.getElementById('btnSaveMember');
        btnSave.disabled = true;

        const empId = document.getElementById('formMemberId').value;
        const emailInput = document.getElementById('formEmail').value;
        const payload = {
            name: document.getElementById('formName').value,
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
            // UPDATE: Rekod Sedia Ada
            await supabase.from('employees').update(payload).eq('id', empId);
            modal.style.display = 'none';
            fetchMembers(); 
        } else {
            // INSERT: Jemput Ahli Baru & Arahkan ke Set Password
            btnSave.textContent = "Sending Invite...";

            // Cipta password rawak (kita rahsiakan dari semua orang)
            const tempPassword = "Pwd" + Math.floor(Math.random() * 10000000) + "A!";
            
            const { data: authData, error: authError } = await supabase.auth.signUp({ 
                email: emailInput, 
                password: tempPassword,
                options: {
                    // Ini kunci utama! Arahkan ke page Set Password selepas klik link
                    emailRedirectTo: 'https://timesheet4yourbiz.github.io/timesheet/pages/set-password.html'
                }
            });
            
            if (authError) {
                alert("Failed: " + authError.message);
            } else if (authData.user) {
                payload.id = authData.user.id;
                payload.email = emailInput;
                await supabase.from('employees').upsert([payload]);
                
                // Mesej baharu yang lebih profesional
                alert(`Success! An invitation email has been sent to ${emailInput}.\n\nWhen they click the link in the email, they will be asked to create their own password.`);
                modal.style.display = 'none';
                fetchMembers(); 
            }
        }
        btnSave.textContent = "Save Member";
        btnSave.disabled = false;
    });
}

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


// ==========================================
// GROUPS MODULE LOGIC
// ==========================================
async function fetchGroups() {
    const tbody = document.getElementById('groupsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-overlay">Loading groups...</td></tr>';

    const { data, error } = await supabase
        .from('groups')
        .select(`id, group_name, description, manager_id, status`)
        .order('group_name');

    if (!error) {
        groupsData = data || [];
        populateGroupDropdowns(); 
        renderGroupsTable(groupsData);
    }
}

function renderGroupsTable(data) {
    const tbody = document.getElementById('groupsTableBody');
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
    const btnClose = document.getElementById('btnCloseGroupModal');
    const btnAdd = document.getElementById('btnAddGroup');
    const form = document.getElementById('groupForm');

    btnClose.addEventListener('click', () => modal.style.display = 'none');
    
    btnAdd.addEventListener('click', () => {
        document.getElementById('groupModalTitle').textContent = "Create New Group";
        document.getElementById('formGroupId').value = ''; 
        document.getElementById('formGroupName').value = '';
        document.getElementById('formGroupDesc').value = '';
        document.getElementById('formGroupManager').value = '';
        document.getElementById('formGroupStatus').value = 'Active';
        modal.style.display = 'flex';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSave = document.getElementById('btnSaveGroup');
        btnSave.disabled = true;

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
        btnSave.disabled = false;
        fetchGroups(); 
    });
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

// ==================== PASTE DI BAHAGIAN BAWAH FAIL ====================

// Dedahkan fungsi edit ke window supaya butang onclick boleh buka Modal
window.editMember = function(id) {
    // Cari data pekerja dari senarai membersData
    const member = membersData ? membersData.find(m => m.id === id) : null;
    if (!member) {
        alert("Data pekerja tidak dijumpai.");
        return;
    }

    // Isi maklumat pekerja ke dalam borang modal
    document.getElementById('modalTitle').innerText = 'Edit Member Profile';
    document.getElementById('formMemberId').value = member.id;
    document.getElementById('formEmail').value = member.email || '';
    document.getElementById('formName').value = member.name || '';
    document.getElementById('formEmpNo').value = member.employee_no || '';
    document.getElementById('formPhone').value = member.phone || '';
    document.getElementById('formDept').value = member.department || '';
    document.getElementById('formPosition').value = member.position || '';
    document.getElementById('formRole').value = member.system_role || 'Employee';
    document.getElementById('formGroup').value = member.group_id || '';
    document.getElementById('formRate').value = member.billable_rate || 0;
    document.getElementById('formStatus').value = member.status || 'Active';

    // Buka paparan modal
    document.getElementById('memberModal').style.display = 'flex';
};

// Dedahkan fungsi padam ke window supaya butang onclick boleh padam rekod
window.deleteMember = async function(id) {
    if (!confirm('Adakah anda pasti mahu memadam pekerja ini?')) return;

    try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;

        alert('Pekerja berjaya dipadam!');
        window.location.reload();
    } catch (err) {
        console.error('Ralat padam:', err);
        alert('Gagal memadam pekerja: ' + err.message);
    }
};

// ==================== Arahkan Borang Simpan Data ke Supabase ====================
const memberForm = document.getElementById('memberForm');
if (memberForm) {
    memberForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Elak halaman refresh secara melulu

        const id = document.getElementById('formMemberId').value;
        const updatedData = {
            name: document.getElementById('formName').value,
            email: document.getElementById('formEmail').value,
            department: document.getElementById('formDept').value,
            position: document.getElementById('formPosition').value,
            system_role: document.getElementById('formRole').value,
            status: document.getElementById('formStatus').value.toUpperCase(), // Pastikan 'ACTIVE' berhuruf besar
            billable_rate: parseFloat(document.getElementById('formRate').value) || 0
        };

        try {
            let error;
            if (id) {
                // Kemas kini (UPDATE) pekerja sedia ada
                const res = await supabase.from('employees').update(updatedData).eq('id', id);
                error = res.error;
            } else {
                // Masukkan (INSERT) jika pekerja baharu
                const res = await supabase.from('employees').insert([updatedData]);
                error = res.error;
            }

            if (error) throw error;

            alert('Data berjaya disimpan!');
            document.getElementById('memberModal').style.display = 'none';
            window.location.reload(); // Muat semula halaman untuk paparkan status ACTIVE hijau
        } catch (err) {
            console.error('Ralat simpan:', err);
            alert('Gagal menyimpan data: ' + err.message);
        }
    });
}

// Tutup Modal bila tekan butang 'X'
const btnCloseModal = document.getElementById('btnCloseModal');
if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
        document.getElementById('memberModal').style.display = 'none';
    });
}


// ==================== LOGIK PAGINATION ====================
let currentPage = 1;
const rowsPerPage = 20;

window.updatePagination = function(totalItems) {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalItems);

    const infoElem = document.getElementById('paginationInfo');
    const pageElem = document.getElementById('pageNumbers');
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');

    if (infoElem) infoElem.innerText = `Showing ${startItem}-${endItem} of ${totalItems} members`;
    if (pageElem) pageElem.innerText = `Page ${currentPage} of ${totalPages}`;

    if (btnPrev) {
        btnPrev.disabled = currentPage === 1;
        btnPrev.style.opacity = currentPage === 1 ? '0.5' : '1';
        btnPrev.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
    }

    if (btnNext) {
        btnNext.disabled = currentPage >= totalPages;
        btnNext.style.opacity = currentPage >= totalPages ? '0.5' : '1';
        btnNext.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
};

// Acara Butang Previous & Next
document.getElementById('btnPrevPage')?.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        if (typeof renderMembersTable === 'function') renderMembersTable(membersData);
    }
});

document.getElementById('btnNextPage')?.addEventListener('click', () => {
    const totalPages = Math.ceil((membersData?.length || 0) / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        if (typeof renderMembersTable === 'function') renderMembersTable(membersData);
    }
});
