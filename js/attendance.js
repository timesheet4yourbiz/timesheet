import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    
    const clockBtn = document.getElementById('clockBtn');
    const attendanceTableBody = document.getElementById('attendanceTableBody');
    const currentClock = document.getElementById('currentClock');
    const currentDate = document.getElementById('currentDate');
    
    let todayRecordId = null;
    let clockState = 'LOADING'; // LOADING, IN, OUT, DONE

    // Jam Digital Automatik
    setInterval(() => {
        const now = new Date();
        currentClock.textContent = now.toLocaleTimeString('en-GB');
        currentDate.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }, 1000);

    await checkTodayStatus();
    await loadAttendanceHistory();

    // Fungsi Butang Clock In / Out
    clockBtn.addEventListener('click', async () => {
        clockBtn.disabled = true;
        const now = new Date().toISOString();
        const today = new Date().toISOString().split('T')[0];

        if (clockState === 'IN') {
            // Proses Clock In
            await supabase.from('attendance').insert([{ 
                user_id: session.user.id, 
                date: today, 
                clock_in: now 
            }]);
        } else if (clockState === 'OUT' && todayRecordId) {
            // Proses Clock Out
            await supabase.from('attendance').update({ clock_out: now }).eq('id', todayRecordId);
        }

        await checkTodayStatus();
        await loadAttendanceHistory();
        clockBtn.disabled = false;
    });

    // Semak Status Hari Ini
    async function checkTodayStatus() {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('attendance')
            .select('*').eq('user_id', session.user.id).eq('date', today).single();

        if (!data) {
            clockState = 'IN';
            clockBtn.textContent = 'CLOCK IN';
            clockBtn.style.background = 'var(--primary-color)';
        } else if (data && !data.clock_out) {
            clockState = 'OUT';
            todayRecordId = data.id;
            clockBtn.textContent = 'CLOCK OUT';
            clockBtn.style.background = '#ef4444'; // Merah
        } else {
            clockState = 'DONE';
            clockBtn.textContent = 'ATTENDANCE COMPLETED';
            clockBtn.style.background = '#10b981'; // Hijau
            clockBtn.disabled = true;
        }
    }

    // Tarik Sejarah Kehadiran
    async function loadAttendanceHistory() {
        const { data } = await supabase.from('attendance')
            .select('*').eq('user_id', session.user.id).order('date', { ascending: false });

        if (!data || data.length === 0) {
            attendanceTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem;">No attendance records found.</td></tr>';
            return;
        }

        attendanceTableBody.innerHTML = data.map(record => {
            const timeIn = record.clock_in ? new Date(record.clock_in).toLocaleTimeString('en-GB') : '-';
            const timeOut = record.clock_out ? new Date(record.clock_out).toLocaleTimeString('en-GB') : '-';
            const statusBadge = record.status === 'APPROVED' 
                ? '<span style="color:#10b981; font-weight:bold;">APPROVED</span>' 
                : '<span style="color:#d97706; font-weight:bold;">PENDING</span>';

            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.8rem; font-weight: 500;">${record.date}</td>
                    <td style="padding: 0.8rem;">${timeIn}</td>
                    <td style="padding: 0.8rem;">${timeOut}</td>
                    <td style="padding: 0.8rem;">${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }
});
