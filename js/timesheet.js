import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    loadSidebar();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

    let currentEmployeeId = null;
    let currentDate = new Date(); 

    await initEmployee();
    
    if (currentEmployeeId) {
        renderTimesheetHeader();
        await loadTimesheetData();
    } else {
        const tb = document.getElementById('timesheetTableBody');
        if(tb) tb.innerHTML = `<tr><td colspan="10" style="padding:20px; text-align:center; color:red;">Akaun e-mel anda (${session.user.email}) tiada dalam sistem Team.</td></tr>`;
    }

    document.getElementById('prevWeekBtn').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() - 7);
        renderTimesheetHeader();
        loadTimesheetData();
    });

    document.getElementById('nextWeekBtn').addEventListener('click', () => {
        currentDate.setDate(currentDate.getDate() + 7);
        renderTimesheetHeader();
        loadTimesheetData();
    });

    async function initEmployee() {
        const { data } = await supabase.from('employees').select('id').eq('email', session.user.email).maybeSingle();
        if (data) currentEmployeeId = data.id;
    }

    function renderTimesheetHeader() {
        const { start, end, days } = getWeekRange(currentDate);
        const dateRangeEl = document.getElementById('weekDateRange');
        if (dateRangeEl) {
            dateRangeEl.textContent = `${start.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${end.toLocaleDateString('en-US', {month:'short', day:'numeric'})}`;
        }

        const theadRow = document.getElementById('timesheetHeadRow');
        if (!theadRow) return;

        theadRow.style.background = '#edf2f7';
        theadRow.style.color = '#718096';
        theadRow.style.fontSize = '0.85rem';
        theadRow.style.borderBottom = '1px solid #e2e8f0';

        let thHtml = `<th style="padding: 12px 20px; text-align: left; font-weight: 500; width: 35%;">Projects</th>`;
        days.forEach(d => {
            const label = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
            thHtml += `<th style="padding: 12px 10px; font-weight: 500; text-align: center;">${label}</th>`;
        });
        thHtml += `<th style="padding: 12px 10px; font-weight: 500; text-align: center;">Total:</th>`;
        thHtml += `<th style="padding: 12px 15px; width: 40px;"></th>`;
        
        theadRow.innerHTML = thHtml;
    }

    function getWeekRange(dateObj) {
        const curr = new Date(dateObj);
        const day = curr.getDay(); 
        const diff = curr.getDate() - day + (day === 0 ? -6 : 1); 
        
        const start = new Date(curr.setDate(diff));
        start.setHours(0,0,0,0);
        
        const days = [];
        for (let i = 0; i < 7; i++) {
            const nextDay = new Date(start);
            nextDay.setDate(start.getDate() + i);
            days.push(nextDay);
        }
        
        const end = days[6];
        return { start, end, days };
    }

    async function loadTimesheetData() {
        const tBody = document.getElementById('timesheetTableBody');
        const tFoot = document.getElementById('timesheetFootRow');
        if (!tBody) return;

        tBody.innerHTML = '<tr><td colspan="10" style="padding:20px; text-align:center; color:#888;">Memuatkan data Timesheet...</td></tr>';

        const { start, end, days } = getWeekRange(currentDate);
        const startIso = start.toISOString().split('T')[0];
        
        const endFull = new Date(end);
        endFull.setHours(23, 59, 59, 999);
        const endIso = endFull.toISOString(); 

        const { data, error } = await supabase
            .from('time_entries')
            .select(`*, project:projects!fk_time_entries_project(project_name), task:tasks!fk_time_entries_task(task_name)`)
            .eq('employee_id', currentEmployeeId)
            .eq('status', 'STOPPED')
            .gte('start_time', startIso)
            .lte('start_time', endIso);

        if (error) {
            tBody.innerHTML = `<tr><td colspan="10" style="padding:20px; text-align:center; color:red;">Ralat: ${error.message}</td></tr>`;
            return;
        }

        const matrix = {};
        
        data.forEach(entry => {
            const pId = entry.project_id || 'no_project';
            const tId = entry.task_id || 'no_task';
            const key = `${pId}_${tId}`;
            
            const pName = entry.project ? entry.project.project_name : 'No Project';
            const tName = entry.task ? entry.task.task_name : '';
            const localDate = new Date(entry.start_time).toLocaleDateString('en-CA');

            if (!matrix[key]) {
                matrix[key] = { projectName: pName, taskName: tName, dailyData: {} };
                days.forEach(d => matrix[key].dailyData[d.toLocaleDateString('en-CA')] = 0);
            }
            
            if (matrix[key].dailyData[localDate] !== undefined) {
                matrix[key].dailyData[localDate] += (entry.duration_seconds || 0);
            }
        });

        let htmlContent = '';
        let dayTotals = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
        let grandTotal = 0;

        // Baris data sedia ada (Readonly dibuang supaya boleh diedit)
        for (const [key, rowData] of Object.entries(matrix)) {
            let rowTotal = 0;
            const displayTask = rowData.taskName && rowData.taskName !== 'No Task' ? `<span style="color:#a0aec0; margin-left: 5px;">- ${rowData.taskName}</span>` : '';
            
            htmlContent += `<tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                <td style="padding: 12px 20px; text-align: left; font-size: 0.9rem; color: #4a5568;">
                    <span style="display:inline-block; width:6px; height:6px; background:#8b5cf6; border-radius:50%; margin-right:8px;"></span>
                    ${rowData.projectName.toUpperCase()} ${displayTask}
                </td>`;
            
            days.forEach((d, index) => {
                const dateKey = d.toLocaleDateString('en-CA');
                const seconds = rowData.dailyData[dateKey];
                rowTotal += seconds;
                dayTotals[index] += seconds;
                
                const valStr = seconds > 0 ? formatHMS(seconds) : '';
                // Input di sini kini BOLEH DITAIP
                htmlContent += `<td style="text-align: center;">
                                    <input type="text" value="${valStr}" placeholder="0:00" style="width: 50px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 2px; text-align: center; font-size: 0.85rem; color: #475569; outline: none; background: white;">
                                </td>`;
            });

            grandTotal += rowTotal;
            htmlContent += `<td style="font-weight: 500; color: #718096; font-size: 0.9rem; text-align: center; border-left: 1px dotted #e2e8f0;">${formatHMS(rowTotal)}</td>
                            <td style="color: #a0aec0; cursor: pointer; font-size: 1.2rem; text-align: center; font-weight: 300;">✕</td>
                        </tr>`;
        }
        
        // Baris Tambah Projek Baharu & Butang Dropdown
        htmlContent += `<tr style="border-bottom: 1px solid #e2e8f0; background: white;">
            <td style="padding: 12px 20px; text-align: left; font-size: 0.9rem; position: relative;">
                <span id="openPickerBtn" style="color: #0ea5e9; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">⊕</span> Select project
                </span>
                
                <!-- Kotak Dropdown Clockify Style (Tersembunyi secara lalai) -->
                <div id="projectPickerPopup" style="display: none; position: absolute; top: 40px; left: 20px; background: white; border: 1px solid #cbd5e1; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); width: 320px; z-index: 50; text-align: left;">
                    <!-- Diisi oleh fungsi JS di bawah -->
                </div>
            </td>`;
            
        for(let i=0; i<7; i++) {
            // Input baharu diletakkan dalam keadaan kosong tapi boleh ditaip (disabled dibuang)
            htmlContent += `<td style="text-align: center;">
                                <input type="text" placeholder="0:00" style="width: 50px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 2px; text-align: center; background: white; outline: none; color: #475569;">
                            </td>`;
        }
        htmlContent += `<td style="font-weight: 500; color: #718096; font-size: 0.9rem; text-align: center; border-left: 1px dotted #e2e8f0;">0:00</td>
                        <td style="color: #a0aec0; cursor: pointer; font-size: 1.2rem; text-align: center; font-weight: 300;">✕</td>
                    </tr>`;

        tBody.innerHTML = htmlContent;

        if (tFoot) {
            let footHtml = `<tr style="background: #edf2f7; font-weight: 500; color: #718096; font-size: 0.9rem; border-top: 1px solid #e2e8f0;">
                                <td style="padding: 15px 20px; text-align: left;">Total:</td>`;
            
            for (let i = 0; i < 7; i++) {
                footHtml += `<td style="padding: 15px 10px; text-align: center;">${dayTotals[i] > 0 ? formatHMS(dayTotals[i]) : '0:00'}</td>`;
            }
            
            footHtml += `<td style="padding: 15px 10px; text-align: center; color: #4a5568;">${formatHMS(grandTotal)}</td><td></td></tr>`;
            tFoot.innerHTML = footHtml;
        }

        // ==========================================
        // FUNGSI DROPDOWN PROJECT/TASK (KLIK)
        // ==========================================
        const openPickerBtn = document.getElementById('openPickerBtn');
        if (openPickerBtn) {
            openPickerBtn.addEventListener('click', async () => {
                const popup = document.getElementById('projectPickerPopup');
                
                // Jika sedang buka, tutup.
                if(popup.style.display === 'block') {
                    popup.style.display = 'none';
                    return;
                }
                
                popup.style.display = 'block';
                popup.innerHTML = '<div style="padding:15px; color:#64748b; font-size:0.85rem; text-align:center;">Memuatkan senarai...</div>';
                
                // Tarik data dari DB
                const { data: projs } = await supabase.from('projects').select('*').order('project_name');
                const { data: tasks } = await supabase.from('tasks').select('*');
                
                // Bina struktur UI kotak pop-up
                let pList = `
                    <div style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                        <input type="text" placeholder="🔍 Search Project or Client" style="width:100%; padding:8px 12px; border:1px solid #cbd5e1; border-radius:4px; outline:none; box-sizing:border-box; font-size:0.85rem;">
                    </div>
                    <div style="padding: 10px 15px; font-size: 0.7rem; color: #a0aec0; text-transform: uppercase; font-weight: 600; display: flex; justify-content: space-between; background: #f8fafc;">
                        <span>NO CLIENT</span>
                        <span>${projs ? projs.length : 0} Projects ⌄</span>
                    </div>
                    <div style="max-height: 250px; overflow-y: auto;">
                `;
                
                if (projs && projs.length > 0) {
                    projs.forEach(p => {
                        const tList = tasks ? tasks.filter(t => t.project_id === p.id) : [];
                        const taskLabel = tList.length > 0 ? `${tList.length} Tasks ⌄` : 'Create Task ☆';
                        
                        pList += `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-bottom: 1px solid #f1f5f9; cursor:pointer;">
                                <span style="color:#475569; font-size:0.85rem; display:flex; align-items:center; gap:8px;">
                                    <span style="display:inline-block; width:6px; height:6px; background:#ef4444; border-radius:50%;"></span>
                                    ${p.project_name}
                                </span>
                                <span style="color:#0ea5e9; font-size:0.75rem; font-weight:500;">${taskLabel}</span>
                            </div>
                        `;
                    });
                } else {
                    pList += `<div style="padding:15px; text-align:center; color:#94a3b8; font-size:0.85rem;">Tiada Projek</div>`;
                }
                
                pList += `</div>
                <div style="padding: 12px 15px; border-top: 1px solid #e2e8f0; color: #0ea5e9; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px; background: #f8fafc;">
                    <span style="font-size: 1.1rem;">⊕</span> Create new Project
                </div>`;
                
                popup.innerHTML = pList;
            });
        }
    }

    function formatHMS(totalSeconds) {
        if (totalSeconds === 0) return '0:00';
        const h = Math.floor(totalSeconds / 3600);
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        return `${h}:${m}`;
    }
});
