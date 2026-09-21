import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

let chartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        // Tetapkan event listener untuk butang
        document.getElementById('btnGenerate').addEventListener('click', generateReport);
        document.getElementById('btnPrint').addEventListener('click', () => window.print());

        // Jana laporan lalai (Default: Bulan semasa)
        await generateReport();

    } catch (err) {
        console.error("Reports Init Error:", err);
    }
});

async function generateReport() {
    const monthSelect = document.getElementById('reportMonth').value;
    const yearInput = document.getElementById('reportYear').value;
    
    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    const monthText = monthNames[parseInt(monthSelect) - 1];

    // Kemas kini tajuk bulan
    document.getElementById('badgeMonthYear').innerHTML = `${monthText}<br>${yearInput}`;

    // 1. Dapatkan rekod masa dari Supabase
    // (Jika pangkalan data masih kosong, data contoh automatik disajikan)
    const { data: timesheets } = await supabase
        .from('timesheets')
        .select('*');

    // 2. Pembina Data Projek mengikut Minggu
    let projectData = {};

    if (timesheets && timesheets.length > 0) {
        timesheets.forEach(item => {
            const pName = item.project_name || 'General Project';
            if (!projectData[pName]) {
                projectData[pName] = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, total: 0 };
            }

            // Tentukan minggu mengikut tarikh
            const itemDate = new Date(item.date || item.created_at);
            const day = itemDate.getDate();
            const hours = parseFloat(item.hours) || 0;

            if (day <= 7) projectData[pName].w1 += hours;
            else if (day <= 14) projectData[pName].w2 += hours;
            else if (day <= 21) projectData[pName].w3 += hours;
            else if (day <= 28) projectData[pName].w4 += hours;
            else projectData[pName].w5 += hours;

            projectData[pName].total += hours;
        });
    } else {
        // DATA SAMPLE LENGKAP (Sama seperti templat lampiran A4)
        projectData = {
            "MEETING / CLIENT CONSULTATION": { w1: 80, w2: 100, w3: 90, w4: 95, w5: 20, total: 385 },
            "PROJECT DOCUMENTATION & REPORTING": { w1: 100, w2: 120, w3: 110, w4: 115, w5: 25, total: 470 },
            "SITE INSPECTION & MONITORING": { w1: 70, w2: 90, w3: 85, w4: 90, w5: 15, total: 350 },
            "TECHNICAL & OPERATION LIFTING": { w1: 70, w2: 100, w3: 80, w4: 95, w5: 15, total: 360 }
        };
    }

    // 3. Render Jadual & Kira TOTAL Setiap Lajur
    const tbody = document.getElementById('tableBodyProjects');
    tbody.innerHTML = '';

    let sumW1 = 0, sumW2 = 0, sumW3 = 0, sumW4 = 0, sumW5 = 0, sumGrand = 0;

    Object.keys(projectData).forEach(pName => {
        const row = projectData[pName];
        sumW1 += row.w1;
        sumW2 += row.w2;
        sumW3 += row.w3;
        sumW4 += row.w4;
        sumW5 += row.w5;
        sumGrand += row.total;

        tbody.innerHTML += `
            <tr>
                <td class="project-name">${pName}</td>
                <td>${row.w1}</td>
                <td>${row.w2}</td>
                <td>${row.w3}</td>
                <td>${row.w4}</td>
                <td>${row.w5}</td>
                <td style="font-weight:700; color:#0f172a;">${row.total}</td>
            </tr>
        `;
    });

    // 4. Kemas kini Baris TOTAL di Bawah Jadual
    document.getElementById('totW1').textContent = sumW1;
    document.getElementById('totW2').textContent = sumW2;
    document.getElementById('totW3').textContent = sumW3;
    document.getElementById('totW4').textContent = sumW4;
    document.getElementById('totW5').textContent = sumW5;
    document.getElementById('totGrand').textContent = `${sumGrand} Hours`;

    document.getElementById('cardTotalHours').textContent = `${sumGrand} Hours`;

    // 5. Jana Graf Carta Mingguan (Chart.js)
    renderWeeklyChart([sumW1, sumW2, sumW3, sumW4, sumW5]);
}

function renderWeeklyChart(weeklyTotals) {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
            datasets: [{
                label: 'Man-Hours',
                data: weeklyTotals,
                backgroundColor: '#0ea5e9',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}
