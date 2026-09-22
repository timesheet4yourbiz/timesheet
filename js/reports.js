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
    // 1. Isikan Bulan & Tahun
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

    // 2. Isikan Pilihan Project dari Supabase
    try {
        const { data: projs } = await supabase.from('projects').select('id, project_name').order('project_name');
        const projSelect = document.getElementById('filterProject');
        if (projs && projSelect) {
            projs.forEach(p => {
                projSelect.innerHTML += `<option value="${p.id}">${p.project_name}</option>`;
            });
        }
    } catch (e) { console.warn("Ralat memuatkan pilihan projek:", e); }

    // 3. Isikan Pilihan Group (Departments) dari Supabase
    try {
        const { data: depts } = await supabase.from('departments').select('*');
        const groupSelect = document.getElementById('filterGroup');
        if (depts && groupSelect) {
            depts.forEach(d => {
                const dName = d.department_name || d.name || 'Group ' + d.id;
                groupSelect.innerHTML += `<option value="${d.id}">${dName}</option>`;
            });
        }
    } catch (e) { console.warn("Ralat memuatkan pilihan kumpulan:", e); }

    // 4. Isikan Pilihan User (Employees) dari Supabase
    try {
        const { data: emps } = await supabase.from('employees').select('id, name, email').order('name');
        const userSelect = document.getElementById('filterUser');
        if (emps && userSelect) {
            emps.forEach(e => {
                const displayName = e.name || e.email.split('@')[0];
                userSelect.innerHTML += `<option value="${e.id}">${displayName}</option>`;
            });
        }
    } catch (e) { console.warn("Ralat memuatkan pilihan pengguna:", e); }
}

function getWeekDates(year, month) {
    const lastDay = new Date(year, month, 0).getDate();
    const mName = new Date(year, month - 1).toLocaleString('en-US', { month: 'short' });
    
    return [
        { label: 'Week 1', start: 1, end: 7, text: `01 - 07 ${mName} ${year}` },
        { label: 'Week 2', start: 8, end: 14, text: `08 - 14 ${mName} ${year}` },
        { label: 'Week 3', start: 15, end: 21, text: `15 - 21 ${mName} ${year}` },
        { label: 'Week 4', start: 22, end: 28, text: `22 - 28 ${mName} ${year}` },
        { label: 'Week 5', start: 29, end: lastDay, text: lastDay >= 29 ? `29 - ${lastDay} ${mName} ${year}` : 'N/A' }
    ];
}

async function generateReport() {
    const month = parseInt(document.getElementById('reportMonth').value);
    const year = parseInt(document.getElementById('reportYear').value);
    const selectedProject = document.getElementById('filterProject').value;
    const selectedGroup = document.getElementById('filterGroup').value;
    const selectedUser = document.getElementById('filterUser').value;
    
    // Kemaskini Lencana Bulan
    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' }).toUpperCase();
    document.getElementById('badgeMonthYear').innerHTML = `${monthName}<br>${year}`;

    // Kemaskini Julat Tarikh Minggu
    const weeks = getWeekDates(year, month);
    weeks.forEach((w, i) => {
        const el = document.getElementById(`dtW${i+1}`);
        if(el) el.textContent = w.text || '-';
    });

    // QUERY SUPABASE - time_entries
    const lastDay = new Date(year, month, 0).getDate();
    const startDateIso = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
    const endDateIso = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59)).toISOString();

    let query = supabase
        .from('time_entries')
        .select(`duration_seconds, work_date, start_time, employee_id, project_id, project:projects!fk_time_entries_project(project_name)`)
        .eq('status', 'STOPPED')
        .gte('start_time', startDateIso)
        .lte('start_time', endDateIso);

    // Penapis 1: Project
    if (selectedProject !== 'ALL') {
        query = query.eq('project_id', selectedProject);
    }

    // Penapis 2: User / Employee
    if (selectedUser !== 'ALL') {
        query = query.eq('employee_id', selectedUser);
    }

    // Penapis 3: Group / Department
    if (selectedGroup !== 'ALL') {
        // Cari ID pekerja yang berada dalam jabatan/group ini dulu
        const { data: groupEmps } = await supabase.from('employees').select('id').eq('department_id', selectedGroup);
        if (groupEmps && groupEmps.length > 0) {
            const empIds = groupEmps.map(e => e.id);
            query = query.in('employee_id', empIds);
        } else {
            // Jika tiada pekerja dalam group ini, luluskan query kosong
            query = query.eq('employee_id', '00000000-0000-0000-0000-000000000000');
        }
    }

    const { data: entries, error } = await query;

    if (error) {
        console.error("Ralat Carian Laporan:", error);
        return;
    }

    // GROUP BY PROJECT & WEEK
    let projectGroups = {};
    
    if (entries && entries.length > 0) {
        entries.forEach(item => {
            const pName = (item.project ? item.project.project_name : 'General Project').toUpperCase();
            if (!projectGroups[pName]) projectGroups[pName] = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, total: 0 };
            
            const dateObj = new Date(item.work_date || item.start_time);
            const day = dateObj.getDate();
            const hrs = (item.duration_seconds || 0) / 3600;
            
            if (day <= 7) projectGroups[pName].w1 += hrs;
            else if (day <= 14) projectGroups[pName].w2 += hrs;
            else if (day <= 21) projectGroups[pName].w3 += hrs;
            else if (day <= 28) projectGroups[pName].w4 += hrs;
            else projectGroups[pName].w5 += hrs;
            
            projectGroups[pName].total += hrs;
        });
    }

    // HASILKAN BINAAN JADUAL
    const tbody = document.getElementById('tableBodyProjects');
    tbody.innerHTML = '';
    let sumWeekly = [0, 0, 0, 0, 0];
    let grandTotal = 0;

    if (Object.keys(projectGroups).length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#64748b; padding: 20px;">No man-hour records found for this period/filter.</td></tr>`;
    } else {
        Object.keys(projectGroups).sort().forEach(pName => {
            const row = projectGroups[pName];
            sumWeekly[0] += row.w1; sumWeekly[1] += row.w2; sumWeekly[2] += row.w3;
            sumWeekly[3] += row.w4; sumWeekly[4] += row.w5; grandTotal += row.total;
            
            tbody.innerHTML += `
                <tr>
                    <td class="project-name">${pName}</td>
                    <td>${row.w1.toFixed(1)}</td>
                    <td>${row.w2.toFixed(1)}</td>
                    <td>${row.w3.toFixed(1)}</td>
                    <td>${row.w4.toFixed(1)}</td>
                    <td>${weeks[4].text !== 'N/A' ? row.w5.toFixed(1) : '-'}</td>
                    <td style="font-weight:800; color:#0f172a;">${row.total.toFixed(1)}</td>
                </tr>
            `;
        });
    }

    // BARIS JUMLAH KESELURUHAN (TOTAL)
    for(let i = 0; i < 5; i++) {
        document.getElementById(`totW1`).textContent = sumWeekly[0].toFixed(1);
        document.getElementById(`totW2`).textContent = sumWeekly[1].toFixed(1);
        document.getElementById(`totW3`).textContent = sumWeekly[2].toFixed(1);
        document.getElementById(`totW4`).textContent = sumWeekly[3].toFixed(1);
        document.getElementById(`totW5`).textContent = sumWeekly[4].toFixed(1);
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
