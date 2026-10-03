import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        await populateFilters();

        document.getElementById('btnGenerate')?.addEventListener('click', generateReport);
        document.getElementById('btnPrint')?.addEventListener('click', () => window.print());
        document.getElementById('btnExcel')?.addEventListener('click', exportCSV);

        await generateReport();

    } catch (err) {
        console.error("Reports Init Error:", err);
    }
});

async function populateFilters() {
    const monthSelect = document.getElementById('reportMonth');
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = new Date().getMonth();
    
    if (monthSelect) {
        months.forEach((m, i) => {
            const option = document.createElement('option');
            option.value = i + 1;
            option.textContent = m;
            if (i === currentMonth) option.selected = true;
            monthSelect.appendChild(option);
        });
    }
    
    const reportYear = document.getElementById('reportYear');
    if (reportYear) reportYear.value = new Date().getFullYear();

    try {
        const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
        const projSelect = document.getElementById('filterProject');
        if (projs && projSelect) {
            projs.forEach(p => { projSelect.innerHTML += '<option value="' + p.id + '">' + p.project_name + '</option>'; });
        }
    } catch (e) {}

    try {
        let { data: groups } = await supabase.from('groups').select('*');
        const groupSelect = document.getElementById('filterGroup');
        if (groups && groupSelect) {
            groups.forEach(g => { groupSelect.innerHTML += '<option value="' + g.id + '">' + g.group_name + '</option>'; });
        }
    } catch (e) {}

    try {
        const { data: emps } = await supabase.from('employees').select('id, name, email').order('name');
        const userSelect = document.getElementById('filterUser');
        if (emps && userSelect) {
            emps.forEach(e => {
                const displayName = e.name || e.email.split('@')[0];
                userSelect.innerHTML += '<option value="' + e.id + '">' + displayName + '</option>';
            });
        }
    } catch (e) {}
}

// LOGIK BAHARU: MINGGU MENGIKUT HARI ISNIN (Menghalang Pertindihan)
function getWeekDates(year, month) {
    let weeks = [];
    const formatFull = (dt) => dt.getDate() + '/' + (dt.getMonth() + 1) + '/' + dt.getFullYear();
    
    // Cari semua hari Isnin dalam bulan yang dipilih
    for (let day = 1; day <= 31; day++) {
        let d = new Date(year, month - 1, day);
        if (d.getMonth() !== month - 1) break; // Berhenti jika masuk bulan depan
        
        if (d.getDay() === 1) { // 1 = Hari Isnin
            let start = new Date(d);
            start.setHours(0,0,0,0);
            
            let end = new Date(start);
            end.setDate(start.getDate() + 6); // Tambah 6 hari untuk dapat Ahad
            end.setHours(23,59,59,999);
            
            weeks.push({
                start: start,
                end: end,
                text: formatFull(start) + ' - ' + formatFull(end)
            });
        }
    }
    
    // Jika bulan tersebut hanya ada 4 minggu Isnin, letak 'N/A' untuk kotak minggu ke-5
    while (weeks.length < 5) {
        weeks.push({ start: null, end: null, text: 'N/A' });
    }
    
    return weeks;
}

