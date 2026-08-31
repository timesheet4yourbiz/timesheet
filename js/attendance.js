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
    let todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
    let attendanceId = null; // ID rekod hari ini

    const liveTimeEl = document.getElementById('liveTime');
    const liveDateEl = document.getElementById('liveDate');
    const clockInBtn = document.getElementById('clockInBtn');
    const clockOutBtn = document.getElementById('clockOutBtn');
    const todayStatusEl = document.getElementById('todayStatus');

    // Live Clock
    setInterval(() => {
        const now = new Date();
        liveTimeEl.textContent = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour12: false });
        liveDateEl.textContent = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }, 1000);

    // Init Data
    if (await initEmployee()) {
        await checkTodayAttendance();
        await loadHistory();
    }

    // Action: Clock In
    clockInBtn.addEventListener('click', async () => {
        clockInBtn.disabled = true;
        const nowIso = new Date().toISOString();

        const { error } = await supabase.from('attendance').insert([{
            employee_id: currentEmpId,
            work_date: todayDateStr,
            clock_in: nowIso,
            status: 'PRESENT'
        }]);

        if (error) {
            alert("Clock In Failed: " + error.message);
            clockInBtn.disabled = false;
        } else {
            await checkTodayAttendance();
            await loadHistory();
        }
    });

    // Action: Clock Out
    clockOutBtn.addEventListener('click', async () => {
        clockOutBtn.disabled = true;
        const nowIso = new Date().toISOString();
        
        // Fetch current record to calculate duration
        const { data: record } = await supabase.from('attendance').select('clock_in, break_minutes').eq('id', attendanceId).single();
        
        let workedMins = 0;
        if (record && record.clock_in) {
            const start = new Date(record.clock_in).getTime();
            const end = new Date(nowIso).getTime();
            workedMins = Math.floor((end - start) / 60000) - record.break_minutes;
        }

        const { error } = await supabase.from('attendance').update({
            clock_out: nowIso,
            worked_minutes: workedMins
        }).eq('id', attendanceId);

        if (error) {
            alert("Clock Out Failed: " + error.message);
            clockOutBtn.disabled = false;
        } else {
            await checkTodayAttendance();
            await loadHistory();
        }
    });

    async function initEmployee() {
        const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).single();
        if (!data) return false;
        currentEmpId = data.id;
        return true;
    }

    async function checkTodayAttendance() {
        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', currentEmpId)
            .eq('work_date', todayDateStr)
            .single();

        // Reset Buttons
        clockInBtn.disabled = true;
        clockOutBtn.disabled = true;

        if (!data) {
            todayStatusEl.textContent = "Status: Not Clocked In";
            todayStatusEl.style.background = "#fef08a"; // Yellow
            clockInBtn.disabled = false;
        } else {
            attendanceId = data.id;
            if (!data.clock_out) {
                todayStatusEl.textContent = "Status: CLOCKED IN";
                todayStatusEl.style.background = "#dcfce7"; // Green
                clockOutBtn.disabled = false;
            } else {
                todayStatusEl.textContent = "Status: CLOCKED OUT";
                todayStatusEl.style.background = "#e5e7eb"; // Grey
            }
        }
    }

    async function loadHistory() {
        const tbody = document.getElementById('attendanceHistory');
        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', currentEmpId)
            .order('work_date', { ascending: false })
            .limit(10);

        if (error || !data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No attendance records found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(att => {
            const date = new Date(att.work_date).toLocaleDateString('en-GB');
            const inTime = att.clock_in ? new Date(att.clock_in).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '-';
            const outTime = att.clock_out ? new Date(att.clock_out).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '-';
            
            const h = Math.floor(att.worked_minutes / 60);
            const m = att.worked_minutes % 60;
            const workedTimeStr = att.worked_minutes > 0 ? `${h}h ${m}m` : '-';

            return `
                <tr>
                    <td><strong>${date}</strong></td>
                    <td>${inTime}</td>
                    <td>${outTime}</td>
                    <td>${workedTimeStr}</td>
                    <td>${att.status}</td>
                </tr>
            `;
        }).join('');
    }
});
