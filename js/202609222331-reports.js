import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let chartBar = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        populateFilters();

        document.getElementById('btnGenerate').addEventListener('click', generateReport);
        document.getElementById('btnPrint').addEventListener('click', () => window.print());
        document.getElementById('btnExcel').addEventListener('click', exportCSV);

        // Auto generate bulan semasa
        await generateReport();
        
        // Letak tarikh harini pada ruangan tandatangan
        const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        document.querySelectorAll('.sig-date').forEach(el => el.textContent = `Date: ${today}`);

    } catch (err) {
        console.error("Reports Init Error:", err);
    }
});

function populateFilters() {
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
}

// Fungsi kiraan julat tarikh untuk Week 1 hingga Week 5
function getWeekDates(year, month) {
    const lastDay = new Date(year, month, 0).getDate(); // jumlah hari dalam bulan
    const format = (d) => `${d.toString().padStart(2, '0')}`;
    const mName = new Date(year, month - 1).toLocaleString('default', { month: 'short' });
    
    return [
        { label: 'Week 1', start: 1, end: 7, text: `01 - 07 ${mName} ${year}` },
        { label: 'Week 2', start: 8, end: 14, text: `08 - 14 ${mName} ${year}` },
        { label: 'Week 3', start: 15, end: 21, text: `15 - 21 ${mName} ${year}` },
        { label: 'Week 4', start: 22, end: 28, text: `22 - 28 ${mName} ${year}` },
        { label: 'Week 5', start: 29, end: lastDay, text: lastDay >= 29 ? `29 - ${lastDay} ${mName} ${year}` : '' }
    ];
}

async function generateReport() {
    const month = parseInt(document.getElementById('reportMonth').value);
    const year = parseInt(document.getElementById('reportYear').value);
    const selectedProject = document.getElementById('reportProject').value;
    
    // Kemaskini Header Bulan
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' }).toUpperCase();
    document.getElementById('badgeMonthYear').innerHTML = `${monthName}<br>${year}`;

    // Tentukan tarikh minggu
    const weeks = getWeekDates(year, month);
    weeks.forEach((w, i) => {
        const el = document.getElementById(`dtW${i+1}`);
        if(el) el.textContent = w.text;
    });

    // QUERY SUPABASE - Bulan Semasa
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    
    let query = supabase.from('timesheets').select('*').gte('date', startDate).lte('date', endDate);
    if(selectedProject !== "ALL") query = query.eq('project_name', selectedProject);
    const { data: currentData } = await query;

    // QUERY SUPABASE - Bulan Lepas (Untuk KPI)
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevStart = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-01`;
    const prevEnd = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-${new Date(prevYear, prevMonth, 0).getDate()}`;
    const { data: prevData } = await supabase.from('timesheets').select('hours').gte('date', prevStart).lte('date', prevEnd);

    let prevTotal = 0;
    if(prevData) prevData.forEach(d => prevTotal += parseFloat(d.hours || 0));

    // SUSUN DATA (GROUP BY PROJECT & WEEK)
    let projectGroups = {};
    
    if (currentData && currentData.length > 0) {
        currentData.forEach(item => {
            const pName = (item.project_name || 'General Project').toUpperCase();
            if (!projectGroups[pName]) projectGroups[pName] = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, total: 0 };
            
            const day = new Date(item.date).getDate();
            const hrs = parseFloat(item.hours) || 0;
            
            if (day <= 7) projectGroups[pName].w1 += hrs;
            else if (day <= 14) projectGroups[pName].w2 += hrs;
            else if (day <= 21) projectGroups[pName].w3 += hrs;
            else if (day <= 28) projectGroups[pName].w4 += hrs;
            else projectGroups[pName].w5 += hrs;
            
            projectGroups[pName].total += hrs;
        });
    }

    // UPDATE TABLE & TOTALS
    const tbody = document.getElementById('tableBodyProjects');
    tbody.innerHTML = '';
    let sumWeekly = [0, 0, 0, 0, 0];
    let grandTotal = 0;

    if(Object.keys(projectGroups).length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:#64748b;">No man-hour records found for this period.</td></tr>`;
    } else {
        Object.keys(projectGroups).sort().forEach(pName => {
            const row = projectGroups[pName];
            sumWeekly[0] += row.w1; sumWeekly[1] += row.w2; sumWeekly[2] += row.w3;
            sumWeekly[3] += row.w4; sumWeekly[4] += row.w5; grandTotal += row.total;
            
            // Format Table Row
            tbody.innerHTML += `
                <tr>
                    <td class="project-name">${pName}</td>
                    <td>${row.w1.toFixed(1)}</td>
                    <td>${row.w2.toFixed(1)}</td>
                    <td>${row.w3.toFixed(1)}</td>
                    <td>${row.w4.toFixed(1)}</td>
                    <td>${row.w5 > 0 || weeks[4].text !== '' ? row.w5.toFixed(1) : '-'}</td>
                    <td style="font-weight:800; color:#0f172a;">${row.total.toFixed(1)}</td>
                </tr>
            `;
        });
    }

    // UPDATE TOTAL ROW
    for(let i=0; i<5; i++) {
        document.getElementById(`totW${i+1}`).textContent = sumWeekly[i].toFixed(1);
    }
    document.getElementById('totGrand').textContent = grandTotal.toFixed(1);

    // SYNC CHART
    renderChart(sumWeekly);

    // SYNC KPI
    document.getElementById('kpiTotal').textContent = grandTotal.toFixed(1);
    document.getElementById('kpiPrev').textContent = prevTotal.toFixed(1);
    
    const kpiChangeEl = document.getElementById('kpiChange');
    if (prevTotal === 0) {
        kpiChangeEl.innerHTML = `<span class="kpi-up">↑ +100.00%</span> (No prior data)`;
    } else {
        const perc = ((grandTotal - prevTotal) / prevTotal) * 100;
        if (perc > 0) kpiChangeEl.innerHTML = `<span class="kpi-up">↑ +${perc.toFixed(2)}%</span>`;
        else if (perc < 0) kpiChangeEl.innerHTML = `<span class="kpi-down">↓ ${perc.toFixed(2)}%</span>`;
        else kpiChangeEl.innerHTML = `<span class="kpi-neutral">– 0.00%</span>`;
    }

    // SYNC HIGHLIGHTS
    const maxWeekIndex = sumWeekly.indexOf(Math.max(...sumWeekly));
    const listHL = document.getElementById('listHighlights');
    listHL.innerHTML = `
        <li>Total man-hour for <strong>${monthName} ${year}</strong>: ${grandTotal.toFixed(1)} hours.</li>
        <li>Highest man-hour recorded in <strong>Week ${maxWeekIndex + 1}</strong> (${sumWeekly[maxWeekIndex].toFixed(1)} hours).</li>
        <li>Overall man-hour ${grandTotal >= prevTotal ? 'increased' : 'decreased'} compared with previous month.</li>
        <li>Project progress is on track as per planned schedule.</li>
    `;
}

function renderChart(dataArr) {
    const ctx = document.getElementById('weeklyChart');
    if(!ctx) return;
    if(chartBar) chartBar.destroy();

    chartBar = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
            datasets: [{
                label: 'Total Man-Hours',
                data: dataArr,
                backgroundColor: '#0284c7', // Corporate Blue
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
                x: { grid: { display: false } }
            }
        }
    });
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
