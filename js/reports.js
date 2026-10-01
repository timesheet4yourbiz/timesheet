import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        await populateFilters();

        document.getElementById('btnGenerate').addEventListener('click', generateReport);
        document.getElementById('btnPrint').addEventListener('click', () => window.print());
        document.getElementById('btnExcel').addEventListener('click', exportCSV);

        // Auto generate laporan buat kali pertama
        await generateReport();

    } catch (err) {
        console.error("Reports Init Error:", err);
    }
});

async function populateFilters() {
    const monthSelect = document.getElementById('reportMonth');
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = new Date().getMonth();
    
    months.forEach((m, i) => {
        const option = document.createElement('option');
        option.value = i + 1;
        option.textContent = m;
        if (i === currentMonth) option.selected = true;
        monthSelect.appendChild(option);
    });
    document.getElementById('reportYear').value = new Date().getFullYear();

    try {
        const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
        const projSelect = document.getElementById('filterProject');
        if (projs && projSelect) {
            projs.forEach(p => {
                projSelect.innerHTML += '<option value="' + p.id + '">' + p.project_name + '</option>';
            });
        }
    } catch (e) { console.warn("Ralat pilihan projek:", e); }

    try {
        let { data: groups, error } = await supabase.from('groups').select('*');
        const groupSelect = document.getElementById('filterGroup');
        if (groups && groupSelect) {
            groups.forEach(g => {
                const gName = g.group_name || g.name || 'Group ' + g.id;
                groupSelect.innerHTML += '<option value="' + g.id + '">' + gName + '</option>';
            });
        }
    } catch (e) { console.warn("Ralat pilihan group:", e); }

    try {
        const { data: emps } = await supabase.from('employees').select('id, name, email').order('name');
        const userSelect = document.getElementById('filterUser');
        if (emps && userSelect) {
            emps.forEach(e => {
                const displayName = e.name || e.email.split('@')[0];
                userSelect.innerHTML += '<option value="' + e.id + '">' + displayName + '</option>';
            });
        }
    } catch (e) { console.warn("Ralat pilihan pengguna:", e); }
}

function getWeekDates(year, month) {
    let firstDay = new Date(year, month - 1, 1);
    let dayOfWeek = firstDay.getDay(); 
    let diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    let startDate = new Date(year, month - 1, 1 + diffToMonday);

    let lastDayOfMonth = new Date(year, month, 0);
    let lastDayOfWeek = lastDayOfMonth.getDay();
    let daysToNextSunday = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    let finalSunday = new Date(year, month - 1, lastDayOfMonth.getDate() + daysToNextSunday);

    const formatFull = (d) => d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();

    let weeks = [];
    let currentStart = new Date(startDate);

    for (let i = 0; i < 4; i++) {
        let currentEnd = new Date(currentStart);
        currentEnd.setDate(currentStart.getDate() + 6);
        weeks.push({
            start: new Date(currentStart),
            end: new Date(currentEnd),
            text: formatFull(currentStart) + ' - ' + formatFull(currentEnd)
        });
        currentStart.setDate(currentStart.getDate() + 7);
    }

    weeks.push({
        start: new Date(currentStart),
        end: new Date(finalSunday),
        text: formatFull(currentStart) + ' - ' + formatFull(finalSunday)
    });

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

    // Ambil data bermula dari hari Isnin Minggu Pertama hingga hari Ahad Minggu Terakhir
    const startDateIso = new Date(Date.UTC(weeks[0].start.getFullYear(), weeks[0].start.getMonth(), weeks[0].start.getDate(), 0, 0, 0)).toISOString();
    const endDateIso = new Date(Date.UTC(weeks[4].end.getFullYear(), weeks[4].end.getMonth(), weeks[4].end.getDate(), 23, 59, 59)).toISOString();

    let query = supabase
        .from('time_entries')
        .select('duration_seconds, work_date, start_time, employee_id, project_id, project:projects!fk_time_entries_project(project_name)')
        .eq('status', 'STOPPED')
        .gte('start_time', startDateIso)
        .lte('start_time', endDateIso);

    // Penapis
    if (selectedProject !== 'ALL') query = query.eq('project_id', selectedProject);
    if (selectedUser !== 'ALL') query = query.eq('employee_id', selectedUser);

    if (selectedGroup !== 'ALL') {
        const { data: groupEmps, error: geErr } = await supabase.from('employees').select('id').eq('group_id', selectedGroup);
        if (!geErr && groupEmps && groupEmps.length > 0) {
            const empIds = groupEmps.map(e => e.id);
            query = query.in('employee_id', empIds);
        } else {
            query = query.eq('employee_id', '00000000-0000-0000-0000-000000000000');
        }
    }

    const { data: entries, error } = await query;
    if (error) {
        console.error("Ralat Carian Laporan:", error);
        return;
    }

    let projectGroups = {};
    const w1S = weeks[0].start.getTime(); const w1E = weeks[0].end.getTime();
    const w2S = weeks[1].start.getTime(); const w2E = weeks[1].end.getTime();
    const w3S = weeks[2].start.getTime(); const w3E = weeks[2].end.getTime();
    const w4S = weeks[3].start.getTime(); const w4E = weeks[3].end.getTime();
    const w5S = weeks[4].start.getTime(); const w5E = weeks[4].end.getTime();
    
    if (entries && entries.length > 0) {
        entries.forEach(item => {
            const pName = (item.project ? item.project.project_name : 'General Project').toUpperCase();
            if (!projectGroups[pName]) projectGroups[pName] = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, total: 0 };
            
            const dObj = new Date(item.work_date || item.start_time);
            dObj.setHours(0,0,0,0);
            const itemTime = dObj.getTime();
            const hrs = (item.duration_seconds || 0) / 3600;
            
            if (itemTime >= w1S && itemTime <= w1E) projectGroups[pName].w1 += hrs;
            else if (itemTime >= w2S && itemTime <= w2E) projectGroups[pName].w2 += hrs;
            else if (itemTime >= w3S && itemTime <= w3E) projectGroups[pName].w3 += hrs;
            else if (itemTime >= w4S && itemTime <= w4E) projectGroups[pName].w4 += hrs;
            else if (itemTime >= w5S && itemTime <= w5E) projectGroups[pName].w5 += hrs;
            
            projectGroups[pName].total += hrs;
        });
    }

    renderTable(projectGroups, weeks);
}

function renderTable(projectGroups, weeks) {
    const tbody = document.getElementById('tableBodyProjects');
    tbody.innerHTML = '';
    let sumWeekly = [0, 0, 0, 0, 0];
    let grandTotal = 0;

    if (Object.keys(projectGroups).length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#64748b; padding: 20px;">No man-hour records found for this period/filter.</td></tr>';
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
                '<td>' + row.w4.toFixed(1) + '</td>' +
                '<td>' + (weeks[4].text !== 'N/A' ? row.w5.toFixed(1) : '-') + '</td>' +
                '<td style="font-weight:800; color:#0f172a;">' + row.total.toFixed(1) + '</td>' +
                '</tr>';
        });
    }

    for(let i = 0; i < 5; i++) {
        const el = document.getElementById('totW' + (i+1));
        if(el) el.textContent = sumWeekly[i].toFixed(1);
    }
    document.getElementById('totGrand').textContent = grandTotal.toFixed(1);
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
