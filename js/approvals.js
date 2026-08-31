import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    let currentEmpId = null;
    let selectedApprovalId = null;

    const weekSelect = document.getElementById('weekSelect');
    const submitWeekBtn = document.getElementById('submitWeekBtn');
    const approvalList = document.getElementById('approvalList');
    
    // Modal Elements
    const rejectModal = document.getElementById('rejectModal');
    const rejectReason = document.getElementById('rejectReason');
    const confirmRejectBtn = document.getElementById('confirmRejectBtn');
    const cancelRejectBtn = document.getElementById('cancelRejectBtn');

    // Init
    if (await initEmployee()) {
        weekSelect.value = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
        await loadApprovals();
    }

    // Submit Week Action
    submitWeekBtn.addEventListener('click', async () => {
        if (!weekSelect.value) return alert("Please select a date.");
        
        submitWeekBtn.disabled = true;
        const monday = getMonday(weekSelect.value);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        const weekStartStr = monday.toLocaleDateString('en-CA');
        const weekEndStr = sunday.toLocaleDateString('en-CA');
        const nowIso = new Date().toISOString();

        // Upsert approval record
        const { error } = await supabase.from('timesheet_approvals').upsert({
            employee_id: currentEmpId,
            week_start: weekStartStr,
            week_end: weekEndStr,
            status: 'SUBMITTED',
            submitted_at: nowIso
        }, { onConflict: 'employee_id, week_start' });

        if (error) {
            alert("Error submitting timesheet: " + error.message);
        } else {
            alert("Timesheet submitted successfully!");
            await loadApprovals();
        }
        submitWeekBtn.disabled = false;
    });

    // Helper Functions
    async function initEmployee() {
        const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).single();
        if (!data) return false;
        currentEmpId = data.id;
        return true;
    }

    function getMonday(dateString) {
        let d = new Date(dateString);
        let day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        return new Date(d.setDate(diff));
    }

    async function loadApprovals() {
        const { data, error } = await supabase
            .from('timesheet_approvals')
            .select(`*, employees(full_name)`)
            .order('week_start', { ascending: false });

        if (error || !data || data.length === 0) {
            approvalList.innerHTML = '<tr><td colspan="5">No submissions found.</td></tr>';
            return;
        }

        approvalList.innerHTML = data.map(app => {
            let actionButtons = '';
            // Tunjuk butang Approve/Reject jika status SUBMITTED
            if (app.status === 'SUBMITTED') {
                actionButtons = `
                    <button class="btn-sm btn-approve" data-id="${app.id}">Approve</button>
                    <button class="btn-sm btn-reject action-reject" data-id="${app.id}">Reject</button>
                `;
            }

            return `
                <tr>
                    <td><strong>${app.employees?.full_name || 'Unknown'}</strong></td>
                    <td>${app.week_start}</td>
                    <td><span class="badge status-${app.status}">${app.status}</span></td>
                    <td>${new Date(app.submitted_at).toLocaleDateString()}</td>
                    <td style="display: flex; gap: 0.5rem;">${actionButtons}</td>
                </tr>
            `;
        }).join('');

        attachActionListeners();
    }

    function attachActionListeners() {
        // Approve
        document.querySelectorAll('.btn-approve').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                e.target.disabled = true;
                e.target.textContent = '...';
                
                const { error } = await supabase.from('timesheet_approvals')
                    .update({ status: 'APPROVED', approved_by: currentEmpId, approved_at: new Date().toISOString() })
                    .eq('id', id);
                    
                if (error) alert("Error approving: " + error.message);
                await loadApprovals();
            });
        });

        // Open Reject Modal
        document.querySelectorAll('.action-reject').forEach(btn => {
            btn.addEventListener('click', (e) => {
                selectedApprovalId = e.target.getAttribute('data-id');
                rejectReason.value = '';
                rejectModal.style.display = 'flex';
            });
        });
    }

    // Reject Flow
    cancelRejectBtn.addEventListener('click', () => rejectModal.style.display = 'none');

    confirmRejectBtn.addEventListener('click', async () => {
        const reason = rejectReason.value.trim();
        if (!reason) return alert("Rejection reason is required!");

        confirmRejectBtn.disabled = true;
        
        const { error } = await supabase.from('timesheet_approvals')
            .update({ status: 'REJECTED', rejection_reason: reason })
            .eq('id', selectedApprovalId);

        if (error) {
            alert("Error rejecting: " + error.message);
        } else {
            rejectModal.style.display = 'none';
            await loadApprovals();
        }
        
        confirmRejectBtn.disabled = false;
    });
});
