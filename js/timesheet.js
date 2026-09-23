import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return window.location.href = '../pages/login.html';
        
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => supabase.auth.signOut().then(() => window.location.href = '../pages/login.html'));

        let currentEmployeeId = null;
        let currentDate = new Date(); 
        let tagsDataList = []; 

        // 1. BINA KOTAK POP-UP (PROJECT PICKER)
        let popup = document.getElementById('projectPickerPopup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'projectPickerPopup';
            popup.style.display = 'none';
            popup.style.position = 'absolute';
            popup.style.background = 'white';
            popup.style.border = '1px solid #cbd5e1';
            popup.style.borderRadius = '4px';
            popup.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            popup.style.width = '320px';
            popup.style.zIndex = '9999'; 
            popup.style.textAlign = 'left';
            document.body.appendChild(popup);
        }

        document.addEventListener('click', (e) => {
            if (popup.style.display === 'block' && 
                !popup.contains(e.target) && 
                !e.target.closest('#openPickerBtn') && 
                !e.target.closest('#addNewRowBtn')) {
                popup.style.display = 'none';
            }
        });

        // 2. FUNGSI GLOBALS & UTILITIES
        const getWeekRange = (dateObj) => {
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
            return { start, end: days[6], days };
        };

        const formatHMS = (totalSeconds) => {
            if (!totalSeconds || totalSeconds === 0) return '0:00';
            const h = Math.floor(totalSeconds / 3600);
            const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
            return `${h}:${m}`;
        };

        const parseTimeInput = (inputVal) => {
            if (!inputVal) return 0;
            let hrs = 0, mins = 0;
            if (inputVal.includes(':')) {
                const parts = inputVal.split(':');
                hrs = parseInt(parts[0]) || 0;
                mins = parseInt(parts[1]) || 0;
            } else if (inputVal.includes('.')) {
                const val = parseFloat(inputVal);
                hrs = Math.floor(val);
                mins = Math.round((val - hrs) * 60);
            } else {
                hrs = parseInt(inputVal) || 0;
            }
            return (hrs * 3600) + (mins * 60);
        };

        const getTagOptionsHtml = () => {
            let options = '<option value="">- Select Tag -</option>';
            tagsDataList.forEach(t => {
                const tagName = t.tag_name || t.name || t.title || t.tag || 'Unknown';
                options += `<option value="${t.id}">${tagName}</option>`;
            });
            return options;
        };

        // 3. FUNGSI DATABASE (SAVE)
        const saveTimeEntry = async (dateStr, pid, tid, totalSeconds, isInit = false) => {
            let query = supabase.from('time_entries').select('id, duration_seconds').eq('employee_id', currentEmployeeId).eq('work_date', dateStr);
            if (pid) query = query.eq('project_id', pid); else query = query.is('project_id', null);
            if (tid) query = query.eq('task_id', tid); else query = query.is('task_id', null);

            const { data: existing } = await query;
            const exists = existing && existing.length > 0;

            if (isInit) {
                if (exists) return; 
            } else {
                if (totalSeconds === 0) {
                    if (exists) await supabase.from('time_entries').delete().in('id', existing.map(e => e.id));
                    return; 
                }
            }

            const totalMinutes = Math.floor(totalSeconds / 60);
            
            if (exists) {
                await supabase.from('time_entries').update({
                    duration_seconds: totalSeconds,
                    total_minutes: totalMinutes
                }).eq('id', existing[0].id);
            } else {
                await supabase.from('time_entries').insert([{
                    employee_id: currentEmployeeId,
                    project_id: pid,
                    task_id: tid,
                    work_date: dateStr,
                    start_time: `${dateStr}T09:00:00`, 
                    duration_seconds: totalSeconds,
                    total_minutes: totalMinutes,
                    status: 'STOPPED',
                    entry_type: 'Manual',
                    description: 'Timesheet Entry'
                }]);
            }
        };

        // 4. FUNGSI RENDER (UI BARU)
        const renderTimesheetHeader = () => {
            const { start, end, days } = getWeekRange(currentDate);
            
            const dateStr = `${start.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${end.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`;
            
            const dateRangeEl = document.getElementById('weekDateRange');
            const dateRangeTopEl = document.getElementById('weekDateRangeTop');
            if (dateRangeEl) dateRangeEl.textContent = dateStr;
            if (dateRangeTopEl) dateRangeTopEl.textContent = dateStr;

            const daysArray = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            days.forEach((d, i) => {
                const thSpan = document.getElementById(`th${daysArray[i]}`);
                if (thSpan) thSpan.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
            });
        };

        const togglePopup = async (e) => {
            if(popup.style.display === 'block') { popup.style.display = 'none'; return; }
            
            const rect = e.currentTarget.getBoundingClientRect();
            popup.style.top = (rect.bottom + window.scrollY + 5) + 'px';
            popup.style.left = (rect.left + window.scrollX) + 'px';
            
            popup.style.display = 'block';
            popup.innerHTML = '<div style="padding:15px; color:#64748b; font-size:0.85rem; text-align:center;">Memuatkan senarai...</div>';
            
            const { data: projs } = await supabase.from('projects').select('*').order('project_name');
            const { data: tasks } = await supabase.from('tasks').select('*');
            
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
                    const hasTasks = tList.length > 0;
                    
                    pList += `
                        <div class="proj-header" data-id="${p.id}" data-hastasks="${hasTasks}" style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-bottom: 1px solid #f1f5f9; cursor:pointer;">
                            <span style="color:#475569; font-size:0.85rem; display:flex; align-items:center; gap:8px;">
                                <span style="display:inline-block; width:6px; height:6px; background:#ef4444; border-radius:50%;"></span>
                                ${p.project_name}
                            </span>
                            <span style="color:#0ea5e9; font-size:0.75rem; font-weight:500;">${hasTasks ? tList.length + ' Tasks ⌄' : 'Select'}</span>
                        </div>
                    `;

                    if (hasTasks) {
                        pList += `<div class="tasks-container" id="tasks-${p.id}" style="display:none; background:#f8fafc; border-bottom: 1px solid #f1f5f9;">`;
                        pList += `<div class="task-select-item" data-pid="${p.id}" data-tid="" style="padding: 10px 15px 10px 30px; cursor:pointer; color:#0ea5e9; font-weight:600; font-size:0.8rem; border-top:1px dashed #e2e8f0;">(No Task)</div>`;
                        tList.forEach(t => {
                            pList += `<div class="task-select-item" data-pid="${p.id}" data-tid="${t.id}" style="padding: 10px 15px 10px 30px; cursor:pointer; color:#64748b; font-size:0.8rem; border-top:1px dashed #e2e8f0;">- ${t.task_name}</div>`;
                        });
                        pList += `</div>`;
                    }
                });
            } else {
                pList += `<div style="padding:15px; text-align:center; color:#94a3b8; font-size:0.85rem;">Tiada Projek</div>`;
            }
            popup.innerHTML = pList + `</div>`;

            document.querySelectorAll('.proj-header').forEach(item => {
                item.addEventListener('click', async (e) => {
                    const selPid = e.currentTarget.getAttribute('data-id');
                    const hasTasks = e.currentTarget.getAttribute('data-hastasks') === 'true';
                    
                    if (hasTasks) {
                        const tc = document.getElementById('tasks-' + selPid);
                        tc.style.display = tc.style.display === 'none' ? 'block' : 'none';
                    } else {
                        const { start } = getWeekRange(currentDate); 
                        await saveTimeEntry(start.toLocaleDateString('en-CA'), selPid, null, 0, true);
                        popup.style.display = 'none';
                        loadTimesheetData();
                    }
                });
            });

            document.querySelectorAll('.task-select-item').forEach(item => {
                item.addEventListener('click', async (e) => {
                    const selPid = e.currentTarget.getAttribute('data-pid');
                    const selTid = e.currentTarget.getAttribute('data-tid') || null; 
                    
                    const { start } = getWeekRange(currentDate); 
                    await saveTimeEntry(start.toLocaleDateString('en-CA'), selPid, selTid, 0, true);
                    popup.style.display = 'none';
                    loadTimesheetData();
                });
            });
        };

        const loadTimesheetData = async () => {
            const tBody = document.getElementById('timesheetTableBody');
            const tFoot = document.getElementById('timesheetFootRow');
            if (!tBody) return;

            tBody.innerHTML = '<tr><td colspan="13" style="padding:20px; text-align:center; color:#888;">Memuatkan data...</td></tr>';

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
                tBody.innerHTML = `<tr><td colspan="13" style="padding:20px; text-align:center; color:red;">Ralat: ${error.message}</td></tr>`;
                return;
            }

            const matrix = {};
            let globalRowCount = 1;
            
            data.forEach(entry => {
                const pId = entry.project_id || 'no_project';
                const tId = entry.task_id || 'no_task';
                const key = `${pId}_${tId}`;
                
                const pName = entry.project ? entry.project.project_name : 'No Project';
                const tName = entry.task ? entry.task.task_name : '';
                const localDate = entry.work_date || new Date(entry.start_time).toLocaleDateString('en-CA');

                if (!matrix[key]) {
                    matrix[key] = { projectId: entry.project_id, taskId: entry.task_id, projectName: pName, taskName: tName, dailyData: {} };
                    days.forEach(d => matrix[key].dailyData[d.toLocaleDateString('en-CA')] = 0);
                }
                
                if (matrix[key].dailyData[localDate] !== undefined) {
                    matrix[key].dailyData[localDate] += (entry.duration_seconds || 0);
                }
            });

            let htmlContent = '';
            let dayTotals = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
            let grandTotal = 0;

            for (const [key, rowData] of Object.entries(matrix)) {
                let rowTotal = 0;
                const displayTask = rowData.taskName && rowData.taskName !== 'No Task' ? `<br><span style="color:#64748b; font-size: 0.75rem;">${rowData.taskName}</span>` : '';
                
                const pidAttr = rowData.projectId || '';
                const tidAttr = rowData.taskId || '';

                htmlContent += `<tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                    <td style="text-align: center; font-weight: 500; color: #64748b;">${globalRowCount++}</td>
                    <td style="font-size: 0.85rem; color: #1e293b; font-weight: 600;">
                        <span style="display:inline-block; width:8px; height:8px; background:#3b82f6; border-radius:50%; margin-right:8px;"></span>
                        ${rowData.projectName.toUpperCase()} ${displayTask}
                    </td>
                    <td>
                        <select class="ts-select">
                            ${getTagOptionsHtml()}
                        </select>
                    </td>
                    <td>
                        <input type="text" class="ts-input-remark" placeholder="Type remark...">
                    </td>`;
                
                days.forEach((d, index) => {
                    const dateKey = d.toLocaleDateString('en-CA');
                    const seconds = rowData.dailyData[dateKey];
                    rowTotal += seconds;
                    dayTotals[index] += seconds;                    
                    
                    const valStr = seconds > 0 ? formatHMS(seconds) : '0:00';
                    const zeroClass = seconds > 0 ? '' : 'zero';

                    htmlContent += `<td style="text-align: center;">
                                        <input type="text" class="ts-input-time time-input ${zeroClass}" data-date="${dateKey}" data-pid="${pidAttr}" data-tid="${tidAttr}" value="${valStr}" placeholder="0:00">
                                    </td>`;
                });
                grandTotal += rowTotal;
                htmlContent += `<td style="font-weight: 700; color: #1e293b; font-size: 0.9rem; text-align: center;">${formatHMS(rowTotal)}</td>
                                <td style="text-align: center;">
                                    <button class="action-btn del-row-btn" data-pid="${pidAttr}" data-tid="${tidAttr}" title="Delete Row">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </td>
                            </tr>`;
            }            
            
            // Baris Kosong Tambahan (Select Project)
            htmlContent += `<tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                <td style="text-align: center; font-weight: 500; color: #64748b;">${globalRowCount}</td>
                <td style="font-size: 0.85rem;">
                    <span id="openPickerBtn" style="color: #3b82f6; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                        Select project
                    </span>
                </td>
                <td><select class="ts-select" disabled><option>- Select Tag -</option></select></td>
                <td><input type="text" class="ts-input-remark" placeholder="Type remark..." disabled></td>`;
                
            for(let i=0; i<7; i++) {
                htmlContent += `<td style="text-align: center;"><input type="text" class="ts-input-time zero" value="0:00" disabled></td>`;
            }
            htmlContent += `<td style="font-weight: 700; color: #1e293b; font-size: 0.9rem; text-align: center;">0:00</td>
                            <td style="text-align: center;">
                                <button class="action-btn" title="Delete Row"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button>
                            </td>
                        </tr>`;

            tBody.innerHTML = htmlContent;

            // Update Footer Total HTML
            if (tFoot) {
                const daysArray = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                daysArray.forEach((day, index) => {
                    const tf = document.getElementById(`tf${day}`);
                    if (tf) tf.textContent = dayTotals[index] > 0 ? formatHMS(dayTotals[index]) : '0:00';
                });
                const tfTotal = document.getElementById('tfTotal');
                if (tfTotal) tfTotal.textContent = formatHMS(grandTotal);
            }

            // BIND EVENTS UNTUK ELEMEN DALAM JADUAL SAHAJA
            document.querySelectorAll('.time-input').forEach(input => {
                // Kosmetik: Buang 0:00 bila klik
                input.addEventListener('focus', function() {
                    if (this.value === '0:00') this.value = '';
                });

                input.addEventListener('change', async (e) => {
                    const el = e.target;
                    const dateStr = el.getAttribute('data-date');
                    const pid = el.getAttribute('data-pid') || null;
                    const tid = el.getAttribute('data-tid') || null;
                    
                    let rawVal = el.value.trim();
                    if (rawVal === '') rawVal = '0:00';
                    else if (!rawVal.includes(':')) rawVal = rawVal + ':00';
                    el.value = rawVal;
                    
                    el.style.opacity = '0.5'; 
                    const totalSeconds = parseTimeInput(rawVal);
                    await saveTimeEntry(dateStr, pid, tid, totalSeconds, false);
                    loadTimesheetData(); 
                });
            });

            document.querySelectorAll('.del-row-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if(!confirm("Padam keseluruhan baris masa untuk projek ini pada minggu ini?")) return;
                    const pid = e.currentTarget.getAttribute('data-pid') || null;
                    const tid = e.currentTarget.getAttribute('data-tid') || null;
                    const { start, end } = getWeekRange(currentDate);
                    
                    let query = supabase.from('time_entries').delete().eq('employee_id', currentEmployeeId)
                        .gte('work_date', start.toLocaleDateString('en-CA')).lte('work_date', end.toLocaleDateString('en-CA'));
                    if (pid) query = query.eq('project_id', pid); else query = query.is('project_id', null);
                    if (tid) query = query.eq('task_id', tid); else query = query.is('task_id', null);

                    await query;
                    loadTimesheetData();
                });
            });

            const openPickerBtn = document.getElementById('openPickerBtn');
            if (openPickerBtn) openPickerBtn.addEventListener('click', togglePopup);
        };

        // 5. EVENT BINDING STATIK & CUSTOM DROPDOWN
        const prevWeekBtn = document.getElementById('prevWeekBtn');
        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', () => {
                currentDate.setDate(currentDate.getDate() - 7);
                renderTimesheetHeader();
                loadTimesheetData();
            });
        }
        
        const nextWeekBtn = document.getElementById('nextWeekBtn');
        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', () => {
                currentDate.setDate(currentDate.getDate() + 7);
                renderTimesheetHeader();
                loadTimesheetData();
            });
        }
        
        const addNewRowBtn = document.getElementById('addNewRowBtn');
        if (addNewRowBtn) addNewRowBtn.addEventListener('click', togglePopup);
       
        // ==========================================
        // FUNGSI COPY LAST WEEK (CUSTOM DROPDOWN)
        // ==========================================
        const executeCopyLastWeek = async (includeTime) => {
            const copyBtn = document.getElementById('copyLastWeekBtn');
            const originalHtml = copyBtn.innerHTML;
            if (copyBtn) copyBtn.innerHTML = '⏳ Copying...';
            
            try {
                const lwDate = new Date(currentDate);
                lwDate.setDate(lwDate.getDate() - 7);
                const { start: lwStart, end: lwEnd } = getWeekRange(lwDate);
                const { days: cwDays } = getWeekRange(currentDate);

                const lwStartIso = lwStart.toISOString().split('T')[0];
                const lwEndFull = new Date(lwEnd);
                lwEndFull.setHours(23, 59, 59, 999);
                const lwEndIso = lwEndFull.toISOString();

                // AMBIL SEMUA DATA MINGGU LEPAS
                const { data: lwData, error } = await supabase.from('time_entries')
                    .select('*')
                    .eq('employee_id', currentEmployeeId)
                    .eq('status', 'STOPPED')
                    .gte('start_time', lwStartIso)
                    .lte('start_time', lwEndIso);

                if (error) throw error;

                if (!lwData || lwData.length === 0) {
                    alert(`Tiada rekod masa atau projek pada minggu lepas (${lwStart.toLocaleDateString('en-GB')} - ${lwEnd.toLocaleDateString('en-GB')}) untuk disalin.`);
                    if(copyBtn) copyBtn.innerHTML = originalHtml;
                    return;
                }

                // KUMPULKAN MASA
                const matrix = {};
                lwData.forEach(entry => {
                    const pId = entry.project_id || 'null';
                    const tId = entry.task_id || 'null';
                    const key = `${pId}_${tId}`;
                    
                    const entryDate = entry.work_date ? new Date(entry.work_date) : new Date(entry.start_time.split('T')[0]);
                    let dayIndex = entryDate.getDay() - 1;
                    if (dayIndex === -1) dayIndex = 6;

                    if (!matrix[key]) {
                        matrix[key] = { pid: entry.project_id, tid: entry.task_id, dailyData: [0,0,0,0,0,0,0] };
                    }
                    if (includeTime) {
                        matrix[key].dailyData[dayIndex] += (entry.duration_seconds || 0);
                    }
                });

                // MASUKKAN DATA
                for (const key in matrix) {
                    const row = matrix[key];
                    await saveTimeEntry(cwDays[0].toLocaleDateString('en-CA'), row.pid === 'null' ? null : row.pid, row.tid === 'null' ? null : row.tid, 0, true);
                    
                    if (includeTime) {
                        for (let i = 0; i < 7; i++) {
                            const sec = row.dailyData[i];
                            if (sec > 0) {
                                const targetDateStr = cwDays[i].toLocaleDateString('en-CA');
                                await saveTimeEntry(targetDateStr, row.pid === 'null' ? null : row.pid, row.tid === 'null' ? null : row.tid, sec, false);
                            }
                        }
                    }
                }

                await loadTimesheetData();
            } catch (err) {
                alert("Gagal menyalin: " + err.message);
            }
            
            if(copyBtn) copyBtn.innerHTML = originalHtml;
        };

        // Kawalan Menu Dropdown Copy Last Week
        const copyBtn = document.getElementById('copyLastWeekBtn');
        const copyMenu = document.getElementById('copyLastWeekMenu');

        if (copyBtn && copyMenu) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                copyMenu.style.display = copyMenu.style.display === 'block' ? 'none' : 'block';
            });
            
            document.addEventListener('click', (e) => {
                if (!copyBtn.contains(e.target) && !copyMenu.contains(e.target)) {
                    copyMenu.style.display = 'none';
                }
            });

            document.getElementById('btnCopyActivitiesOnly')?.addEventListener('click', async () => {
                copyMenu.style.display = 'none';
                await executeCopyLastWeek(false);
            });

            document.getElementById('btnCopyActivitiesAndTime')?.addEventListener('click', async () => {
                copyMenu.style.display = 'none';
                await executeCopyLastWeek(true);
            });
        }

        const saveTemplateBtn = document.getElementById('saveTemplateBtn');
        if (saveTemplateBtn) saveTemplateBtn.addEventListener('click', () => alert("Fungsi 'Save as template' akan datang dalam kemas kini modul seterusnya!"));

        // 6. INITIALIZATION (Mula muat data)
        const { data: empData } = await supabase.from('employees').select('id').eq('email', session.user.email).maybeSingle();
        
        try {
            const { data: tagsData } = await supabase.from('tags').select('*');
            tagsDataList = tagsData || [];
        } catch(e) { console.warn("Modul Tags belum sedia", e); }

        if (empData) {
            currentEmployeeId = empData.id;
            renderTimesheetHeader();
            await loadTimesheetData();
        } else {
            const tb = document.getElementById('timesheetTableBody');
            if (tb) tb.innerHTML = `<tr><td colspan="13" style="padding:20px; text-align:center; color:red;">Akaun e-mel anda tiada dalam sistem Team.</td></tr>`;
        }

    } catch (error) {
        console.error("Critical Error:", error);
        alert("Ralat sistem dikesan: " + error.message + ". Sila maklumkan kepada admin.");
    }
});
