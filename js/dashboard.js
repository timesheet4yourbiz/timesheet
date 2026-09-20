import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '../pages/login.html';
            return;
        }

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        // Panggil fungsi untuk muatkan data sebenar
        await loadDashboardData(session.user.email);

    } catch (error) {
        console.error("Ralat memuatkan Dashboard:", error);
    }
});

async function loadDashboardData(userEmail) {
    // 1. Dapatkan Profil ID Pekerja yang sedang Log Masuk
    const { data: empData } = await supabase.from('employees').select('id').eq('email', userEmail).maybeSingle();
    const empId = empData ? empData.id : null;

    // 2. Kira Jumlah Pekerja (Total Employees)
    const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });
    const elEmp = document.getElementById('countEmployees');
    if (elEmp) elEmp.textContent = empCount || 0;

    // 3. Kira Projek Aktif (Active Projects)
    const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    const elProj = document.getElementById('countProjects');
    if (elProj) elProj.textContent = projCount || 0;

    // 4. Kira Jam Kerja Hari Ini (My Hours)
    if (empId) {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

        const { data: timeEntries } = await supabase
            .from('time_entries')
            .select('duration_seconds')
            .eq('employee_id', empId)
            .eq('status', 'STOPPED')
            .gte('start_time', startOfDay)
            .lte('start_time', endOfDay);

        let totalSec = 0;
        if (timeEntries) {
            timeEntries.forEach(t => totalSec += (t.duration_seconds || 0));
        }

        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const formattedTime = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

        const elHours = document.getElementById('countMyHours');
        if (elHours) elHours.textContent = formattedTime;
    }

    // 5. Pending Approvals (Sistem ini belum wujud, jadi kita letak 0 dahulu)
    const elAppr = document.getElementById('countApprovals');
    if (elAppr) elAppr.textContent = '0';
}