async function generateReport() {
    const month = parseInt(document.getElementById('reportMonth').value);
    const year = parseInt(document.getElementById('reportYear').value);
    const selectedProject = document.getElementById('filterProject').value;
    const selectedGroup = document.getElementById('filterGroup').value;
    const selectedUser = document.getElementById('filterUser').value;
    
    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const badge = document.getElementById('badgeMonthYear');
    if (badge) badge.innerHTML = monthName + '<br>' + year;

    const weeks = getWeekDates(year, month);
    weeks.forEach((w, i) => {
        const el = document.getElementById('dtW' + (i+1));
        if(el) el.textContent = w.text || '-';
    });

    const validWeeks = weeks.filter(w => w.start !== null);
    if(validWeeks.length === 0) return;

    const sDt = validWeeks[0].start; 
    const eDt = validWeeks[validWeeks.length - 1].end;
    const startStr = sDt.getFullYear() + '-' + String(sDt.getMonth()+1).padStart(2,'0') + '-' + String(sDt.getDate()).padStart(2,'0');
    const endStr = eDt.getFullYear() + '-' + String(eDt.getMonth()+1).padStart(2,'0') + '-' + String(eDt.getDate()).padStart(2,'0');

    let allEntries = [];
    let from = 0;
    const step = 999;
    let hasMore = true;

    let empIds = null;
    if (selectedGroup !== 'ALL') {
        const { data: groupEmps } = await supabase.from('employees').select('id').eq('group_id', selectedGroup);
        if (groupEmps && groupEmps.length > 0) empIds = groupEmps.map(e => e.id);
        else empIds = ['00000000-0000-0000-0000-000000000000']; 
    }

    while (hasMore) {
        let query = supabase
            .from('time_entries')
            .select('duration_seconds, work_date, start_time, employee_id, project_id, project:projects!fk_time_entries_project(project_name)')
            .eq('status', 'STOPPED')
            .gte('work_date', startStr)
            .lte('work_date', endStr)
            .range(from, from + step);

        if (selectedProject !== 'ALL') query = query.eq('project_id', selectedProject);
        if (selectedUser !== 'ALL') query = query.eq('employee_id', selectedUser);
        if (empIds) query = query.in('employee_id', empIds);

        const { data, error } = await query;
        if (error) break;

        if (data && data.length > 0) {
            allEntries = allEntries.concat(data);
            if (data.length <= step) hasMore = false;
            else from += step + 1;
        } else {
            hasMore = false;
        }
    }

    let projectGroups = {};
    const w1S = weeks[0].start ? weeks[0].start.getTime() : 0; const w1E = weeks[0].end ? weeks[0].end.getTime() : 0;
    const w2S = weeks[1].start ? weeks[1].start.getTime() : 0; const w2E = weeks[1].end ? weeks[1].end.getTime() : 0;
    const w3S = weeks[2].start ? weeks[2].start.getTime() : 0; const w3E = weeks[2].end ? weeks[2].end.getTime() : 0;
    const w4S = weeks[3].start ? weeks[3].start.getTime() : 0; const w4E = weeks[3].end ? weeks[3].end.getTime() : 0;
    const w5S = weeks[4].start ? weeks[4].start.getTime() : 0; const w5E = weeks[4].end ? weeks[4].end.getTime() : 0;
    
    if (allEntries.length > 0) {
        allEntries.forEach(item => {
            const pName = (item.project ? item.project.project_name : 'General Project').toUpperCase();
            if (!projectGroups[pName]) projectGroups[pName] = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, total: 0 };
            
            let dObj;
            if (item.work_date) {
                const pts = item.work_date.split('-');
                dObj = new Date(parseInt(pts[0]), parseInt(pts[1])-1, parseInt(pts[2]));
            } else {
                dObj = new Date(item.start_time);
            }
            dObj.setHours(0,0,0,0);
            const itemTime = dObj.getTime();
            const hrs = (item.duration_seconds || 0) / 3600;
            
            if (weeks[0].start && itemTime >= w1S && itemTime <= w1E) projectGroups[pName].w1 += hrs;
            else if (weeks[1].start && itemTime >= w2S && itemTime <= w2E) projectGroups[pName].w2 += hrs;
            else if (weeks[2].start && itemTime >= w3S && itemTime <= w3E) projectGroups[pName].w3 += hrs;
            else if (weeks[3].start && itemTime >= w4S && itemTime <= w4E) projectGroups[pName].w4 += hrs;
            else if (weeks[4].start && itemTime >= w5S && itemTime <= w5E) projectGroups[pName].w5 += hrs;
            
            projectGroups[pName].total += hrs;
        });
    }

    renderTable(projectGroups, weeks);
}

function renderTable(projectGroups, weeks) {
    const tbody = document.getElementById('tableBodyProjects');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let sumWeekly = [0, 0, 0, 0, 0];
    let grandTotal = 0;

    if (Object.keys(projectGroups).length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#64748b; padding: 20px; text-align:center;">No man-hour records found for this period/filter.</td></tr>';
    } else {
        Object.keys(projectGroups).sort().forEach(pName => {
            const row = projectGroups[pName];
            sumWeekly[0] += row.w1; sumWeekly[1] += row.w2; sumWeekly[2] += row.w3;
            sumWeekly[3] += row.w4; sumWeekly[4] += row.w5; grandTotal += row.total;
            
            tbody.innerHTML += '<tr>' +
                '<td class="project-name">' + pName + '</td>' +
                '<td>' + row.w1.toFixed(1) + '</td>' +
                '<td>' + row.w2.toFixed(1) + '</td>' +
                '<td>' + row.w3.toFixed(1) + '</td>' +
                '<td>' + (weeks[3].text !== 'N/A' ? row.w4.toFixed(1) : '-') + '</td>' +
                '<td>' + (weeks[4].text !== 'N/A' ? row.w5.toFixed(1) : '-') + '</td>' +
                '<td style="font-weight:800; color:#0f172a;">' + row.total.toFixed(1) + '</td>' +
                '</tr>';
        });
    }

    for(let i = 0; i < 5; i++) {
        const el = document.getElementById('totW' + (i+1));
        if(el) {
            if(weeks[i].text === 'N/A') el.textContent = '-';
            else el.textContent = sumWeekly[i].toFixed(1);
        }
    }
    const tg = document.getElementById('totGrand');
    if(tg) tg.textContent = grandTotal.toFixed(1);
}

function exportCSV() {
    let csv = [];
    const rows = document.querySelectorAll("table#exportTable tr");
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) {
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ");
            row.push('"' + data + '"');
        }
        csv.push(row.join(","));
    }
    const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
    const downloadLink = document.createElement("a");
    downloadLink.download = "Project_ManHour_Report.csv";
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
}
