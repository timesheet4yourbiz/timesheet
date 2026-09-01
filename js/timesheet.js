import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Auth & Init
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    let currentEmpId = null;
    let currentMonday = getMonday(new Date());
    let tasksList = [];
    let weekDates = [];

    const tbody = document.getElementById('timesheetBody');
    const saveBtn = document.getElementById('saveBtn');

    if (await initEmployee()) {
        await loadTasksDropdown();
        updateWeekUI();
    }

    // Navigasi Minggu (Read Only)
    document.getElementById('prevWeek').addEventListener('click', () => { currentMonday.setDate(currentMonday.getDate() - 7); updateWeekUI(); });
    document.getElementById('nextWeek').addEventListener('click', () => { currentMonday.setDate(currentMonday.getDate() + 7); updateWeekUI(); });
    document.getElementById('thisWeek').addEventListener('click', () => { currentMonday = getMonday(new Date()); updateWeekUI(); });

const copyLastWeekSelect = document.getElementById('copyLastWeekSelect');
    copyLastWeekSelect.addEventListener('change', async (e) => {
        const mode = e.target.value;
        if (!mode) return;
        await copyLastWeekTasks(mode);
        e.target.value = ''; // Reset semula dropdown selepas klik
    });

    saveBtn.addEventListener('click', saveTimesheet);

    // --- Helper Functions ---
    async function initEmployee() {
        const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).single();
        if (!data) return false;
        currentEmpId = data.id;
        return true;
    }

    function getMonday(d) {
        d = new Date(d);
        let day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        return new Date(d.setDate(diff));
    }

    async function loadTasksDropdown() {
        const { data } = await supabase.from('tasks').select('id, task_name, projects(project_name)');
        if (data) tasksList = data;
    }

    async function updateWeekUI() {
        weekDates = [];
        const daysHeader = document.getElementById('daysHeader').getElementsByTagName('th');
        const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        for (let i = 0; i < 7; i++) {
            let d = new Date(currentMonday);
            d.setDate(currentMonday.getDate() + i);
            let dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); // YYYY-MM-DD
            weekDates.push(dateStr);
            
            let displayDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            daysHeader[i + 1].innerHTML = `${shortDays[i]}<br><small>${displayDate}</small>`;
        }
        
        document.getElementById('weekLabel').textContent = `${weekDates[0]} to ${weekDates[6]}`;
        await loadTimesheetData();
    }

    async function loadTimesheetData() {
        tbody.innerHTML = '<tr><td colspan="9">Loading...</td></tr>';
        
        const { data, error } = await supabase
            .from('time_entries')
            .select('*')
            .eq('employee_id', currentEmpId)
            .eq('entry_source', 'TIMESHEET')
            .gte('work_date', weekDates[0])
            .lte('work_date', weekDates[6]);

        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            addEmptyRow();
            calculateTotals();
            return;
        }

        // Group data by task_id
        const grouped = {};
        data.forEach(entry => {
            if (!grouped[entry.task_id]) grouped[entry.task_id] = {};
            grouped[entry.task_id][entry.work_date] = formatMinutes(entry.total_minutes);
        });

        for (const taskId in grouped) {
            renderRow(taskId, grouped[taskId]);
        }
        calculateTotals();
    }

    function addEmptyRow() {
        renderRow('', {});
    }

    function renderRow(taskId, daysData) {
        const tr = document.createElement('tr');
        
        let selectHTML = `<select class="task-select" style="width:100%; padding:0.5rem;">
            <option value="">-- Select Task --</option>
            ${tasksList.map(t => `<option value="${t.id}" ${t.id === taskId ? 'selected' : ''}>${t.projects.project_name} - ${t.task_name}</option>`).join('')}
        </select>`;

        let cells = `<td class="col-task">${selectHTML}</td>`;
        
        for (let i = 0; i < 7; i++) {
            let val = daysData[weekDates[i]] || '';
            cells += `<td><input type="text" class="time-input day-input" data-day="${i}" value="${val}" placeholder="00:00"></td>`;
        }
        
        cells += `<td class="total-cell row-total">00:00</td>`;
        tr.innerHTML = cells;
        
        tr.querySelectorAll('.day-input').forEach(input => {
            input.addEventListener('change', (e) => {
                e.target.value = parseInput(e.target.value);
                calculateTotals();
            });
        });
        
        tbody.appendChild(tr);
    }

    function parseInput(val) {
        if (!val) return '';
        let num = parseFloat(val);
        if (!isNaN(num) && !val.includes(':')) {
            let hrs = Math.floor(num);
            let mins = Math.round((num - hrs) * 60);
            return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        }
        return val;
    }

    function timeToMinutes(timeStr) {
        if (!timeStr || !timeStr.includes(':')) return 0;
        let [h, m] = timeStr.split(':');
        return (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
    }

    function formatMinutes(totalMins) {
        if (totalMins === 0) return '';
        let h = Math.floor(totalMins / 60);
        let m = totalMins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function calculateTotals() {
        let dailyTotals = [0, 0, 0, 0, 0, 0, 0];
        let weekTotal = 0;

        document.querySelectorAll('#timesheetBody tr').forEach(row => {
            let rowTotal = 0;
            row.querySelectorAll('.day-input').forEach((input, index) => {
                let mins = timeToMinutes(input.value);
                rowTotal += mins;
                dailyTotals[index] += mins;
            });
            row.querySelector('.row-total').textContent = formatMinutes(rowTotal) || '00:00';
            weekTotal += rowTotal;
        });

        for (let i = 0; i < 7; i++) {
            document.getElementById(`tot-${i}`).textContent = formatMinutes(dailyTotals[i]) || '00:00';
        }
        document.getElementById('tot-week').textContent = formatMinutes(weekTotal) || '00:00';
    }

    async function saveTimesheet() {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        
        let entriesToUpsert = [];

        document.querySelectorAll('#timesheetBody tr').forEach(row => {
            let taskId = row.querySelector('.task-select').value;
            if (!taskId) return; // Skip baris tanpa task
            
            row.querySelectorAll('.day-input').forEach((input, index) => {
                let mins = timeToMinutes(input.value);
                if (mins > 0) {
                    entriesToUpsert.push({
                        employee_id: currentEmpId,
                        task_id: taskId,
                        work_date: weekDates[index],
                        total_minutes: mins,
                        total_seconds: mins * 60,
                        entry_source: 'TIMESHEET',
                        status: 'STOPPED',
                        is_manual: true
                    });
                }
            });
        });

        if (entriesToUpsert.length > 0) {
            // Gunakan UPSERT untuk patuh kepada RULE 17 (Tiada Duplicate)
            const { error } = await supabase.from('time_entries').upsert(entriesToUpsert, { 
                onConflict: 'employee_id, task_id, work_date, entry_source' 
            });

            if (error) alert("Error saving timesheet: " + error.message);
        }
        
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Timesheet';
        await loadTimesheetData();
    }


async function copyLastWeekTasks(mode) {
        // 1. Dapatkan tarikh Isnin dan Ahad minggu lepas
        const lastWeekMonday = new Date(currentMonday);
        lastWeekMonday.setDate(currentMonday.getDate() - 7);
        const lastWeekSunday = new Date(lastWeekMonday);
        lastWeekSunday.setDate(lastWeekMonday.getDate() + 6);

        const startDate = lastWeekMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
        const endDate = lastWeekSunday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });

        // 2. Tarik data timesheet minggu lepas (termasuk total_minutes dan work_date)
        const { data, error } = await supabase
            .from('time_entries')
            .select('task_id, work_date, total_minutes')
            .eq('employee_id', currentEmpId)
            .eq('entry_source', 'TIMESHEET')
            .gte('work_date', startDate)
            .lte('work_date', endDate);

        if (error) {
            alert("Ralat menyalin task: " + error.message);
            return;
        } 

        if (data && data.length > 0) {
            const currentSelects = Array.from(document.querySelectorAll('.task-select')).map(select => select.value);
            
            // Susun data mengikut task_id
            const taskDataMap = {};
            data.forEach(entry => {
                if (!taskDataMap[entry.task_id]) {
                    taskDataMap[entry.task_id] = {};
                }
                
                // Jika user pilih "Copy activities and time", kita salin masa sekali
                if (mode === 'task_time') {
                    // Cari indeks hari (0 = Isnin, 6 = Ahad)
                    const entryDate = new Date(entry.work_date);
                    let dayIndex = entryDate.getDay() - 1; 
                    if (dayIndex === -1) dayIndex = 6; 
                    
                    // Tukar minit ke format HH:MM
                    const h = Math.floor(entry.total_minutes / 60);
                    const m = entry.total_minutes % 60;
                    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    
                    // Padankan dengan tarikh minggu SEMASA
                    const thisWeekDateKey = weekDates[dayIndex];
                    taskDataMap[entry.task_id][thisWeekDateKey] = timeStr;
                }
            });

            // 3. Masukkan baris ke dalam jadual
            let addedCount = 0;
            for (const taskId in taskDataMap) {
                if (!currentSelects.includes(taskId)) {
                    renderRow(taskId, taskDataMap[taskId]);
                    addedCount++;
                }
            }

            if (addedCount === 0) {
                alert("Semua task dari minggu lepas sudah ada di skrin minggu ini.");
            } else {
                calculateTotals(); // Kira semula jumlah keseluruhan jika ada masa disalin
            }
        } else {
            alert("Tiada rekod task dijumpai pada minggu lepas.");
        }
    }

    
});
