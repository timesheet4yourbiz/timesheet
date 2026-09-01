import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    const auditList = document.getElementById('auditList');

    // Load Audit Data
    await loadAuditLogs();

    async function loadAuditLogs() {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            auditList.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error loading logs: ${error.message}</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            auditList.innerHTML = '<tr><td colspan="5" style="text-align:center;">No audit logs found.</td></tr>';
            return;
        }

        auditList.innerHTML = data.map(log => {
            const dateStr = new Date(log.created_at).toLocaleString('en-GB');
            const actionClass = log.action ? `action-${log.action.toUpperCase()}` : '';
            const userId = log.user_id ? log.user_id.substring(0, 8) + '...' : 'System';
            
            return `
                <tr>
                    <td>${dateStr}</td>
                    <td title="${log.user_id}">${userId}</td>
                    <td><span class="badge-action ${actionClass}">${log.action}</span></td>
                    <td><strong>${log.table_name}</strong></td>
                    <td style="font-family: monospace;">${log.record_id || '-'}</td>
                </tr>
            `;
        }).join('');
    }
});
