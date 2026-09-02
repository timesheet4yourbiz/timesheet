import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Panggil sidebar
    loadSidebar();

    // Semak Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../pages/login.html';
        });
    }

    const timesheetTableBody = document.getElementById('timesheetTableBody');
    const totalHoursDisplay = document.getElementById('totalHours');

    await loadTimesheetData(session.user.id);

    // Fungsi Tarik Data Timesheet
    async function loadTimesheetData(userId) {
        const { data, error } = await supabase
            .from('time_entries')
            .select('*, projects(project_name)')
            .eq('user_id', userId)
            .order('start_time', { ascending: false });

        if (error || !data || data.length === 0) {
            if (timesheetTableBody) {
                timesheetTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No entries found.</td></tr>';
            }
            return;
        }

        let totalSeconds = 0;

        if (timesheetTableBody) {
            timesheetTableBody.innerHTML = data.map(entry => {
                totalSeconds += entry.duration_seconds || 0;
                
                const dateObj = new Date(entry.start_time);
                const dateStr = dateObj.toLocaleDateString('en-GB'); // Format: DD/MM/YYYY
                const timeStr = formatDuration(entry.duration_seconds);

                return `
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <td style="padding: 0.8rem;">${dateStr}</td>
                        <td style="padding: 0.8rem; color: var(--text-muted);">${entry.projects ? entry.projects.project_name : '-'}</td>
                        <td style="padding: 0.8rem; font-weight: 500;">${entry.description || '-'}</td>
                        <td style="padding: 0.8rem; font-family: monospace;">${timeStr}</td>
                    </tr>
                `;
            }).join('');
        }

        // Kemas kini paparan jumlah masa
        if (totalHoursDisplay) {
            const totalHrs = Math.floor(totalSeconds / 3600);
            const totalMins = Math.floor((totalSeconds % 3600) / 60);
            totalHoursDisplay.textContent = `Total: ${totalHrs} hrs ${totalMins} mins`;
        }
    }

    // Format masa
    function formatDuration(seconds) {
        if (!seconds) return '00:00:00';
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }
});
