import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';
document.addEventListener('DOMContentLoaded', async () => {
loadSidebar(); 
    
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    // --- Tab Switching Logic ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Buang active dari semua butang dan kandungan
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Tambah active kepada butang yang ditekan dan papar kandungannya
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    // DOM Elements
    const membersList = document.getElementById('membersList');
    const groupsList = document.getElementById('groupsList');
    const newGroupName = document.getElementById('newGroupName');
    const addGroupBtn = document.getElementById('addGroupBtn');

    // Execution
    await loadMembers();
    await loadGroups();

    // -- MEMBERS LOGIC --
    async function loadMembers() {
        const { data, error } = await supabase.from('employees').select('*').order('full_name', { ascending: true });
        
        if (error || !data || data.length === 0) {
            membersList.innerHTML = '<tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: #64748b;">No members found.</td></tr>';
            return;
        }

        membersList.innerHTML = data.map(member => `
            <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                <td style="padding: 1rem 1.5rem; font-weight: 500; color: #334155;">${member.full_name || '-'}</td>
                <td style="padding: 1rem 1.5rem; color: #64748b;">${member.email || '-'}</td>
                <td style="padding: 1rem 1.5rem; color: #64748b;">- <a href="#" style="color: #03a9f4; text-decoration: none; font-size: 0.8rem; margin-left: 10px;">Change</a></td>
                <td style="padding: 1rem 1.5rem; color: #03a9f4; font-weight: 500;">Member</td>
                <td style="padding: 1rem 1.5rem;">
                    <span style="background: #f1f5f9; color: #475569; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase;">${member.department || 'NO GROUP'}</span>
                </td>
                <td style="padding: 1rem 1.5rem; text-align: right;">
                    <button style="background: none; border: none; cursor: pointer; color: #94a3b8;" title="More options">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // -- GROUPS LOGIC --
    // Nota: Anggap bos guna 'departments' sebagai table Groups buat sementara
    async function loadGroups() {
        const { data, error } = await supabase.from('departments').select('*').order('department_name', { ascending: true });
        
        if (error || !data || data.length === 0) {
            groupsList.innerHTML = '<tr><td colspan="3" style="padding: 1.5rem; text-align: center; color: #64748b;">No groups found.</td></tr>';
            return;
        }

        groupsList.innerHTML = data.map(group => `
            <tr style="border-bottom: 1px solid var(--border-color); background: white;">
                <td style="padding: 1rem 1.5rem; font-weight: 500; color: #334155; text-transform: uppercase;">${group.department_name}</td>
                <td style="padding: 1rem 1.5rem; color: #03a9f4; font-size: 0.85rem; font-weight: 500; cursor: pointer;">+ Access</td>
                <td style="padding: 1rem 1.5rem; display: flex; gap: 1rem; justify-content: flex-end;">
                    <button style="background: none; border: none; cursor: pointer; color: #94a3b8;" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon></svg>
                    </button>
                    <button style="background: none; border: none; cursor: pointer; color: #94a3b8;" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </td>
            </tr>
        `).join('');
    }
});
