<!DOCTYPE html>
<html lang="ms">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reports - WorkTime</title>
    <link rel="stylesheet" href="../css/style.css">
    <!-- Chart.js CDN untuk paparan Graf -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    
    <style>
        body { margin: 0; padding: 0; background-color: #f4f7f6; font-family: system-ui, -apple-system, sans-serif; overflow-x: hidden; }
        
        /* ========================================================
           PENYELESAIAN MUTLAK (ABSOLUTE) UNTUK ISU JATUH 
           ======================================================== */
        .reports-wrapper {
            position: absolute;
            top: 0;
            left: 250px; /* Lebar sidebar. Sila ubah jika sidebar bos lebih lebar (cth: 260px) */
            right: 0;
            min-height: 100vh;
            padding: 24px 32px;
            box-sizing: border-box;
            background: #f4f7f6; /* Warna latar mirip Clockify */
        }

        .reports-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        
        /* Submenu Navigation Bar (Gaya Clockify) */
        .reports-nav { display: flex; gap: 8px; border-bottom: 1px solid #e2e8f0; margin-bottom: 20px; padding-bottom: 0; }
        .nav-group { display: flex; align-items: center; gap: 4px; border-right: 1px solid #cbd5e1; padding-right: 12px; margin-right: 8px; }
        .nav-group:last-child { border-right: none; }
        .nav-group-title { font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-right: 6px; }
        .nav-item { padding: 8px 16px; font-size: 0.85rem; font-weight: 500; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; margin-bottom: -1px; text-decoration: none; }
        .nav-item:hover { color: #0ea5e9; }
        .nav-item.active { color: #0ea5e9; border-bottom-color: #0ea5e9; font-weight: 600; }

        /* ========================================================
           CSS GLOBAL UNTUK KANDUNGAN DINAMIK REPORTS.JS 
           ======================================================== */
           
        /* Bar Penapis (Horizontal Panel) */
        .filter-panel { 
            background: white; border: 1px solid #e2e8f0; padding: 12px 16px; margin-bottom: 20px; 
            display: flex; flex-wrap: nowrap; gap: 12px; align-items: center; justify-content: space-between;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02); border-radius: 4px;
        }
        
        .filter-group { display: flex; flex-wrap: nowrap; gap: 10px; align-items: center; }
        
        /* Halang input jadi 100% dan ikut gaya minimalis */
        .filter-panel select, .filter-panel input { 
            padding: 6px 10px !important; border: 1px solid #cbd5e1 !important; border-radius: 4px !important; 
            font-size: 0.8rem !important; color: #475569 !important; background: white !important; 
            width: auto !important; max-width: 150px !important; display: inline-block !important; height: auto !important; margin: 0 !important;
        }
        
        .btn-action { padding: 6px 16px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: none; white-space: nowrap; transition: background 0.2s; }
        .btn-primary { background: #0ea5e9; color: white; }
        .btn-primary:hover { background: #0284c7; }

        /* Summary Teks Atas Bar Chart */
        .summary-cards { display: flex; gap: 24px; margin-bottom: 16px; padding: 10px 16px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; }
        .stat-card { display: flex; align-items: center; gap: 8px; }
        .stat-label { font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; }
        .stat-value { font-size: 1rem; font-weight: 700; color: #334155; }

        /* Seksyen Carta & Jadual */
        .report-section { background: white; border: 1px solid #e2e8f0; margin-bottom: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); border-radius: 4px; }
        .chart-container { position: relative; height: 300px; width: 100%; padding: 20px; box-sizing: border-box; }
        
        .report-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
        .report-table th { background: #f8fafc; color: #64748b; padding: 10px 16px; font-weight: 600; border-bottom: 1px solid #e2e8f0; font-size: 0.75rem; text-transform: uppercase; }
        .report-table td { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; color: #475569; }
        .report-table tr:hover { background: #f8fafc; cursor: default; }

        .loading-overlay, .empty-state { text-align: center; padding: 40px; color: #94a3b8; font-size: 0.9rem; }
    </style>
</head>
<body>
    <!-- Sidebar Dimuatkan Di Sini Oleh JS -->
    <div id="sidebar-container"></div>

    <!-- KANDUNGAN UTAMA (Mempunyai Position: Absolute) -->
    <div class="reports-wrapper">
        
        <div class="reports-header">
            <h1 style="font-size: 1.5rem; color: #0f172a; margin: 0; font-weight: 600;">Reports</h1>
            <span id="userEmail" style="font-size: 0.85rem; color: #64748b;"></span>
        </div>

        <!-- Submenu Navigation -->
        <div class="reports-nav">
            <div class="nav-group">
                <span class="nav-group-title">Time</span>
                <a class="nav-item active" data-tab="summary">Summary</a>
                <a class="nav-item" data-tab="detailed">Detailed</a>
                <a class="nav-item" data-tab="weekly">Weekly</a>
                <a class="nav-item" data-tab="shared">Shared</a>
            </div>
            <div class="nav-group">
                <span class="nav-group-title">Team</span>
                <a class="nav-item" data-tab="attendance">Attendance</a>
                <a class="nav-item" data-tab="assignments">Assignments</a>
            </div>
            <div class="nav-group">
                <span class="nav-group-title">Expense</span>
                <a class="nav-item" data-tab="expense">Detailed</a>
            </div>
        </div>

        <!-- Pemegang Utama Data Laporan -->
        <div id="reportContentView"></div>
        
    </div>

    <script type="module" src="../js/reports.js"></script>
</body>
</html>
